import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { runAuthorizedBrowserCase } from "./authorized-browser-execution.mjs";
import { runClosingJob } from "./closing-job.mjs";
import { runQuestionGateJob } from "./question-gate-job.mjs";
import { runReadOnlyPlanningJob } from "./read-only-planning-job.mjs";

const TERMINAL_CASE_STATUSES = new Set(["passed", "failed", "blocked", "residual_risk"]);

export async function inspectQaJobState({ workspace }) {
  const paths = artifactPaths(workspace);
  const requirement = await readJsonIfExists(paths.requirement);
  const questions = await readJsonIfExists(paths.questions);

  if (!requirement || !questions) {
    return {
      phase: "intake",
      status: "incomplete",
      missing: [!requirement && "requirement.json", !questions && "questions.json"].filter(Boolean),
      workspace,
      artifacts: paths
    };
  }
  assertRequirementIdentity(requirement, questions);
  const unanswered = (questions.questions ?? []).filter(
    (question) => question.classification === "blocking" && !String(question.answer ?? "").trim()
  );
  if (unanswered.length > 0 || requirement.status === "waiting_for_confirmation") {
    return {
      phase: "waiting_for_confirmation",
      status: "waiting_for_confirmation",
      blocking_question_ids: unanswered.map((question) => question.question_id),
      workspace,
      artifacts: paths
    };
  }

  const strategy = await readJsonIfExists(paths.strategy);
  const testCases = await readJsonIfExists(paths.testCases);
  if (!strategy || !testCases) {
    return {
      phase: "design",
      status: "incomplete",
      partial: Boolean(strategy || testCases),
      missing: [!strategy && "strategy.json", !testCases && "test-cases.json"].filter(Boolean),
      workspace,
      artifacts: paths
    };
  }
  assertRequirementIdentity(requirement, strategy, testCases);
  try {
    validatePersistedDesign(requirement, strategy, testCases);
  } catch (error) {
    return {
      phase: "design",
      status: "invalid",
      partial: true,
      reason: error.message,
      workspace,
      artifacts: paths
    };
  }

  const execution = await readJsonIfExists(paths.executionResults);
  const manifest = await readJsonIfExists(paths.evidenceManifest);
  if ((execution && !manifest) || (!execution && manifest)) {
    return {
      phase: "execution",
      status: "incomplete",
      partial: true,
      missing: [!execution && "execution-results.json", !manifest && "evidence-manifest.json"].filter(Boolean),
      workspace,
      artifacts: paths
    };
  }
  if (!execution) {
    return { phase: "execution", status: "incomplete", workspace, artifacts: paths };
  }
  assertRequirementIdentity(requirement, execution, manifest);
  await validateExecutionReferences(workspace, requirement, testCases, execution, manifest);

  const latest = latestRunsByCase(execution.runs ?? []);
  const unexecuted = (testCases.cases ?? []).filter((testCase) => !latest.has(testCase.case_id));
  if (requirement.status === "testing" || unexecuted.length > 0) {
    return {
      phase: "execution",
      status: "incomplete",
      pending_case_ids: unexecuted.map((testCase) => testCase.case_id),
      workspace,
      artifacts: paths
    };
  }

  const closing = await closingCompleteness(paths, requirement, workspace);
  if (!closing.complete) {
    return {
      phase: "synthesis",
      status: "incomplete",
      missing: closing.missing,
      workspace,
      artifacts: paths
    };
  }
  return {
    phase: "complete",
    status: requirement.status,
    workspace,
    artifacts: paths
  };
}

export async function resumeQaJob({
  workspace,
  workspaceRoot = path.dirname(workspace),
  rawJob,
  plan,
  browser,
  retrospective,
  retryBlocked = true,
  retryFailed = false
}) {
  let state = await inspectQaJobState({ workspace });
  const actions = [];

  if (state.phase === "complete") {
    const retryCaseIds = await requestedRetryCaseIds(workspace, { retryBlocked, retryFailed });
    if (retryCaseIds.length === 0) return { ...state, resumed: false, actions };
    if (!browser) {
      return {
        ...state,
        resumed: false,
        actions,
        blocker: "prepared_browser_session_required",
        retry_case_ids: retryCaseIds
      };
    }
    state = { ...state, phase: "synthesis" };
  }
  if (state.phase === "waiting_for_confirmation") {
    return { ...state, resumed: false, actions, blocker: "blocking_questions_unanswered" };
  }

  if (state.phase === "intake") {
    if (!rawJob) return { ...state, blocker: "raw_job_required", resumed: false, actions };
    if (path.basename(workspace) !== rawJob.requirementId) {
      throw new Error("Raw job identity does not match the recovery workspace");
    }
    await runQuestionGateJob({ rawJob, workspaceRoot });
    actions.push("intake");
    state = await inspectQaJobState({ workspace });
    if (state.phase === "waiting_for_confirmation") {
      return { ...state, resumed: true, actions, blocker: "blocking_questions_unanswered" };
    }
  }

  if (state.phase === "design") {
    if (!plan) return { ...state, blocker: "test_plan_required", resumed: actions.length > 0, actions };
    if (state.partial) await archivePartialDesign(workspace);
    await setRequirementStatus(workspace, "ready_for_design");
    const design = await runReadOnlyPlanningJob({ workspace, plan });
    actions.push("design");
    if (design.status === "blocked") {
      return { phase: "complete", status: "blocked", resumed: true, actions, workspace, artifacts: state.artifacts };
    }
    state = await inspectQaJobState({ workspace });
  }

  if (state.phase === "execution") {
    if (state.partial) {
      await archivePartialExecution(workspace);
      await setRequirementStatus(workspace, "ready_for_execution");
    }
    const needsBrowser = (await requestedRetryCaseIds(workspace, {
      retryBlocked,
      retryFailed,
      includeUnexecuted: true
    })).length > 0;
    if (needsBrowser && !browser) {
      return { ...state, blocker: "prepared_browser_session_required", resumed: actions.length > 0, actions };
    }
    await resumeExecution({ workspace, browser, retryBlocked, retryFailed, actions });
    state = await inspectQaJobState({ workspace });
  } else if (state.phase === "synthesis" && browser && (retryBlocked || retryFailed)) {
    await resumeExecution({ workspace, browser, retryBlocked, retryFailed, actions });
    state = await inspectQaJobState({ workspace });
  }

  if (state.phase === "synthesis" || state.phase === "execution") {
    const closed = await runClosingJob({ workspace, workspaceRoot, retrospective });
    actions.push("synthesis");
    state = await inspectQaJobState({ workspace });
    return {
      ...state,
      status: closed.status,
      resumed: true,
      actions,
      artifacts: { ...state.artifacts, ...closed.artifacts }
    };
  }

  return { ...state, resumed: actions.length > 0, actions };
}

async function resumeExecution({ workspace, browser, retryBlocked, retryFailed, actions }) {
  const paths = artifactPaths(workspace);
  const testCases = await readJson(paths.testCases);
  const execution = await readJsonIfExists(paths.executionResults);
  const latest = latestRunsByCase(execution?.runs ?? []);
  const attempted = new Set();

  for (const testCase of testCases.cases ?? []) {
    const previous = latest.get(testCase.case_id);
    const shouldRun =
      !previous ||
      (retryBlocked && ["blocked", "residual_risk"].includes(previous.status)) ||
      (retryFailed && previous.status === "failed");
    if (!shouldRun || attempted.has(testCase.case_id)) continue;
    if (!browser) throw new Error("A prepared browser session is required for incomplete cases");

    await setRequirementStatus(workspace, "ready_for_execution");
    const result = await runAuthorizedBrowserCase({ workspace, browser, caseId: testCase.case_id });
    actions.push(`execution:${testCase.case_id}:${result.status}`);
    attempted.add(testCase.case_id);
    if (["blocked", "residual_risk"].includes(result.status)) break;
  }

  const currentExecution = await readJsonIfExists(paths.executionResults);
  if (!currentExecution) throw new Error("Browser execution produced no execution-results.json");
  const currentLatest = latestRunsByCase(currentExecution.runs ?? []);
  const latestStatuses = (testCases.cases ?? [])
    .map((testCase) => currentLatest.get(testCase.case_id)?.status)
    .filter(Boolean);
  const aggregate = latestStatuses.includes("failed")
    ? "has_bugs"
    : latestStatuses.some((status) => ["blocked", "residual_risk"].includes(status))
      ? "blocked"
      : latestStatuses.length === (testCases.cases ?? []).length && latestStatuses.every((status) => status === "passed")
        ? "passed"
        : "testing";
  await setRequirementStatus(workspace, aggregate);
}

async function requestedRetryCaseIds(
  workspace,
  { retryBlocked, retryFailed, includeUnexecuted = false }
) {
  const paths = artifactPaths(workspace);
  const testCases = await readJsonIfExists(paths.testCases);
  if (!testCases) return [];
  const execution = await readJsonIfExists(paths.executionResults);
  const latest = latestRunsByCase(execution?.runs ?? []);
  return (testCases.cases ?? [])
    .filter((testCase) => {
      const run = latest.get(testCase.case_id);
      return (
        (includeUnexecuted && !run) ||
        (retryBlocked && ["blocked", "residual_risk"].includes(run?.status)) ||
        (retryFailed && run?.status === "failed")
      );
    })
    .map((testCase) => testCase.case_id);
}

async function validateExecutionReferences(workspace, requirement, testCases, execution, manifest) {
  const caseMap = new Map((testCases.cases ?? []).map((testCase) => [testCase.case_id, testCase]));
  const evidenceIds = new Set();
  for (const evidence of manifest.evidence ?? []) {
    if (evidenceIds.has(evidence.evidence_id)) throw new Error(`Duplicate evidence ID ${evidence.evidence_id}`);
    evidenceIds.add(evidence.evidence_id);
    if (typeof evidence.path !== "string" || !evidence.path.startsWith("evidence/")) {
      throw new Error(`Evidence ${evidence.evidence_id} has an unsafe path`);
    }
    const absolute = path.resolve(workspace, evidence.path);
    if (!absolute.startsWith(`${path.resolve(workspace)}${path.sep}`)) {
      throw new Error(`Evidence ${evidence.evidence_id} escapes the job workspace`);
    }
    const bytes = await readFile(absolute);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (!/^[a-f0-9]{64}$/.test(evidence.hash ?? "") || evidence.hash !== hash) {
      throw new Error(`Evidence ${evidence.evidence_id} hash does not match its file`);
    }
  }
  const resultIds = new Set();
  for (const run of execution.runs ?? []) {
    if (resultIds.has(run.result_id)) throw new Error(`Duplicate run ID ${run.result_id}`);
    resultIds.add(run.result_id);
    if (!caseMap.has(run.case_id)) throw new Error(`Run ${run.result_id} references unknown case ${run.case_id}`);
    if (run.case_revision !== hashJson(caseMap.get(run.case_id))) {
      throw new Error(`Run ${run.result_id} does not match the current test design`);
    }
    if (!TERMINAL_CASE_STATUSES.has(run.status)) throw new Error(`Run ${run.result_id} has invalid status ${run.status}`);
    if (
      run.environment !== requirement.environment.name ||
      run.merchant_scope !== requirement.environment.merchant_scope
    ) {
      throw new Error(`Run ${run.result_id} authorization scope does not match the requirement`);
    }
    const expectedAuthorization = `prepared-session:${requirement.environment.name}:${requirement.environment.merchant_scope}`;
    if ((run.step_results ?? []).length > 0) {
      if (
        run.observed_session?.environment !== requirement.environment.name ||
        run.observed_session?.merchant_scope !== requirement.environment.merchant_scope ||
        run.observed_session?.surface !== "management_backend"
      ) {
        throw new Error(`Run ${run.result_id} observed session does not match its authorization scope`);
      }
    }
    for (const step of run.step_results ?? []) {
      if (step.authorization_ref !== expectedAuthorization) {
        throw new Error(`Step ${step.step_id} has a missing or stale authorization reference`);
      }
      for (const evidenceId of step.evidence_ids ?? []) {
        if (!evidenceIds.has(evidenceId)) throw new Error(`Step ${step.step_id} references missing evidence ${evidenceId}`);
      }
    }
    if (run.retry_of && !resultIds.has(run.retry_of)) {
      throw new Error(`Run ${run.result_id} references unknown retry source ${run.retry_of}`);
    }
  }
}

function validatePersistedDesign(requirement, strategy, testCases) {
  if (!strategy.scope || !Array.isArray(strategy.scope.in_scope)) {
    throw new Error("Persisted strategy scope is invalid");
  }
  if (!Array.isArray(testCases.cases) || testCases.cases.length === 0) {
    throw new Error("Persisted test design has no executable cases");
  }
  const knownRules = new Set((requirement.confirmed_rules ?? []).map((rule) => rule.rule_id));
  const covered = new Set();
  const caseIds = new Set();
  const stepIds = new Set();
  for (const testCase of testCases.cases) {
    if (!/^TC-\d{3}$/.test(testCase.case_id) || caseIds.has(testCase.case_id)) {
      throw new Error("Persisted test design has invalid or duplicate case IDs");
    }
    caseIds.add(testCase.case_id);
    if (!Array.isArray(testCase.rule_ids) || !Array.isArray(testCase.steps) || testCase.steps.length === 0) {
      throw new Error(`Persisted case ${testCase.case_id} is not traceable or executable`);
    }
    for (const ruleId of testCase.rule_ids) {
      if (!knownRules.has(ruleId)) throw new Error(`Persisted case ${testCase.case_id} references unknown rule ${ruleId}`);
      covered.add(ruleId);
    }
    if (!Array.isArray(testCase.evidence_required) || testCase.evidence_required.length === 0) {
      throw new Error(`Persisted case ${testCase.case_id} has no evidence expectation`);
    }
    for (const step of testCase.steps) {
      if (
        !/^STEP-\d{3}$/.test(step.step_id) ||
        stepIds.has(step.step_id) ||
        step.action_class !== "read_only" ||
        !["navigate", "filter", "open_detail", "read_visible"].includes(step.operation) ||
        !["h5_frontend", "management_backend", "local_artifact"].includes(step.target_surface) ||
        !step.assertion ||
        !["equals", "contains", "matches_regex"].includes(step.assertion.operator) ||
        typeof step.assertion.expected !== "string" ||
        step.assertion.expected.trim() === ""
      ) {
        throw new Error(`Persisted step ${step.step_id ?? "unknown"} violates the read-only design contract`);
      }
      stepIds.add(step.step_id);
    }
  }
  const disposition = strategy.rule_disposition ?? {};
  const explicitlyDisposed = new Set([
    ...(disposition.blocked ?? []),
    ...(disposition.out_of_scope ?? [])
  ]);
  for (const ruleId of knownRules) {
    if (!covered.has(ruleId) && !explicitlyDisposed.has(ruleId)) {
      throw new Error(`Persisted design leaves confirmed rule ${ruleId} uncovered`);
    }
  }
}

async function closingCompleteness(paths, requirement, workspace) {
  const bugs = await readJsonIfExists(paths.bugs);
  const required = [
    paths.bugs,
    paths.testReport,
    paths.retrospective,
    paths.ledger,
    paths.closingManifest
  ];
  if ((bugs?.bugs ?? []).length > 0) required.push(paths.bugTickets);
  const missing = [];
  for (const filePath of required) {
    try {
      await access(filePath);
    } catch {
      missing.push(path.basename(filePath));
    }
  }
  if (missing.length > 0) return { complete: false, missing };

  const retrospective = await readJson(paths.retrospective);
  const manifest = await readJson(paths.closingManifest);
  if (
    bugs.requirement_id !== requirement.requirement_id ||
    retrospective.requirement_id !== requirement.requirement_id ||
    manifest.requirement_id !== requirement.requirement_id
  ) {
    return { complete: false, missing: ["closing artifacts with current requirement identity"] };
  }
  const workspaceRoot = path.dirname(workspace);
  const jobName = path.basename(workspace);
  const expectedSources = new Set([
    "requirement.json", "questions.json", "strategy.json", "test-cases.json",
    "execution-results.json", "evidence-manifest.json"
  ]);
  const expectedOutputs = new Set([
    `${jobName}/bugs.json`, `${jobName}/test-report.html`, `${jobName}/retrospective.json`,
    ...((bugs?.bugs ?? []).length > 0 ? [`${jobName}/bug-tickets.html`] : []),
    "qa-index.html"
  ]);
  if (!samePathSet(manifest.source_revisions, expectedSources) || !samePathSet(manifest.outputs, expectedOutputs)) {
    return { complete: false, missing: ["complete closing manifest revisions"] };
  }
  for (const revision of manifest.source_revisions ?? []) {
    if (!(await revisionMatches(workspace, revision))) {
      return { complete: false, missing: [`current source revision ${revision.path}`] };
    }
  }
  for (const output of manifest.outputs ?? []) {
    if (!(await revisionMatches(workspaceRoot, output))) {
      return { complete: false, missing: [`valid closing output ${output.path}`] };
    }
  }
  const report = await readFile(paths.testReport, "utf8");
  const ledger = await readFile(paths.ledger, "utf8");
  if (!report.includes(requirement.requirement_id) || !ledger.includes(`${path.basename(workspace)}/test-report.html`)) {
    return { complete: false, missing: ["current report or ledger link"] };
  }
  return { complete: true, missing: [] };
}

function samePathSet(revisions, expected) {
  if (!Array.isArray(revisions)) return false;
  const actual = new Set(revisions.map((item) => String(item.path).replaceAll("\\", "/")));
  return actual.size === expected.size && [...expected].every((item) => actual.has(item));
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function revisionMatches(root, revision) {
  if (
    !revision ||
    typeof revision.path !== "string" ||
    typeof revision.sha256 !== "string"
  ) return false;
  const absolute = path.resolve(root, revision.path);
  if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`)) return false;
  try {
    const bytes = await readFile(absolute);
    return createHash("sha256").update(bytes).digest("hex") === revision.sha256;
  } catch {
    return false;
  }
}

async function archivePartialDesign(workspace) {
  const recoveryDir = path.join(workspace, ".recovery");
  await mkdir(recoveryDir, { recursive: true });
  for (const name of ["strategy.json", "test-cases.json"]) {
    const source = path.join(workspace, name);
    try {
      await access(source);
      await rename(source, path.join(recoveryDir, `${Date.now()}-${name}`));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

async function archivePartialExecution(workspace) {
  const recoveryDir = path.join(workspace, ".recovery");
  await mkdir(recoveryDir, { recursive: true });
  for (const name of ["execution-results.json", "evidence-manifest.json"]) {
    const source = path.join(workspace, name);
    try {
      await access(source);
      await rename(source, path.join(recoveryDir, `${Date.now()}-${name}`));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

async function setRequirementStatus(workspace, status) {
  const requirementPath = path.join(workspace, "requirement.json");
  const requirement = await readJson(requirementPath);
  requirement.status = status;
  await writeFile(requirementPath, `${JSON.stringify(requirement, null, 2)}\n`, "utf8");
}

function latestRunsByCase(runs) {
  const latest = new Map();
  for (const run of runs) latest.set(run.case_id, run);
  return latest;
}

function assertRequirementIdentity(requirement, ...artifacts) {
  for (const artifact of artifacts) {
    if (artifact.requirement_id !== requirement.requirement_id) {
      throw new Error("Artifact requirement identity mismatch during resume");
    }
  }
}

function artifactPaths(workspace) {
  const workspaceRoot = path.dirname(workspace);
  return {
    requirement: path.join(workspace, "requirement.json"),
    questions: path.join(workspace, "questions.json"),
    strategy: path.join(workspace, "strategy.json"),
    testCases: path.join(workspace, "test-cases.json"),
    executionResults: path.join(workspace, "execution-results.json"),
    evidenceManifest: path.join(workspace, "evidence-manifest.json"),
    bugs: path.join(workspace, "bugs.json"),
    testReport: path.join(workspace, "test-report.html"),
    bugTickets: path.join(workspace, "bug-tickets.html"),
    retrospective: path.join(workspace, "retrospective.json"),
    closingManifest: path.join(workspace, "closing-manifest.json"),
    ledger: path.join(workspaceRoot, "qa-index.html")
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

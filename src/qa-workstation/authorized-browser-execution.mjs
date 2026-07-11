import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { PHASES, markPhaseDone, markPhaseInProgress } from "./job-phase.mjs";

const EXECUTOR = "main_agent";
const READ_ONLY_OPERATIONS = new Set(["navigate", "filter", "open_detail", "read_visible"]);
const ASSERTION_OPERATORS = new Set(["equals", "contains", "matches_regex"]);
const EVIDENCE_SENSITIVITIES = new Set(["public", "internal", "sensitive"]);
const REDACTION_STATUSES = new Set(["not_needed", "required", "complete"]);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_IEND = Buffer.from([73, 69, 78, 68, 174, 66, 96, 130]);
const SESSION_BLOCKERS = new Set([
  "expired",
  "login_required",
  "otp_required",
  "captcha_required",
  "device_verification_required"
]);
const activeBrowsers = new WeakSet();

export async function runAuthorizedBrowserCase({ workspace, browser, caseId }) {
  assertObject(browser, "browser");
  if (activeBrowsers.has(browser)) {
    throw new Error("Live browser is already owned by main_agent");
  }
  activeBrowsers.add(browser);

  let claimed = false;
  let lease;
  let result;
  let executionError;
  let releaseError;
  try {
    requireBrowserMethod(browser, "sessionIdentity");
    const sessionIdentity = await browser.sessionIdentity();
    if (!nonEmpty(sessionIdentity)) throw new Error("Browser session identity is missing");
    lease = await acquireSessionLease(workspace, sessionIdentity);
    requireBrowserMethod(browser, "claim");
    requireBrowserMethod(browser, "release");
    claimed = await browser.claim(EXECUTOR);
    if (claimed !== true) throw new Error("Live browser ownership claim was refused");
    result = await executeCase({ workspace, browser, caseId });
  } catch (error) {
    executionError = error;
  } finally {
    if (claimed && typeof browser.release === "function") {
      try {
        await browser.release(EXECUTOR);
      } catch (error) {
        releaseError = error;
      }
    }
    if (lease) {
      try {
        await releaseSessionLease(lease);
      } catch (error) {
        releaseError ??= error;
      }
    }
    activeBrowsers.delete(browser);
  }
  if (executionError) throw executionError;
  if (releaseError) return persistReleaseFailure(result, releaseError);
  return result;
}

async function executeCase({ workspace, browser, caseId }) {
  const requirementPath = path.join(workspace, "requirement.json");
  const casesPath = path.join(workspace, "test-cases.json");
  const requirement = await readJson(requirementPath);
  const testCases = await readJson(casesPath);
  const history = await readExecutionHistory(workspace, requirement.requirement_id);

  if (requirement.status !== "ready_for_execution") {
    throw new Error(`Job status ${requirement.status} cannot enter browser execution`);
  }
  if (requirement.environment.known_session_state !== "user_ready") {
    return persistPreflightBlock({
      workspace,
      history,
      requirement,
      requirementPath,
      testCases,
      caseId,
      blocker: "session_not_handed_off",
      judgment: "A manually authenticated browser session was not marked ready."
    });
  }

  const testCase = selectCase(testCases.cases, caseId);
  if (!Array.isArray(testCase.steps) || testCase.steps.length === 0) {
    return persistPreflightBlock({
      workspace,
      history,
      requirement,
      requirementPath,
      testCase,
      blocker: "execution_gate_refused_step",
      judgment: `${testCase.case_id} has no executable steps.`
    });
  }
  const invalidStep = testCase.steps.find(
    (step) =>
      !step ||
      step.action_class !== "read_only" ||
      !READ_ONLY_OPERATIONS.has(step.operation) ||
      typeof step.operation_target !== "string" ||
      step.operation_target.trim() === "" ||
      (step.operation === "filter" && !nonEmpty(step.operation_value)) ||
      !isValidAssertion(step.assertion)
  );
  if (invalidStep) {
    return persistPreflightBlock({
      workspace,
      history,
      requirement,
      requirementPath,
      testCase,
      blocker: "execution_gate_refused_step",
      judgment: `${invalidStep?.step_id ?? "Unknown step"} is not a valid read-only operation with a machine-checkable assertion.`
    });
  }

  if (!nonEmpty(requirement.environment.name) || !nonEmpty(requirement.environment.merchant_scope)) {
    return persistPreflightBlock({
      workspace,
      history,
      requirement,
      requirementPath,
      testCase,
      blocker: "missing_expected_scope",
      judgment: "Expected environment and merchant scope must be recorded before browser execution."
    });
  }

  requireBrowserMethod(browser, "inspectSession");
  let session;
  try {
    session = await browser.inspectSession();
  } catch (error) {
    return persistPreflightBlock({
      workspace,
      history,
      requirement,
      requirementPath,
      testCase,
      blocker: "session_inspection_failed",
      judgment: `The prepared browser session could not be inspected: ${error.message}`
    });
  }
  const preflight = inspectSession(requirement, session);
  if (preflight) {
    return persistPreflightBlock({
      workspace,
      history,
      requirement,
      requirementPath,
      testCase,
      blocker: preflight.blocker,
      judgment: preflight.judgment,
      observedSession: session
    });
  }

  const runId = formatId("RUN", history.nextRunIndex);
  const priorRun = findLatestRunForCase(history.runs, testCase.case_id);

  if (priorRun?.status === "passed") {
    return {
      status: "passed",
      workspace,
      artifacts: {
        executionResults: path.join(workspace, "execution-results.json"),
        evidenceManifest: path.join(workspace, "evidence-manifest.json"),
        evidenceDirectory: path.join(workspace, "evidence")
      },
      already_completed: true,
      result_id: priorRun.result_id
    };
  }

  const { resumeStepIndex, copiedStepResults } = deriveResumePoint(testCase.steps, priorRun);
  markPhaseInProgress(requirement, PHASES.execute);

  const startedAt = new Date().toISOString();
  requirement.status = "testing";
  await writeJsonAtomic(requirementPath, requirement);

  const evidence = [];
  const stepResults = [...copiedStepResults];
  let terminalStatus = "passed";
  let terminalJudgment = "All expected read-only observations were positively verified.";

  for (let stepIndex = resumeStepIndex; stepIndex < testCase.steps.length; stepIndex++) {
    const step = testCase.steps[stepIndex];
    let observation;
    try {
      observation = await dispatchReadOnlyOperation(browser, step);
    } catch (error) {
      const blocker = classifyBrowserError(error);
      stepResults.push(
        blockedStep(step, blocker, error.message, {}, authorizationRef(requirement))
      );
      terminalStatus = "blocked";
      terminalJudgment = blockerJudgment(blocker, error.message);
      break;
    }

    if (!observation || observation.visible !== true || !nonEmpty(observation.observed)) {
      stepResults.push({
        step_id: step.step_id,
        status: "residual_risk",
        observed: observation?.observed ?? "",
        observed_facts: observation?.facts ?? [],
        evidence_ids: [],
        authorization_ref: authorizationRef(requirement),
        blocker: "missing_visible_data"
      });
      terminalStatus = "residual_risk";
      terminalJudgment = `${step.step_id} did not expose enough visible data for a defensible judgment.`;
      break;
    }

    const matchesExpected = evaluateAssertion(step.assertion, observation.observed);

    const evidenceIds = [];
    if (step.evidence_required || !matchesExpected) {
      try {
        const { item, isReuse } = await captureEvidence({
          workspace,
          browser,
          requirement,
          testCase,
          step,
          observation,
          matchesExpected,
          history,
          evidence,
          runId
        });
        if (!isReuse) {
          evidence.push(item);
        }
        evidenceIds.push(item.evidence_id);
      } catch (error) {
        stepResults.push(
          blockedStep(
            step,
            "evidence_capture_failed",
            error.message,
            observation,
            authorizationRef(requirement)
          )
        );
        terminalStatus = "blocked";
        terminalJudgment = `Required evidence for ${step.step_id} could not be captured: ${error.message}`;
        break;
      }
    }

    const stepStatus = matchesExpected ? "passed" : "failed";
    stepResults.push({
      step_id: step.step_id,
      status: stepStatus,
      observed: observation.observed,
      observed_facts: observation.facts ?? [observation.observed],
      evidence_ids: evidenceIds,
      authorization_ref: authorizationRef(requirement),
      blocker: ""
    });
    if (stepStatus === "failed") {
      terminalStatus = "failed";
      terminalJudgment = `${step.step_id} contradicted the expected observation and was captured as evidence.`;
      break;
    }
  }

  const run = {
    result_id: runId,
    retry_of: priorRun?.result_id ?? "",
    case_id: testCase.case_id,
    case_revision: hashJson(testCase),
    status: terminalStatus,
    started_at: startedAt,
    ended_at: new Date().toISOString(),
    environment: requirement.environment.name,
    merchant_scope: requirement.environment.merchant_scope,
    executor: EXECUTOR,
    observed_session: sanitizeSession(session),
    step_results: stepResults,
    judgment: terminalJudgment,
    linked_bug_ids: [],
    residual_risks:
      terminalStatus === "residual_risk" ? [terminalJudgment] : []
  };
  requirement.status = requirementStatusFor(terminalStatus);

  const artifacts = await persistExecution({
    workspace,
    requirementPath,
    requirement,
    history,
    run,
    evidence
  });
  await markPhaseDone(requirement, workspace, PHASES.execute);
  await publishJsonArtifacts([[requirementPath, requirement]]);
  return { status: terminalStatus, workspace, artifacts };
}

async function persistPreflightBlock({
  workspace,
  history,
  requirement,
  requirementPath,
  testCases,
  testCase,
  caseId,
  blocker,
  judgment,
  observedSession = {}
}) {
  const selected = testCase ?? selectCase(testCases.cases, caseId);
  const now = new Date().toISOString();
  const priorRun = findLatestRunForCase(history.runs, selected.case_id);
  const run = {
    result_id: formatId("RUN", history.nextRunIndex),
    retry_of: priorRun?.result_id ?? "",
    case_id: selected.case_id,
    case_revision: hashJson(selected),
    status: "blocked",
    started_at: now,
    ended_at: now,
    environment: requirement.environment.name,
    merchant_scope: requirement.environment.merchant_scope,
    executor: EXECUTOR,
    observed_session: sanitizeSession(observedSession),
    step_results: [],
    judgment,
    linked_bug_ids: [],
    residual_risks: [blocker]
  };
  requirement.status = "blocked";
  const artifacts = await persistExecution({
    workspace,
    requirementPath,
    requirement,
    history,
    run,
    evidence: []
  });
  return { status: "blocked", blocker, workspace, artifacts };
}

function inspectSession(requirement, session) {
  assertObject(session, "browser session inspection");
  if (SESSION_BLOCKERS.has(session.state)) {
    return {
      blocker: session.state,
      judgment: blockerJudgment(session.state)
    };
  }
  if (session.state !== "ready") {
    return { blocker: "session_not_ready", judgment: `Browser session state is ${session.state}.` };
  }
  if (session.environment !== requirement.environment.name) {
    return {
      blocker: "unexpected_environment",
      judgment: `Expected ${requirement.environment.name}, observed ${session.environment}.`
    };
  }
  if (session.merchantScope !== requirement.environment.merchant_scope) {
    return {
      blocker: "unexpected_merchant_scope",
      judgment: `Expected merchant ${requirement.environment.merchant_scope}, observed ${session.merchantScope}.`
    };
  }
  if (session.surface !== "management_backend") {
    return {
      blocker: "unexpected_surface",
      judgment: `Expected management_backend, observed ${session.surface}.`
    };
  }
  return null;
}

async function dispatchReadOnlyOperation(browser, step) {
  if (step.operation === "navigate") {
    requireBrowserMethod(browser, "navigate");
    return browser.navigate(step.operation_target);
  }
  if (step.operation === "filter") {
    requireBrowserMethod(browser, "filter");
    return browser.filter(step.operation_target, step.operation_value);
  }
  if (step.operation === "open_detail") {
    requireBrowserMethod(browser, "openDetail");
    return browser.openDetail(step.operation_target);
  }
  requireBrowserMethod(browser, "readVisible");
  return browser.readVisible(step.operation_target);
}

async function captureEvidence({
  workspace,
  browser,
  requirement,
  testCase,
  step,
  observation,
  matchesExpected,
  history,
  evidence,
  runId
}) {
  requireBrowserMethod(browser, "screenshot");
  const capture = await browser.screenshot({ caseId: testCase.case_id, stepId: step.step_id });
  assertObject(capture, "screenshot capture");
  if (!Buffer.isBuffer(capture.bytes) || capture.bytes.length === 0) {
    throw new Error("Screenshot bytes are missing");
  }
  if (capture.mimeType !== "image/png") throw new Error("Screenshot must be image/png");
  if (!isStructurallyValidPng(capture.bytes)) throw new Error("Screenshot bytes are not a valid PNG");
  const sensitivity = capture.sensitivity ?? "internal";
  const redactionStatus = capture.redactionStatus ?? "required";
  if (!EVIDENCE_SENSITIVITIES.has(sensitivity)) {
    throw new Error(`Screenshot sensitivity ${String(sensitivity)} is invalid`);
  }
  if (!REDACTION_STATUSES.has(redactionStatus)) {
    throw new Error(`Screenshot redaction status ${String(redactionStatus)} is invalid`);
  }
  if (redactionStatus === "required" || (sensitivity === "sensitive" && redactionStatus !== "complete")) {
    throw new Error("Screenshot requires completed redaction before persistence");
  }

  const captureHash = createHash("sha256").update(capture.bytes).digest("hex");
  const description = `${matchesExpected ? "Positive proof" : "Contradictory proof"} for ${step.step_id}: ${observation.observed}`;
  const existing = findExistingEvidence(
    history.evidence,
    evidence,
    captureHash,
    step.step_id,
    description
  );
  if (existing) {
    existing.reused_by_run_ids ??= [];
    if (!existing.reused_by_run_ids.includes(runId)) {
      existing.reused_by_run_ids.push(runId);
    }
    return { item: existing, isReuse: true };
  }

  const evidenceId = formatId("EV", history.nextEvidenceIndex + evidence.length);
  const relativePath = `evidence/${evidenceId}.png`;
  const evidencePath = path.join(workspace, "evidence", `${evidenceId}.png`);
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeBinaryAtomic(evidencePath, capture.bytes);
  const item = {
    evidence_id: evidenceId,
    type: "screenshot",
    path: relativePath,
    captured_at: new Date().toISOString(),
    captured_from: step.target_surface,
    related_case_ids: [testCase.case_id],
    related_bug_ids: [],
    description,
    sensitivity,
    redaction_status: redactionStatus,
    hash: captureHash,
    requirement_id: requirement.requirement_id,
    step_id: step.step_id,
    reused_by_run_ids: []
  };
  return { item, isReuse: false };
}

async function persistExecution({ workspace, requirementPath, requirement, history, run, evidence }) {
  const executionResults = path.join(workspace, "execution-results.json");
  const evidenceManifest = path.join(workspace, "evidence-manifest.json");
  await publishJsonArtifacts([
    [executionResults, { requirement_id: requirement.requirement_id, runs: [...history.runs, run] }],
    [evidenceManifest, { requirement_id: requirement.requirement_id, evidence: [...history.evidence, ...evidence] }],
    [requirementPath, requirement]
  ]);
  return { executionResults, evidenceManifest, evidenceDirectory: path.join(workspace, "evidence") };
}

async function persistReleaseFailure(result, error) {
  if (!result?.artifacts?.executionResults) throw error;
  const execution = await readJson(result.artifacts.executionResults);
  const requirementPath = path.join(result.workspace, "requirement.json");
  const requirement = await readJson(requirementPath);
  const run = execution.runs.at(-1);
  run.status = "blocked";
  run.judgment = `Browser ownership could not be released safely: ${error.message}`;
  run.residual_risks = unique([...(run.residual_risks ?? []), "browser_release_failed"]);
  requirement.status = "blocked";
  await publishJsonArtifacts([
    [result.artifacts.executionResults, execution],
    [requirementPath, requirement]
  ]);
  return { ...result, status: "blocked", blocker: "browser_release_failed" };
}

function selectCase(cases, caseId) {
  if (!Array.isArray(cases) || cases.length === 0) throw new Error("No executable test case exists");
  const selected = caseId ? cases.find((testCase) => testCase.case_id === caseId) : cases[0];
  if (!selected) throw new Error(`Test case ${caseId} does not exist`);
  return selected;
}

function isValidAssertion(assertion) {
  if (!assertion || typeof assertion !== "object" || Array.isArray(assertion)) return false;
  if (!ASSERTION_OPERATORS.has(assertion.operator) || !nonEmpty(assertion.expected)) return false;
  if (assertion.operator === "matches_regex") {
    try {
      new RegExp(assertion.expected);
    } catch {
      return false;
    }
  }
  return true;
}

function evaluateAssertion(assertion, observed) {
  if (assertion.operator === "equals") return observed === assertion.expected;
  if (assertion.operator === "contains") return observed.includes(assertion.expected);
  return new RegExp(assertion.expected).test(observed);
}

function isStructurallyValidPng(bytes) {
  return (
    bytes.length > PNG_SIGNATURE.length + PNG_IEND.length &&
    bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) &&
    bytes.subarray(bytes.length - PNG_IEND.length).equals(PNG_IEND)
  );
}

function sanitizeSession(session) {
  return {
    state: session.state ?? "unknown",
    environment: session.environment ?? "",
    merchant_scope: session.merchantScope ?? "",
    surface: session.surface ?? ""
  };
}

function blockedStep(step, blocker, message, observation = {}, authorization = "") {
  return {
    step_id: step.step_id,
    status: "blocked",
    observed: observation.observed ?? "",
    observed_facts: observation.facts ?? [],
    evidence_ids: [],
    authorization_ref: authorization,
    blocker,
    error: message
  };
}

function classifyBrowserError(error) {
  const code = String(error?.code ?? "").toLowerCase();
  if (SESSION_BLOCKERS.has(code)) return code;
  return "browser_action_failed";
}

function blockerJudgment(blocker, detail = "") {
  const labels = {
    expired: "The prepared browser session expired.",
    login_required: "The browser returned to a login challenge.",
    otp_required: "The browser requires a human-owned OTP challenge.",
    captcha_required: "The browser requires a human-owned CAPTCHA challenge.",
    device_verification_required: "The browser requires human-owned device verification.",
    browser_action_failed: "A read-only browser action failed."
  };
  return `${labels[blocker] ?? `Browser execution blocked: ${blocker}.`}${detail ? ` ${detail}` : ""}`;
}

function requirementStatusFor(caseStatus) {
  if (caseStatus === "passed") return "passed";
  if (caseStatus === "failed") return "has_bugs";
  return "blocked";
}

function authorizationRef(requirement) {
  return `prepared-session:${requirement.environment.name}:${requirement.environment.merchant_scope}`;
}

function requireBrowserMethod(browser, method) {
  if (typeof browser[method] !== "function") throw new Error(`Browser capability ${method} is missing`);
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim() !== "";
}

function unique(values) {
  return [...new Set(values)];
}

function formatId(prefix, zeroBasedIndex) {
  return `${prefix}-${String(zeroBasedIndex + 1).padStart(3, "0")}`;
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function findLatestRunForCase(runs, caseId) {
  if (!Array.isArray(runs)) return null;
  return [...runs].reverse().find((run) => run.case_id === caseId) ?? null;
}

function deriveResumePoint(steps, priorRun) {
  if (!priorRun || !Array.isArray(priorRun.step_results) || priorRun.step_results.length === 0) {
    return { resumeStepIndex: 0, copiedStepResults: [] };
  }
  const copiedStepResults = [];
  let resumeStepIndex = 0;
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    const priorStep = priorRun.step_results[index];
    if (priorStep && priorStep.step_id === step.step_id && priorStep.status === "passed") {
      copiedStepResults.push(priorStep);
      resumeStepIndex = index + 1;
    } else {
      break;
    }
  }
  return { resumeStepIndex, copiedStepResults };
}

function findExistingEvidence(historyEvidence, newEvidence, hash, stepId, description) {
  const allEvidence = [...(historyEvidence ?? []), ...(newEvidence ?? [])];
  return (
    allEvidence.find(
      (item) =>
        item.hash === hash &&
        item.step_id === stepId &&
        item.description === description &&
        item.evidence_id
    ) ??
    null
  );
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readExecutionHistory(workspace, requirementId) {
  const execution = await readJsonIfExists(path.join(workspace, "execution-results.json"));
  const manifest = await readJsonIfExists(path.join(workspace, "evidence-manifest.json"));
  if ((execution && !manifest) || (!execution && manifest)) {
    throw new Error("Execution history is incomplete; results and evidence manifest must coexist");
  }
  if (!execution) {
    return {
      runs: [],
      evidence: [],
      nextRunIndex: 0,
      nextEvidenceIndex: await nextEvidenceIndex(workspace, [])
    };
  }
  if (
    execution.requirement_id !== requirementId ||
    manifest.requirement_id !== requirementId ||
    !Array.isArray(execution.runs) ||
    !Array.isArray(manifest.evidence)
  ) {
    throw new Error("Execution history does not match the current requirement contract");
  }
  for (const evidence of manifest.evidence) {
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
  const runIndexes = [];
  const runIds = new Set();
  for (const run of execution.runs) {
    const match = /^RUN-(\d{3})$/.exec(run.result_id);
    if (!match || runIds.has(run.result_id)) {
      throw new Error(`Execution history has invalid or duplicate run ID ${String(run.result_id)}`);
    }
    runIds.add(run.result_id);
    runIndexes.push(Number(match[1]));
  }
  return {
    runs: execution.runs,
    evidence: manifest.evidence,
    nextRunIndex: runIndexes.length === 0 ? 0 : Math.max(...runIndexes),
    nextEvidenceIndex: await nextEvidenceIndex(workspace, manifest.evidence)
  };
}

async function nextEvidenceIndex(workspace, manifestEvidence) {
  const indexes = manifestEvidence
    .map((item) => /^EV-(\d{3})$/.exec(item.evidence_id)?.[1])
    .filter(Boolean)
    .map(Number);
  try {
    const files = await readdir(path.join(workspace, "evidence"));
    for (const file of files) {
      const match = /^EV-(\d{3})\.[a-z0-9]+$/i.exec(file);
      if (match) indexes.push(Number(match[1]));
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return indexes.length === 0 ? 0 : Math.max(...indexes);
}

async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(tempPath, filePath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

async function writeBinaryAtomic(filePath, value) {
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, value);
    await rename(tempPath, filePath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

async function acquireSessionLease(workspace, sessionIdentity) {
  const leaseDirectory = path.join(path.dirname(workspace), ".qa-browser-leases");
  await mkdir(leaseDirectory, { recursive: true });
  const identityHash = createHash("sha256").update(sessionIdentity).digest("hex");
  const leasePath = path.join(leaseDirectory, `${identityHash}.lock`);
  let handle;
  try {
    handle = await open(leasePath, "wx");
    await handle.writeFile(
      `${JSON.stringify({ owner: EXECUTOR, identity_hash: identityHash, acquired_at: new Date().toISOString() })}\n`,
      "utf8"
    );
    return { handle, leasePath };
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (error.code === "EEXIST") throw new Error("Live browser session is already leased by main_agent");
    throw error;
  }
}

async function releaseSessionLease({ handle, leasePath }) {
  await handle.close().catch(() => undefined);
  await rm(leasePath, { force: true });
}

async function publishJsonArtifacts(entries) {
  const prepared = entries.map(([filePath, value]) => ({
    filePath,
    tempPath: `${filePath}.${randomUUID()}.tmp`,
    contents: `${JSON.stringify(value, null, 2)}\n`
  }));
  try {
    await Promise.all(prepared.map((item) => writeFile(item.tempPath, item.contents, "utf8")));
    for (const item of prepared) await rename(item.tempPath, item.filePath);
  } finally {
    await Promise.all(prepared.map((item) => rm(item.tempPath, { force: true }).catch(() => undefined)));
  }
}

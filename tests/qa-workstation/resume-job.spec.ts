import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { runAuthorizedBrowserCase } from "../../src/qa-workstation/authorized-browser-execution.mjs";
import { runClosingJob } from "../../src/qa-workstation/closing-job.mjs";
import { runQuestionGateJob } from "../../src/qa-workstation/question-gate-job.mjs";
import { runReadOnlyPlanningJob } from "../../src/qa-workstation/read-only-planning-job.mjs";
import { inspectQaJobState, resumeQaJob } from "../../src/qa-workstation/resume-job.mjs";
import { runQaWorkstation, validateTerminalPackage } from "../../src/qa-workstation/workstation-runner.mjs";

test.describe("resume and retry from durable QA state", () => {
  test("phase reconstruction follows artifact completeness instead of narration", async ({}, testInfo) => {
    const intake = await createIntake(testInfo, "phase-reconstruction");
    await expect(inspectQaJobState({ workspace: intake.workspace })).resolves.toMatchObject({ phase: "design" });

    await runReadOnlyPlanningJob({ workspace: intake.workspace, plan: validPlan() });
    await expect(inspectQaJobState({ workspace: intake.workspace })).resolves.toMatchObject({ phase: "execution" });

    await runAuthorizedBrowserCase({ workspace: intake.workspace, browser: controlledBrowser() });
    await expect(inspectQaJobState({ workspace: intake.workspace })).resolves.toMatchObject({ phase: "synthesis" });

    await runClosingJob({ workspace: intake.workspace, workspaceRoot: path.dirname(intake.workspace) });
    await expect(inspectQaJobState({ workspace: intake.workspace })).resolves.toMatchObject({ phase: "complete" });
  });

  test("a job interrupted in browser execution revalidates the session and closes", async ({}, testInfo) => {
    const intake = await createPlannedJob(testInfo, "browser-interruption");
    const requirement = await readJson(intake.artifacts.requirement);
    requirement.status = "testing";
    await writeJson(intake.artifacts.requirement, requirement);
    const browser = controlledBrowser();

    const result = await resumeQaJob({
      workspace: intake.workspace,
      workspaceRoot: path.dirname(intake.workspace),
      browser
    });

    expect(result).toMatchObject({ status: "passed", phase: "complete" });
    expect(browser.calls).toContainEqual(["inspect_session"]);
    await expect(access(path.join(intake.workspace, "test-report.html"))).resolves.toBeUndefined();
    await expect(access(path.join(intake.workspace, "retrospective.json"))).resolves.toBeUndefined();
  });

  test("retrying a blocked case appends a linked run and preserves the blocker", async ({}, testInfo) => {
    const intake = await createPlannedJob(testInfo, "blocked-retry");
    const blockedBrowser = controlledBrowser({ sessionState: "expired" });
    const blocked = await runAuthorizedBrowserCase({ workspace: intake.workspace, browser: blockedBrowser });
    expect(blocked.status).toBe("blocked");

    const result = await resumeQaJob({
      workspace: intake.workspace,
      workspaceRoot: path.dirname(intake.workspace),
      browser: controlledBrowser()
    });
    const execution = await readJson(result.artifacts.executionResults);

    expect(result.phase).toBe("complete");
    expect(execution.runs.map((run) => run.result_id)).toEqual(["RUN-001", "RUN-002"]);
    expect(execution.runs[0].status).toBe("blocked");
    expect(execution.runs[1]).toMatchObject({ status: "passed", retry_of: "RUN-001" });
  });

  test("orphan evidence from an interrupted capture is not reused or put in the manifest", async ({}, testInfo) => {
    const intake = await createPlannedJob(testInfo, "orphan-evidence");
    const evidenceDir = path.join(intake.workspace, "evidence");
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(path.join(evidenceDir, "EV-001.png"), fixturePng());
    const requirement = await readJson(intake.artifacts.requirement);
    requirement.status = "testing";
    await writeJson(intake.artifacts.requirement, requirement);

    const result = await resumeQaJob({
      workspace: intake.workspace,
      workspaceRoot: path.dirname(intake.workspace),
      browser: controlledBrowser()
    });
    const manifest = await readJson(result.artifacts.evidenceManifest);

    expect(manifest.evidence.map((item) => item.evidence_id)).toEqual(["EV-002"]);
    await expect(access(path.join(evidenceDir, "EV-001.png"))).resolves.toBeUndefined();
    await expect(access(path.join(evidenceDir, "EV-002.png"))).resolves.toBeUndefined();
  });

  test("partial synthesis regenerates missing views without touching the browser", async ({}, testInfo) => {
    const intake = await createCompleteJob(testInfo, "synthesis-resume");
    await runClosingJob({
      workspace: intake.workspace,
      workspaceRoot: path.dirname(intake.workspace),
      retrospective: {
        workflow_findings: [{
          type: "automation_candidate",
          finding: "Resume report generation from authoritative JSON.",
          reuse_scope: "gaming_domain",
          confidence: "confirmed",
          recommended_update: "Keep synthesis idempotent."
        }],
        new_heuristics: [],
        do_not_generalize: []
      }
    });
    const reportPath = path.join(intake.workspace, "test-report.html");
    const retrospectivePath = path.join(intake.workspace, "retrospective.json");
    await rm(reportPath);
    const retrospectiveBefore = await readFile(retrospectivePath, "utf8");
    const browser = forbiddenBrowser();

    const result = await resumeQaJob({
      workspace: intake.workspace,
      workspaceRoot: path.dirname(intake.workspace),
      browser
    });

    expect(result).toMatchObject({ phase: "complete", status: "passed" });
    expect(browser.calls).toEqual([]);
    await expect(access(reportPath)).resolves.toBeUndefined();
    await expect(access(retrospectivePath)).resolves.toBeUndefined();
    expect(await readFile(retrospectivePath, "utf8")).toBe(retrospectiveBefore);
  });

  test("resuming an already complete job is idempotent and performs no browser action", async ({}, testInfo) => {
    const intake = await createCompleteJob(testInfo, "complete-idempotency");
    const reportPath = path.join(intake.workspace, "test-report.html");
    const beforeHash = await hashFile(reportPath);
    const browser = forbiddenBrowser();

    const result = await resumeQaJob({
      workspace: intake.workspace,
      workspaceRoot: path.dirname(intake.workspace),
      browser
    });

    expect(result).toMatchObject({ phase: "complete", resumed: false });
    expect(browser.calls).toEqual([]);
    expect(await hashFile(reportPath)).toBe(beforeHash);
  });

  test("intake and partial design interruptions resume from their earliest durable gate", async ({}, testInfo) => {
    const intakeRoot = testInfo.outputPath("intake-jobs");
    const intakeRaw = rawJob("intake-interruption");
    const intakeWorkspace = path.join(intakeRoot, intakeRaw.requirementId);
    await mkdir(intakeWorkspace, { recursive: true });

    const intakeResult = await resumeQaJob({
      workspace: intakeWorkspace,
      workspaceRoot: intakeRoot,
      rawJob: intakeRaw,
      plan: validPlan(),
      browser: controlledBrowser()
    });
    expect(intakeResult).toMatchObject({ phase: "complete", status: "passed" });
    expect(intakeResult.actions).toEqual([
      "intake",
      "design",
      "execution:TC-001:passed",
      "synthesis"
    ]);

    const partial = await createIntake(testInfo, "partial-design");
    await writeJson(path.join(partial.workspace, "strategy.json"), { partial: true });
    const partialResult = await resumeQaJob({
      workspace: partial.workspace,
      workspaceRoot: path.dirname(partial.workspace),
      plan: validPlan(),
      browser: controlledBrowser()
    });
    expect(partialResult).toMatchObject({ phase: "complete", status: "passed" });
    const recoveredFiles = await readdir(path.join(partial.workspace, ".recovery"));
    expect(recoveredFiles.some((name) => name.endsWith("-strategy.json"))).toBe(true);

    const splitIntake = await createIntake(testInfo, "split-intake-publication");
    await rm(splitIntake.artifacts.questions);
    const splitResult = await resumeQaJob({
      workspace: splitIntake.workspace,
      workspaceRoot: path.dirname(splitIntake.workspace),
      rawJob: rawJob("split-intake-publication"),
      plan: validPlan(),
      browser: controlledBrowser()
    });
    expect(splitResult).toMatchObject({ phase: "complete", status: "passed" });
  });

  test("retrying a failed case preserves the contradictory observation in the final report", async ({}, testInfo) => {
    const intake = await createPlannedJob(testInfo, "failed-retry");
    const failingBrowser = controlledBrowser({ observed: "Tier summary is contradictory" });
    const failed = await runAuthorizedBrowserCase({ workspace: intake.workspace, browser: failingBrowser });
    expect(failed.status).toBe("failed");

    const result = await resumeQaJob({
      workspace: intake.workspace,
      workspaceRoot: path.dirname(intake.workspace),
      browser: controlledBrowser(),
      retryFailed: true
    });
    const execution = await readJson(result.artifacts.executionResults);
    const report = await readFile(result.artifacts.testReport, "utf8");
    const bugs = await readJson(result.artifacts.bugs);

    expect(execution.runs.map((run) => run.status)).toEqual(["failed", "passed"]);
    expect(execution.runs[1].retry_of).toBe("RUN-001");
    expect(bugs.bugs[0]).toMatchObject({ status: "closed", regression_result: "passed:RUN-002" });
    expect(report).toContain("Tier summary is contradictory");
  });

  test("tampered evidence prevents a completed job from being trusted", async ({}, testInfo) => {
    const intake = await createCompleteJob(testInfo, "tampered-evidence");
    await writeFile(path.join(intake.workspace, "evidence", "EV-001.png"), Buffer.from("tampered"));

    await expect(inspectQaJobState({ workspace: intake.workspace })).rejects.toThrow(
      /evidence EV-001 hash does not match/i
    );
  });

  test("a fully closed failed job can append a regression run when explicitly requested", async ({}, testInfo) => {
    const intake = await createPlannedJob(testInfo, "closed-failed-retry");
    await runAuthorizedBrowserCase({
      workspace: intake.workspace,
      browser: controlledBrowser({ observed: "Tier summary is contradictory" })
    });
    await runClosingJob({ workspace: intake.workspace, workspaceRoot: path.dirname(intake.workspace) });

    const result = await resumeQaJob({
      workspace: intake.workspace,
      workspaceRoot: path.dirname(intake.workspace),
      browser: controlledBrowser(),
      retryFailed: true
    });
    const execution = await readJson(result.artifacts.executionResults);

    expect(result).toMatchObject({ phase: "complete", status: "passed" });
    expect(execution.runs.map((run) => run.status)).toEqual(["failed", "passed"]);
    expect(execution.runs[1].retry_of).toBe("RUN-001");
  });

  test("a partial execution artifact pair is archived before safe re-execution", async ({}, testInfo) => {
    const intake = await createPlannedJob(testInfo, "partial-execution-pair");
    await writeJson(path.join(intake.workspace, "execution-results.json"), {
      requirement_id: `REQ-20260711-partial-execution-pair`,
      runs: []
    });
    await setStatus(intake.artifacts.requirement, "testing");

    const result = await resumeQaJob({
      workspace: intake.workspace,
      workspaceRoot: path.dirname(intake.workspace),
      browser: controlledBrowser()
    });
    const recovered = await readdir(path.join(intake.workspace, ".recovery"));

    expect(result).toMatchObject({ phase: "complete", status: "passed" });
    expect(recovered.some((name) => name.endsWith("-execution-results.json"))).toBe(true);
  });

  test("terminal runs repair a stale testing status without requiring a browser", async ({}, testInfo) => {
    const intake = await createPlannedJob(testInfo, "status-only-repair");
    await runAuthorizedBrowserCase({ workspace: intake.workspace, browser: controlledBrowser() });
    await setStatus(intake.artifacts.requirement, "testing");

    const result = await resumeQaJob({
      workspace: intake.workspace,
      workspaceRoot: path.dirname(intake.workspace)
    });

    expect(result).toMatchObject({ phase: "complete", status: "passed" });
  });

  test("tampered design returns to design while stale authorization is refused", async ({}, testInfo) => {
    const designIntake = await createPlannedJob(testInfo, "tampered-design");
    const casesPath = path.join(designIntake.workspace, "test-cases.json");
    const cases = await readJson(casesPath);
    cases.cases[0].steps[0].action_class = "confirm_before_action";
    await writeJson(casesPath, cases);
    await expect(inspectQaJobState({ workspace: designIntake.workspace })).resolves.toMatchObject({
      phase: "design",
      status: "invalid"
    });
    const repaired = await resumeQaJob({
      workspace: designIntake.workspace,
      workspaceRoot: path.dirname(designIntake.workspace),
      plan: validPlan(),
      browser: controlledBrowser()
    });
    expect(repaired).toMatchObject({ phase: "complete", status: "passed" });

    const authIntake = await createPlannedJob(testInfo, "tampered-authorization");
    const executed = await runAuthorizedBrowserCase({
      workspace: authIntake.workspace,
      browser: controlledBrowser()
    });
    const execution = await readJson(executed.artifacts.executionResults);
    execution.runs[0].step_results[0].authorization_ref = "prepared-session:UAT:another-merchant";
    await writeJson(executed.artifacts.executionResults, execution);
    await expect(inspectQaJobState({ workspace: authIntake.workspace })).rejects.toThrow(
      /missing or stale authorization reference/i
    );
  });

  test("a stale report commit is regenerated and sparse run IDs do not collide", async ({}, testInfo) => {
    const stale = await createCompleteJob(testInfo, "stale-closing-output");
    const reportPath = path.join(stale.workspace, "test-report.html");
    await writeFile(reportPath, "stale report", "utf8");
    await expect(inspectQaJobState({ workspace: stale.workspace })).resolves.toMatchObject({
      phase: "synthesis"
    });
    const repaired = await resumeQaJob({
      workspace: stale.workspace,
      workspaceRoot: path.dirname(stale.workspace)
    });
    expect(await readFile(repaired.artifacts.testReport, "utf8")).toContain(
      "REQ-20260711-stale-closing-output"
    );

    const sparse = await createPlannedJob(testInfo, "sparse-run-history");
    const sparseCases = await readJson(path.join(sparse.workspace, "test-cases.json"));
    const executionPath = path.join(sparse.workspace, "execution-results.json");
    const manifestPath = path.join(sparse.workspace, "evidence-manifest.json");
    await writeJson(executionPath, {
      requirement_id: "REQ-20260711-sparse-run-history",
      runs: [{
        result_id: "RUN-002",
        retry_of: "",
        case_id: "TC-001",
        case_revision: createHash("sha256").update(JSON.stringify(sparseCases.cases[0])).digest("hex"),
        status: "blocked",
        started_at: "2026-07-11T00:00:00.000Z",
        ended_at: "2026-07-11T00:00:01.000Z",
        environment: "UAT",
        merchant_scope: "merchant-7788",
        executor: "main_agent",
        observed_session: {},
        step_results: [],
        judgment: "Session expired",
        linked_bug_ids: [],
        residual_risks: ["expired"]
      }]
    });
    await writeJson(manifestPath, {
      requirement_id: "REQ-20260711-sparse-run-history",
      evidence: []
    });
    await setStatus(sparse.artifacts.requirement, "blocked");
    const sparseResult = await resumeQaJob({
      workspace: sparse.workspace,
      workspaceRoot: path.dirname(sparse.workspace),
      browser: controlledBrowser()
    });
    const sparseExecution = await readJson(sparseResult.artifacts.executionResults);
    expect(sparseExecution.runs.map((run) => run.result_id)).toEqual(["RUN-002", "RUN-003"]);
  });

  test("one high-level entry point runs raw input to a certified terminal package", async ({}, testInfo) => {
    const raw = rawJob("certified-entrypoint");
    const workspaceRoot = testInfo.outputPath("jobs");
    const result = await runQaWorkstation({
      workspaceRoot,
      workspace: path.join(workspaceRoot, raw.requirementId),
      rawJob: raw,
      plan: validPlan(),
      browser: controlledBrowser()
    });

    expect(result.status).toBe("passed");
    expect(result.acceptance).toMatchObject({
      product_status: "passed",
      workstation_status: "passed",
      human_next_action: null,
      unattended_after_start: true
    });
    await expect(access(result.artifacts.acceptanceRecord)).resolves.toBeUndefined();

    const execution = await readJson(result.artifacts.executionResults);
    execution.runs[0].step_results[0].evidence_ids = ["EV-999"];
    await writeJson(result.artifacts.executionResults, execution);
    await expect(validateTerminalPackage(result.workspace)).resolves.toMatchObject({ valid: false });
  });

  test("design revision, evidence hash, and closing manifest completeness are mandatory", async ({}, testInfo) => {
    const completed = await createCompleteJob(testInfo, "integrity-contract");
    const casesPath = path.join(completed.workspace, "test-cases.json");
    const cases = await readJson(casesPath);
    const originalExpected = cases.cases[0].steps[0].assertion.expected;
    cases.cases[0].steps[0].assertion.expected = "changed expectation";
    await writeJson(casesPath, cases);
    await expect(inspectQaJobState({ workspace: completed.workspace })).rejects.toThrow(/current test design/);

    const evidence = await readJson(path.join(completed.workspace, "evidence-manifest.json"));
    cases.cases[0].steps[0].assertion.expected = originalExpected;
    await writeJson(casesPath, cases);
    delete evidence.evidence[0].hash;
    await writeJson(path.join(completed.workspace, "evidence-manifest.json"), evidence);
    await expect(inspectQaJobState({ workspace: completed.workspace })).rejects.toThrow(/hash/);

    const intact = await createCompleteJob(testInfo, "manifest-contract");
    const closing = await readJson(path.join(intact.workspace, "closing-manifest.json"));
    closing.source_revisions = [];
    closing.outputs = [];
    await writeJson(path.join(intact.workspace, "closing-manifest.json"), closing);
    await expect(inspectQaJobState({ workspace: intact.workspace })).resolves.toMatchObject({ phase: "synthesis" });
  });
});

async function createIntake(testInfo, suffix: string) {
  return runQuestionGateJob({
    workspaceRoot: testInfo.outputPath("jobs"),
    rawJob: rawJob(suffix)
  });
}

async function createPlannedJob(testInfo, suffix: string) {
  const intake = await createIntake(testInfo, suffix);
  await runReadOnlyPlanningJob({ workspace: intake.workspace, plan: validPlan() });
  return intake;
}

async function createCompleteJob(testInfo, suffix: string) {
  const intake = await createPlannedJob(testInfo, suffix);
  await runAuthorizedBrowserCase({ workspace: intake.workspace, browser: controlledBrowser() });
  await runClosingJob({ workspace: intake.workspace, workspaceRoot: path.dirname(intake.workspace) });
  return intake;
}

function rawJob(suffix: string) {
  return {
    requirementId: `REQ-20260711-${suffix}`,
    title: "Resumable member tier check",
    description: "Verify a visible member-tier summary.",
    environment: {
      name: "UAT",
      managementBackendUrl: "https://uat.example.test/admin",
      merchantScope: "merchant-7788",
      knownSessionState: "user_ready"
    },
    businessSurface: {
      productSurfaces: ["management_backend"],
      modules: ["member"],
      managementBackendPaths: ["Member tier > Summary"]
    },
    confirmedRules: [{
      ruleId: "RULE-001",
      text: "The selected member tier summary remains visible and consistent.",
      riskArea: "permission",
      passFailImpact: "high"
    }]
  };
}

function validPlan() {
  return {
    strategy: {
      scope: { inScope: ["Member tier summary"], outOfScope: [], blockedScope: [] },
      frontendBackendMapping: [{
        h5Capability: "Tier display",
        managementBackendModule: "Member tier",
        sharedBusinessObject: "Member tier",
        qaFocus: "Visible summary consistency"
      }],
      riskMatrix: [{
        area: "permission",
        risk: "high",
        whyItMatters: "Member scope must stay isolated.",
        coverage: "P0"
      }],
      automationPriority: "P0",
      minimalLoopPosition: ["member_attribution"],
      evidenceExpectations: ["Visible tier summary"]
    },
    cases: [{
      title: "Read member tier summary",
      ruleIds: ["RULE-001"],
      priority: "P0",
      riskArea: "permission",
      preconditions: ["Prepared UAT session"],
      testData: [],
      steps: [{
        action: "Read member tier summary",
        actionClass: "read_only",
        targetSurface: "management_backend",
        operation: "read_visible",
        operationTarget: "Tier summary",
        assertion: { operator: "equals", expected: "Tier summary is consistent" },
        expectedObservation: "Tier summary is consistent",
        evidenceRequired: true
      }],
      expectedResult: "Tier summary is consistent.",
      evidenceRequired: ["Visible tier summary"],
      evidenceExpectationRefs: ["Visible tier summary"],
      residualRiskIfNotRun: "Tier consistency remains unknown."
    }]
  };
}

function controlledBrowser(options: { sessionState?: string; observed?: string } = {}) {
  const calls: unknown[] = [];
  return {
    calls,
    async sessionIdentity() { calls.push(["session_identity"]); return `resume-${Math.random()}`; },
    async claim() { calls.push(["claim", "main_agent"]); return true; },
    async release() { calls.push(["release", "main_agent"]); },
    async inspectSession() {
      calls.push(["inspect_session"]);
      return {
        state: options.sessionState ?? "ready",
        environment: "UAT",
        merchantScope: "merchant-7788",
        surface: "management_backend"
      };
    },
    async readVisible() {
      calls.push(["read_visible", "Tier summary"]);
      const observed = options.observed ?? "Tier summary is consistent";
      return { visible: true, observed, facts: [observed] };
    },
    async screenshot({ stepId }) {
      calls.push(["screenshot", stepId]);
      return {
        bytes: fixturePng(),
        mimeType: "image/png",
        sensitivity: "internal",
        redactionStatus: "not_needed"
      };
    }
  };
}

function forbiddenBrowser() {
  return {
    calls: [],
    async sessionIdentity() { throw new Error("complete resume must not touch browser"); }
  };
}

function fixturePng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nYQAAAAASUVORK5CYII=",
    "base64"
  );
}

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function setStatus(requirementPath: string, status: string) {
  const requirement = await readJson(requirementPath);
  requirement.status = status;
  await writeJson(requirementPath, requirement);
}

async function hashFile(filePath: string) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

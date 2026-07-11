import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { runAuthorizedBrowserCase } from "../../src/qa-workstation/authorized-browser-execution.mjs";
import { runQuestionGateJob } from "../../src/qa-workstation/question-gate-job.mjs";
import { runReadOnlyPlanningJob } from "../../src/qa-workstation/read-only-planning-job.mjs";

test.describe("authorized read-only browser execution", () => {
  test("one prepared UAT case produces positive observations and stable screenshot evidence", async ({}, testInfo) => {
    const intake = await prepareExecutableJob(testInfo, "passing-browser-case");
    const browser = createControlledBrowser();

    const result = await runAuthorizedBrowserCase({ workspace: intake.workspace, browser });

    expect(result.status).toBe("passed");
    expect(browser.calls).toEqual([
      ["session_identity"],
      ["claim", "main_agent"],
      ["inspect_session"],
      ["navigate", "/members/tiers"],
      ["filter", "Tier", "Tier 1"],
      ["open_detail", "Tier 1 members"],
      ["read_visible", "Member tier summary"],
      ["screenshot", "STEP-004"],
      ["release", "main_agent"]
    ]);

    const requirement = JSON.parse(await readFile(intake.artifacts.requirement, "utf8"));
    const execution = JSON.parse(await readFile(result.artifacts.executionResults, "utf8"));
    const manifest = JSON.parse(await readFile(result.artifacts.evidenceManifest, "utf8"));

    expect(requirement.status).toBe("passed");
    expect(execution.runs).toHaveLength(1);
    expect(execution.runs[0]).toMatchObject({
      result_id: "RUN-001",
      case_id: "TC-001",
      status: "passed",
      environment: "UAT",
      merchant_scope: "merchant-7788",
      executor: "main_agent",
      judgment: "All expected read-only observations were positively verified."
    });
    expect(execution.runs[0].started_at).toMatch(/^2026-|^2027-/);
    expect(execution.runs[0].ended_at).toMatch(/^2026-|^2027-/);
    expect(execution.runs[0].step_results).toHaveLength(4);
    expect(execution.runs[0].step_results[3]).toMatchObject({
      step_id: "STEP-004",
      status: "passed",
      observed: "Tier 1, 12 visible members, total 12",
      evidence_ids: ["EV-001"]
    });
    expect(manifest.evidence).toEqual([
      expect.objectContaining({
        evidence_id: "EV-001",
        type: "screenshot",
        path: "evidence/EV-001.png",
        captured_from: "management_backend",
        related_case_ids: ["TC-001"],
        description: "Positive proof for STEP-004: Tier 1, 12 visible members, total 12",
        sensitivity: "internal",
        redaction_status: "not_needed"
      })
    ]);
    expect(manifest.evidence[0].hash).toMatch(/^[a-f0-9]{64}$/);
    await expect(access(path.join(intake.workspace, manifest.evidence[0].path))).resolves.toBeUndefined();
  });

  test("an unexpected environment or merchant is blocked before browser actions", async ({}, testInfo) => {
    const intake = await prepareExecutableJob(testInfo, "unexpected-scope");
    const browser = createControlledBrowser();
    browser.inspectSession = async () => {
      browser.calls.push(["inspect_session"]);
      return {
        state: "ready",
        environment: "PROD",
        merchantScope: "another-merchant",
        surface: "management_backend"
      };
    };

    const result = await runAuthorizedBrowserCase({ workspace: intake.workspace, browser });
    const execution = JSON.parse(await readFile(result.artifacts.executionResults, "utf8"));

    expect(result).toMatchObject({ status: "blocked", blocker: "unexpected_environment" });
    expect(browser.calls).toEqual([
      ["session_identity"],
      ["claim", "main_agent"],
      ["inspect_session"],
      ["release", "main_agent"]
    ]);
    expect(execution.runs[0]).toMatchObject({
      status: "blocked",
      step_results: [],
      residual_risks: ["unexpected_environment"]
    });

    const merchantIntake = await prepareExecutableJob(testInfo, "unexpected-merchant");
    const merchantBrowser = createControlledBrowser();
    merchantBrowser.inspectSession = async () => ({
      state: "ready",
      environment: "UAT",
      merchantScope: "another-merchant",
      surface: "management_backend"
    });
    await expect(
      runAuthorizedBrowserCase({ workspace: merchantIntake.workspace, browser: merchantBrowser })
    ).resolves.toMatchObject({ status: "blocked", blocker: "unexpected_merchant_scope" });

    const surfaceIntake = await prepareExecutableJob(testInfo, "unexpected-surface");
    const surfaceBrowser = createControlledBrowser();
    surfaceBrowser.inspectSession = async () => ({
      state: "ready",
      environment: "UAT",
      merchantScope: "merchant-7788",
      surface: "h5_frontend"
    });
    await expect(
      runAuthorizedBrowserCase({ workspace: surfaceIntake.workspace, browser: surfaceBrowser })
    ).resolves.toMatchObject({ status: "blocked", blocker: "unexpected_surface" });
  });

  test("missing expected environment scope and failed session inspection stop safely", async ({}, testInfo) => {
    const missingScope = await prepareExecutableJob(testInfo, "missing-expected-scope");
    const requirement = JSON.parse(await readFile(missingScope.artifacts.requirement, "utf8"));
    requirement.environment.merchant_scope = "";
    await writeFile(
      missingScope.artifacts.requirement,
      `${JSON.stringify(requirement, null, 2)}\n`,
      "utf8"
    );
    await expect(
      runAuthorizedBrowserCase({ workspace: missingScope.workspace, browser: createControlledBrowser() })
    ).resolves.toMatchObject({ status: "blocked", blocker: "missing_expected_scope" });

    const inspectionFailure = await prepareExecutableJob(testInfo, "inspection-failure");
    const browser = createControlledBrowser();
    browser.inspectSession = async () => {
      throw Object.assign(new Error("tab disconnected"), { code: "BROWSER_DISCONNECTED" });
    };
    await expect(
      runAuthorizedBrowserCase({ workspace: inspectionFailure.workspace, browser })
    ).resolves.toMatchObject({ status: "blocked", blocker: "session_inspection_failed" });
  });

  test("a contradictory visible fact is captured before the case fails", async ({}, testInfo) => {
    const intake = await prepareExecutableJob(testInfo, "contradictory-fact");
    const browser = createControlledBrowser();
    browser.readVisible = async (target) => {
      browser.calls.push(["read_visible", target]);
      return {
        visible: true,
        matchesExpected: true,
        observed: "Tier 1 shows 12 total but only 11 visible members",
        facts: ["selected tier Tier 1", "total 12", "visible rows 11"]
      };
    };

    const result = await runAuthorizedBrowserCase({ workspace: intake.workspace, browser });
    const requirement = JSON.parse(await readFile(intake.artifacts.requirement, "utf8"));
    const execution = JSON.parse(await readFile(result.artifacts.executionResults, "utf8"));
    const manifest = JSON.parse(await readFile(result.artifacts.evidenceManifest, "utf8"));

    expect(result.status).toBe("failed");
    expect(requirement.status).toBe("has_bugs");
    expect(execution.runs[0].step_results[3]).toMatchObject({
      status: "failed",
      evidence_ids: ["EV-001"]
    });
    expect(manifest.evidence[0].description).toContain("Contradictory proof for STEP-004");
  });

  test("human-owned login challenges and session expiry produce precise blockers", async ({}, testInfo) => {
    for (const state of [
      "expired",
      "login_required",
      "otp_required",
      "captcha_required",
      "device_verification_required"
    ]) {
      const intake = await prepareExecutableJob(testInfo, `session-${state.replaceAll("_", "-")}`);
      const browser = createControlledBrowser();
      browser.inspectSession = async () => ({
        state,
        environment: "UAT",
        merchantScope: "merchant-7788",
        surface: "management_backend"
      });

      const result = await runAuthorizedBrowserCase({ workspace: intake.workspace, browser });

      expect(result).toMatchObject({ status: "blocked", blocker: state });
    }
  });

  test("missing visible data remains residual risk instead of becoming a false pass", async ({}, testInfo) => {
    const intake = await prepareExecutableJob(testInfo, "missing-visible-data");
    const browser = createControlledBrowser();
    browser.readVisible = async () => ({ visible: false, matchesExpected: false, observed: "", facts: [] });

    const result = await runAuthorizedBrowserCase({ workspace: intake.workspace, browser });
    const execution = JSON.parse(await readFile(result.artifacts.executionResults, "utf8"));

    expect(result.status).toBe("residual_risk");
    expect(execution.runs[0].step_results[3]).toMatchObject({
      status: "residual_risk",
      blocker: "missing_visible_data",
      evidence_ids: []
    });

  });

  test("a required screenshot failure blocks the judgment", async ({}, testInfo) => {
    const intake = await prepareExecutableJob(testInfo, "evidence-failure");
    const browser = createControlledBrowser();
    browser.screenshot = async () => {
      throw new Error("capture surface unavailable");
    };

    const result = await runAuthorizedBrowserCase({ workspace: intake.workspace, browser });
    const execution = JSON.parse(await readFile(result.artifacts.executionResults, "utf8"));

    expect(result.status).toBe("blocked");
    expect(execution.runs[0].step_results[3]).toMatchObject({
      status: "blocked",
      blocker: "evidence_capture_failed",
      evidence_ids: []
    });
  });

  test("the execution gate refuses an unready session or a tampered executable step", async ({}, testInfo) => {
    const unready = await prepareExecutableJob(testInfo, "session-not-handed-off");
    const unreadyRequirement = JSON.parse(await readFile(unready.artifacts.requirement, "utf8"));
    unreadyRequirement.environment.known_session_state = "unknown";
    await writeFile(
      unready.artifacts.requirement,
      `${JSON.stringify(unreadyRequirement, null, 2)}\n`,
      "utf8"
    );
    await expect(
      runAuthorizedBrowserCase({ workspace: unready.workspace, browser: createControlledBrowser() })
    ).resolves.toMatchObject({ status: "blocked", blocker: "session_not_handed_off" });

    const tampered = await prepareExecutableJob(testInfo, "tampered-step");
    const casesPath = path.join(tampered.workspace, "test-cases.json");
    const cases = JSON.parse(await readFile(casesPath, "utf8"));
    cases.cases[0].steps[0].action_class = "confirm_before_action";
    await writeFile(casesPath, `${JSON.stringify(cases, null, 2)}\n`, "utf8");
    await expect(
      runAuthorizedBrowserCase({ workspace: tampered.workspace, browser: createControlledBrowser() })
    ).resolves.toMatchObject({ status: "blocked", blocker: "execution_gate_refused_step" });
  });

  test("a browser action failure records its blocker instead of escaping the job", async ({}, testInfo) => {
    const intake = await prepareExecutableJob(testInfo, "action-session-expired");
    const browser = createControlledBrowser();
    browser.openDetail = async () => {
      throw Object.assign(new Error("redirected to login"), { code: "LOGIN_REQUIRED" });
    };

    const result = await runAuthorizedBrowserCase({ workspace: intake.workspace, browser });
    const execution = JSON.parse(await readFile(result.artifacts.executionResults, "utf8"));

    expect(result.status).toBe("blocked");
    expect(execution.runs[0].step_results[2]).toMatchObject({
      status: "blocked",
      blocker: "login_required"
    });
  });

  test("invalid or unredacted screenshot bytes cannot support a result", async ({}, testInfo) => {
    const invalidIntake = await prepareExecutableJob(testInfo, "invalid-png");
    const invalidBrowser = createControlledBrowser();
    invalidBrowser.screenshot = async () => ({
      bytes: Buffer.from("not-a-png"),
      mimeType: "image/png",
      sensitivity: "internal",
      redactionStatus: "not_needed"
    });
    await expect(
      runAuthorizedBrowserCase({ workspace: invalidIntake.workspace, browser: invalidBrowser })
    ).resolves.toMatchObject({ status: "blocked" });

    const redactionIntake = await prepareExecutableJob(testInfo, "redaction-required");
    const redactionBrowser = createControlledBrowser();
    redactionBrowser.screenshot = async () => ({
      bytes: fixturePng(),
      mimeType: "image/png",
      sensitivity: "sensitive",
      redactionStatus: "required"
    });
    const result = await runAuthorizedBrowserCase({
      workspace: redactionIntake.workspace,
      browser: redactionBrowser
    });
    const manifest = JSON.parse(await readFile(result.artifacts.evidenceManifest, "utf8"));
    expect(result.status).toBe("blocked");
    expect(manifest.evidence).toEqual([]);
  });

  test("a competing run cannot take ownership of the same live browser", async ({}, testInfo) => {
    const firstIntake = await prepareExecutableJob(testInfo, "browser-owner-one");
    const secondIntake = await prepareExecutableJob(testInfo, "browser-owner-two");
    const browser = createControlledBrowser("shared-session");
    const competingBrowser = createControlledBrowser("shared-session");
    let continueNavigation;
    let navigationStarted;
    const navigationGate = new Promise<void>((resolve) => (continueNavigation = resolve));
    const enteredNavigation = new Promise<void>((resolve) => (navigationStarted = resolve));
    browser.navigate = async (target) => {
      browser.calls.push(["navigate", target]);
      navigationStarted();
      await navigationGate;
      return positive(`Opened ${target}`);
    };

    const firstRun = runAuthorizedBrowserCase({ workspace: firstIntake.workspace, browser });
    await enteredNavigation;
    await expect(
      runAuthorizedBrowserCase({ workspace: secondIntake.workspace, browser: competingBrowser })
    ).rejects.toThrow(/already leased by main_agent/i);
    continueNavigation();
    await expect(firstRun).resolves.toMatchObject({ status: "passed" });
  });

  test("a repeated case appends stable run and evidence IDs without overwriting history", async ({}, testInfo) => {
    const intake = await prepareExecutableJob(testInfo, "append-history");
    await runAuthorizedBrowserCase({ workspace: intake.workspace, browser: createControlledBrowser() });
    const requirement = JSON.parse(await readFile(intake.artifacts.requirement, "utf8"));
    requirement.status = "ready_for_execution";
    await writeFile(
      intake.artifacts.requirement,
      `${JSON.stringify(requirement, null, 2)}\n`,
      "utf8"
    );

    const result = await runAuthorizedBrowserCase({
      workspace: intake.workspace,
      browser: createControlledBrowser()
    });
    const execution = JSON.parse(await readFile(result.artifacts.executionResults, "utf8"));
    const manifest = JSON.parse(await readFile(result.artifacts.evidenceManifest, "utf8"));

    expect(execution.runs.map((run) => run.result_id)).toEqual(["RUN-001", "RUN-002"]);
    expect(manifest.evidence.map((item) => item.evidence_id)).toEqual(["EV-001", "EV-002"]);
    await expect(access(path.join(intake.workspace, "evidence", "EV-001.png"))).resolves.toBeUndefined();
    await expect(access(path.join(intake.workspace, "evidence", "EV-002.png"))).resolves.toBeUndefined();
  });

  test("a browser release failure changes the durable run to blocked", async ({}, testInfo) => {
    const intake = await prepareExecutableJob(testInfo, "release-failure");
    const browser = createControlledBrowser();
    browser.release = async () => {
      throw new Error("tab ownership did not close");
    };

    const result = await runAuthorizedBrowserCase({ workspace: intake.workspace, browser });
    const execution = JSON.parse(await readFile(result.artifacts.executionResults, "utf8"));
    const requirement = JSON.parse(await readFile(intake.artifacts.requirement, "utf8"));

    expect(result).toMatchObject({ status: "blocked", blocker: "browser_release_failed" });
    expect(execution.runs[0]).toMatchObject({
      status: "blocked",
      residual_risks: ["browser_release_failed"]
    });
    expect(requirement.status).toBe("blocked");
  });
});

async function prepareExecutableJob(testInfo, suffix: string) {
  const intake = await runQuestionGateJob({
    workspaceRoot: testInfo.outputPath("jobs"),
    rawJob: {
      requirementId: `REQ-20260710-${suffix}`,
      title: "Member tier and count consistency",
      description: "Verify a selected tier and its visible member total.",
      environment: {
        name: "UAT",
        managementBackendUrl: "https://uat.example.test/admin",
        merchantScope: "merchant-7788",
        knownSessionState: "user_ready"
      },
      businessSurface: {
        productSurfaces: ["management_backend"],
        modules: ["member"],
        managementBackendPaths: ["Member tier > View members"]
      },
      confirmedRules: [
        {
          ruleId: "RULE-001",
          text: "The selected member tier and visible list total remain consistent.",
          riskArea: "permission",
          passFailImpact: "high"
        }
      ]
    }
  });

  await runReadOnlyPlanningJob({
    workspace: intake.workspace,
    plan: {
      strategy: {
        scope: { inScope: ["Tier member list"], outOfScope: [], blockedScope: [] },
        frontendBackendMapping: [
          {
            h5Capability: "Member tier display",
            managementBackendModule: "Member tier management",
            sharedBusinessObject: "Member tier",
            qaFocus: "Tier and total consistency"
          }
        ],
        riskMatrix: [
          {
            area: "permission",
            risk: "high",
            whyItMatters: "Merchant and member scope must remain isolated.",
            coverage: "P0"
          }
        ],
        automationPriority: "P0",
        minimalLoopPosition: ["member_attribution"],
        evidenceExpectations: ["Tier, rows, and total visible together"]
      },
      cases: [
        {
          title: "Read tier member total",
          ruleIds: ["RULE-001"],
          priority: "P0",
          riskArea: "permission",
          preconditions: ["A dedicated UAT management-backend session is ready"],
          testData: [
            { name: "tier", value: "Tier 1", sensitivity: "internal", source: "provided" }
          ],
          steps: [
            step("Navigate to member tiers", "navigate", "/members/tiers", false),
            step("Filter to Tier 1", "filter", "Tier", false, "Tier 1"),
            step("Open Tier 1 members", "open_detail", "Tier 1 members", false),
            step("Read tier and totals", "read_visible", "Member tier summary", true)
          ],
          expectedResult: "Tier 1 and its member total are visibly consistent.",
          evidenceRequired: ["Screenshot containing tier, rows, and total"],
          evidenceExpectationRefs: ["Tier, rows, and total visible together"],
          residualRiskIfNotRun: "Member attribution and total remain unverified."
        }
      ]
    }
  });

  return intake;
}

function step(action, operation, operationTarget, evidenceRequired, operationValue?) {
  const expected = operation === "read_visible"
    ? "Tier 1, 12 visible members, total 12"
    : operationValue ?? operationTarget;
  return {
    action,
    actionClass: "read_only",
    targetSurface: "management_backend",
    operation,
    operationTarget,
    operationValue,
    assertion: { operator: operation === "read_visible" ? "equals" : "contains", expected },
    expectedObservation: `${action} succeeds with visible expected state`,
    evidenceRequired
  };
}

function createControlledBrowser(sessionId = "prepared-uat-session") {
  const calls: unknown[] = [];
  return {
    calls,
    async sessionIdentity() {
      calls.push(["session_identity"]);
      return sessionId;
    },
    async claim(owner) {
      calls.push(["claim", owner]);
      return true;
    },
    async release(owner) {
      calls.push(["release", owner]);
    },
    async inspectSession() {
      calls.push(["inspect_session"]);
      return {
        state: "ready",
        environment: "UAT",
        merchantScope: "merchant-7788",
        surface: "management_backend"
      };
    },
    async navigate(target) {
      calls.push(["navigate", target]);
      return positive(`Opened ${target}`);
    },
    async filter(target, value) {
      calls.push(["filter", target, value]);
      return positive(`${target} is ${value}`);
    },
    async openDetail(target) {
      calls.push(["open_detail", target]);
      return positive(`Opened ${target}`);
    },
    async readVisible(target) {
      calls.push(["read_visible", target]);
      return positive("Tier 1, 12 visible members, total 12");
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

function positive(observed: string) {
  return { visible: true, observed, facts: [observed] };
}

function fixturePng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nYQAAAAASUVORK5CYII=",
    "base64"
  );
}

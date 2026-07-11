import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { runAuthorizedBrowserCase } from "../../src/qa-workstation/authorized-browser-execution.mjs";
import { runQuestionGateJob } from "../../src/qa-workstation/question-gate-job.mjs";
import { runReadOnlyPlanningJob } from "../../src/qa-workstation/read-only-planning-job.mjs";
import { createPlaywrightBrowserAdapter } from "../support/uat-browser-adapter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MOCK_BACKEND_URL = path.resolve(__dirname, "../fixtures/management-backend-mock.html");

test.describe("UAT session handoff smoke path", () => {
  test("a user-prepared UAT session is taken over by the workstation for read-only execution", async ({ page }, testInfo) => {
    await page.goto(`file:///${MOCK_BACKEND_URL}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("VIP Management")).toBeVisible();
    await expect(page.getByTestId("uat-env")).toHaveText("UAT");
    await expect(page.getByTestId("merchant-scope")).toHaveText("merchant-7788");

    await page.getByTestId("vip-btn-VIP1").click();
    await expect(page.getByTestId("total-count")).toHaveText("12");

    const browser = createPlaywrightBrowserAdapter(page);

    const intake = await runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260711-uat-smoke",
        title: "VIP member-count consistency",
        description: "Verify a selected VIP level and its visible member total.",
        environment: {
          name: "UAT",
          managementBackendUrl: "https://uat.example.test/admin",
          merchantScope: "merchant-7788",
          knownSessionState: "user_ready"
        },
        businessSurface: {
          productSurfaces: ["management_backend"],
          modules: ["member"],
          managementBackendPaths: ["VIP management > View members"]
        },
        confirmedRules: [
          {
            ruleId: "RULE-001",
            text: "The selected VIP level and visible member total remain consistent.",
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
          scope: { inScope: ["VIP member list"], outOfScope: [], blockedScope: [] },
          frontendBackendMapping: [
            {
              h5Capability: "VIP level display",
              managementBackendModule: "VIP management",
              sharedBusinessObject: "Member VIP level",
              qaFocus: "VIP level and total consistency"
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
          evidenceExpectations: ["VIP level, rows, and total visible together"]
        },
        cases: [
          {
            title: "Read VIP1 member total",
            ruleIds: ["RULE-001"],
            priority: "P0",
            riskArea: "permission",
            preconditions: ["A dedicated UAT management-backend session is ready"],
            testData: [
              { name: "vipLevel", value: "VIP1", sensitivity: "internal", source: "provided" }
            ],
            steps: [
              step("Navigate to VIP management", "navigate", "/members/vip", false),
              step("Filter to VIP1", "filter", "VIP", false, "VIP1"),
              step("Open VIP1 members", "open_detail", "VIP1 members", false),
              step("Read VIP1 and totals", "read_visible", "Member VIP summary", true, undefined, "VIP1, 5 visible members, total 12")
            ],
            expectedResult: "VIP1 and its member total are visibly consistent.",
            evidenceRequired: ["Screenshot containing VIP level, rows, and total"],
            evidenceExpectationRefs: ["VIP level, rows, and total visible together"],
            residualRiskIfNotRun: "Member attribution and total remain unverified."
          }
        ]
      }
    });

    const result = await runAuthorizedBrowserCase({ workspace: intake.workspace, browser });

    expect(result.status).toBe("passed");

    const execution = JSON.parse(await readFile(result.artifacts.executionResults, "utf8"));
    const manifest = JSON.parse(await readFile(result.artifacts.evidenceManifest, "utf8"));

    expect(execution.runs).toHaveLength(1);
    expect(execution.runs[0]).toMatchObject({
      status: "passed",
      executor: "main_agent",
      environment: "UAT",
      merchant_scope: "merchant-7788"
    });

    expect(manifest.evidence).toHaveLength(1);
    expect(manifest.evidence[0]).toMatchObject({
      type: "screenshot",
      related_case_ids: ["TC-001"],
      sensitivity: "internal"
    });

    const screenshotPath = path.join(intake.workspace, manifest.evidence[0].path);
    await expect(access(screenshotPath)).resolves.toBeUndefined();

    expect(browser.calls).toEqual([
      ["session_identity"],
      ["claim", "main_agent"],
      ["inspect_session"],
      ["navigate", "/members/vip"],
      ["filter", "VIP", "VIP1"],
      ["open_detail", "VIP1 members"],
      ["read_visible", "Member VIP summary"],
      ["screenshot", "STEP-004"],
      ["release", "main_agent"]
    ]);
  });

  test("session handoff detects stale filter state when switching VIP levels", async ({ page }, testInfo) => {
    await page.goto(`file:///${MOCK_BACKEND_URL}`, { waitUntil: "domcontentloaded" });

    await page.getByTestId("vip-btn-VIP2").click();
    await expect(page.getByTestId("total-count")).toHaveText("3");

    const browser = createPlaywrightBrowserAdapter(page);

    const intake = await runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260711-uat-stale-filter",
        title: "VIP member-count consistency",
        description: "Verify a selected VIP level and its visible member total.",
        environment: {
          name: "UAT",
          managementBackendUrl: "https://uat.example.test/admin",
          merchantScope: "merchant-7788",
          knownSessionState: "user_ready"
        },
        businessSurface: {
          productSurfaces: ["management_backend"],
          modules: ["member"],
          managementBackendPaths: ["VIP management > View members"]
        },
        confirmedRules: [
          {
            ruleId: "RULE-001",
            text: "The selected VIP level and visible member total remain consistent.",
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
          scope: { inScope: ["VIP member list"], outOfScope: [], blockedScope: [] },
          frontendBackendMapping: [
            {
              h5Capability: "VIP level display",
              managementBackendModule: "VIP management",
              sharedBusinessObject: "Member VIP level",
              qaFocus: "VIP level and total consistency"
            }
          ],
          riskMatrix: [
            { area: "permission", risk: "high", whyItMatters: "Scope isolation.", coverage: "P0" }
          ],
          automationPriority: "P0",
          minimalLoopPosition: ["member_attribution"],
          evidenceExpectations: ["VIP level, rows, and total visible together"]
        },
        cases: [
          {
            title: "Read VIP1 member total after filter switch",
            ruleIds: ["RULE-001"],
            priority: "P0",
            riskArea: "permission",
            preconditions: ["A dedicated UAT management-backend session is ready"],
            testData: [
              { name: "vipLevel", value: "VIP1", sensitivity: "internal", source: "provided" }
            ],
            steps: [
              step("Navigate to VIP management", "navigate", "/members/vip", false),
              step("Filter to VIP1", "filter", "VIP", false, "VIP1"),
              step("Open VIP1 members", "open_detail", "VIP1 members", false),
              step("Read VIP1 and totals", "read_visible", "Member VIP summary", true, undefined, "VIP1, 5 visible members, total 12")
            ],
            expectedResult: "VIP1 and its member total are visibly consistent.",
            evidenceRequired: ["Screenshot containing VIP level, rows, and total"],
            evidenceExpectationRefs: ["VIP level, rows, and total visible together"],
            residualRiskIfNotRun: "Member attribution and total remain unverified."
          }
        ]
      }
    });

    const result = await runAuthorizedBrowserCase({ workspace: intake.workspace, browser });

    expect(result.status).toBe("passed");

    const execution = JSON.parse(await readFile(result.artifacts.executionResults, "utf8"));
    expect(execution.runs[0].step_results[3]).toMatchObject({
      status: "passed",
      observed: "VIP1, 5 visible members, total 12"
    });
  });
});

function step(action, operation, operationTarget, evidenceRequired, operationValue?, expected?) {
  const assertionExpected = expected
    ?? (operation === "read_visible" ? "" : (operationValue ?? operationTarget));
  return {
    action,
    actionClass: "read_only",
    targetSurface: "management_backend",
    operation,
    operationTarget,
    operationValue,
    assertion: {
      operator: operation === "read_visible" ? "equals" : "contains",
      expected: assertionExpected
    },
    expectedObservation: `${action} succeeds with visible expected state`,
    evidenceRequired
  };
}

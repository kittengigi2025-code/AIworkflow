import { access, readFile, writeFile } from "node:fs/promises";
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

test.describe("VIP member-consistency end-to-end workflow", () => {
  test("runs the complete VIP slice from raw job to terminal state", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.goto(`file:///${MOCK_BACKEND_URL}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("vip-btn-VIP1").click();
    await expect(page.getByTestId("total-count")).toHaveText("12");

    const browser = createPlaywrightBrowserAdapter(page, "vip-workflow-session");

    const intake = await runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260711-vip-workflow",
        title: "VIP member-count and member-list consistency",
        description:
          "Verify VIP management availability, member-count consistency across levels, zero-member behavior, and context retention.",
        sourceRefs: [
          { type: "text", label: "Product confirmation: VIP management page layout", capturedAt: "2026-07-11T00:00:00Z" },
          { type: "text", label: "Product confirmation: Q1 filter box should match clicked level", capturedAt: "2026-07-11T00:00:00Z" },
          { type: "text", label: "Product confirmation: Q5 no state retention across levels", capturedAt: "2026-07-11T00:00:00Z" },
          { type: "text", label: "Product confirmation: Q4 zero-member behavior", capturedAt: "2026-07-11T00:00:00Z" },
          { type: "text", label: "Product confirmation: Q5 search context retention", capturedAt: "2026-07-11T00:00:00Z" }
        ],
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
            text: "VIP management page has a View Members tab that shows member counts per VIP level.",
            sourceRef: "Product confirmation: VIP management page layout",
            riskArea: "permission",
            passFailImpact: "high"
          },
          {
            ruleId: "RULE-002",
            text: "Clicking a VIP level member count filters the member list to that level, and the visible total matches the row count.",
            sourceRef: "Product confirmation: Q1 filter box should match clicked level",
            riskArea: "permission",
            passFailImpact: "high"
          },
          {
            ruleId: "RULE-003",
            text: "Switching between VIP levels must not carry over the previous level filter, list, or total.",
            sourceRef: "Product confirmation: Q5 no state retention across levels",
            riskArea: "permission",
            passFailImpact: "high"
          },
          {
            ruleId: "RULE-004",
            text: "A VIP level with zero members shows an empty state and the total is zero.",
            sourceRef: "Product confirmation: Q4 zero-member behavior",
            riskArea: "display",
            passFailImpact: "medium"
          },
          {
            ruleId: "RULE-005",
            text: "Search within a VIP level filters the member list but does not change the selected VIP level filter.",
            sourceRef: "Product confirmation: Q5 search context retention",
            riskArea: "permission",
            passFailImpact: "medium"
          }
        ],
        questions: [
          {
            question: "Does the VIP filter box display the clicked level?",
            whyItMatters: "Determines whether a mismatch is a display bug or expected behavior.",
            impacts: ["pass_fail"],
            answer: "The filter box displays the clicked VIP level.",
            answeredBy: "product",
            answeredAt: "2026-07-11T00:00:00Z"
          },
          {
            question: "Does the member count include frozen, disabled, or test members?",
            whyItMatters: "Determines whether count must match the visible row total exactly.",
            impacts: ["data_scope"],
            answer: "The count reflects active members only; frozen and disabled are excluded.",
            answeredBy: "product",
            answeredAt: "2026-07-11T00:00:00Z"
          },
          {
            question: "What happens when a zero-member VIP level is clicked?",
            whyItMatters: "Determines expected empty-state behavior.",
            impacts: ["pass_fail"],
            answer: "An empty state is shown with zero total.",
            answeredBy: "product",
            answeredAt: "2026-07-11T00:00:00Z"
          },
          {
            question: "Does switching tabs retain the previously selected VIP level?",
            whyItMatters: "Determines stale filter detection expectations.",
            impacts: ["pass_fail"],
            answer: "No retention; each entry starts fresh with no stale filter.",
            answeredBy: "product",
            answeredAt: "2026-07-11T00:00:00Z"
          }
        ]
      }
    });

    expect(intake.status).toBe("ready_for_design");

    await runReadOnlyPlanningJob({
      workspace: intake.workspace,
      plan: {
        strategy: {
          scope: {
            inScope: ["VIP management page", "View Members tab", "VIP level member counts", "Member list per level"],
            outOfScope: ["H5 frontend", "Wallet operations", "Game bet traces"],
            blockedScope: []
          },
          frontendBackendMapping: [
            {
              h5Capability: "Not in scope",
              managementBackendModule: "VIP management",
              sharedBusinessObject: "Member VIP level",
              qaFocus: "VIP level and count consistency"
            }
          ],
          riskMatrix: [
            { area: "permission", risk: "high", whyItMatters: "Merchant scope isolation.", coverage: "P0" },
            { area: "display", risk: "medium", whyItMatters: "Zero-member behavior clarity.", coverage: "P1" }
          ],
          automationPriority: "P0",
          minimalLoopPosition: ["member_attribution"],
          evidenceExpectations: [
            "VIP level, rows, and total visible together",
            "Empty state visible for zero-member level",
            "Filter display retains VIP level during search"
          ]
        },
        cases: [
          vipCase("TC-001", "VIP management page availability", ["RULE-001"], [
            step("Navigate to VIP management", "navigate", "/members/vip", false, undefined, "/members/vip"),
            step("Read View Members tab", "read_visible", "View Members tab", true, undefined, "VIP1, 5 visible members, total 12")
          ]),
          vipCase("TC-002", "VIP1 member-count consistency", ["RULE-002"], [
            step("Filter to VIP1", "filter", "VIP", false, "VIP1", "VIP1"),
            step("Open VIP1 members", "open_detail", "VIP1 members", false, "VIP1 members"),
            step("Read VIP1 count and rows", "read_visible", "VIP1 summary", true, undefined, "VIP1, 5 visible members, total 12")
          ]),
          vipCase("TC-003", "Switch to VIP2 and verify no stale VIP1 state", ["RULE-003"], [
            step("Filter to VIP2", "filter", "VIP", false, "VIP2", "VIP2"),
            step("Open VIP2 members", "open_detail", "VIP2 members", false, "VIP2 members"),
            step("Read VIP2 count and rows", "read_visible", "VIP2 summary", true, undefined, "VIP2, 3 visible members, total 3")
          ]),
          vipCase("TC-004", "Zero-member VIP3 shows empty state", ["RULE-004"], [
            step("Filter to VIP3", "filter", "VIP", false, "VIP3", "VIP3"),
            step("Open VIP3 members", "open_detail", "VIP3 members", false, "VIP3 members"),
            step("Read VIP3 empty state", "read_visible", "VIP3 summary", true, undefined, "VIP3, 0 visible members, total 0")
          ]),
          vipCase("TC-005", "Search within VIP1 retains VIP filter", ["RULE-005"], [
            step("Filter to VIP1", "filter", "VIP", false, "VIP1", "VIP1"),
            step("Search for alice", "filter", "search", false, "alice", "alice"),
            step("Read search results with VIP1 context", "read_visible", "Search results", true, undefined, "VIP1, 1 visible members, total 1")
          ])
        ]
      }
    });

    const caseIds = ["TC-001", "TC-002", "TC-003", "TC-004", "TC-005"];
    const results: Array<{ caseId: string; status: string; observed?: string }> = [];

    for (const caseId of caseIds) {
      const requirement = JSON.parse(await readFile(intake.artifacts.requirement, "utf8"));
      if (requirement.status !== "ready_for_execution") {
        requirement.status = "ready_for_execution";
        await writeFile(intake.artifacts.requirement, `${JSON.stringify(requirement, null, 2)}\n`, "utf8");
      }

      const result = await runAuthorizedBrowserCase({ workspace: intake.workspace, browser, caseId });
      const execution = JSON.parse(await readFile(result.artifacts.executionResults, "utf8"));
      const run = execution.runs[execution.runs.length - 1];
      const lastStep = run.step_results[run.step_results.length - 1];

      results.push({ caseId, status: run.status, observed: lastStep?.observed });
    }

    expect(results[0].status).toBe("passed");
    expect(results[1].status).toBe("passed");
    expect(results[2].status).toBe("passed");
    expect(results[3].status).toBe("passed");
    expect(results[4].status).toBe("passed");

    expect(results[1].observed).toBe("VIP1, 5 visible members, total 12");
    expect(results[2].observed).toBe("VIP2, 3 visible members, total 3");
    expect(results[3].observed).toBe("VIP3, 0 visible members, total 0");

    const execution = JSON.parse(await readFile(path.join(intake.workspace, "execution-results.json"), "utf8"));
    const manifest = JSON.parse(await readFile(path.join(intake.workspace, "evidence-manifest.json"), "utf8"));

    expect(execution.runs).toHaveLength(5);
    expect(execution.runs.map((r: { result_id: string }) => r.result_id)).toEqual([
      "RUN-001", "RUN-002", "RUN-003", "RUN-004", "RUN-005"
    ]);
    expect(execution.runs.map((r: { case_id: string }) => r.case_id)).toEqual(caseIds);

    const evidenceCaseIds = manifest.evidence.flatMap((e: { related_case_ids: string[] }) => e.related_case_ids);
    expect(evidenceCaseIds).toEqual(caseIds);
    expect(manifest.evidence).toHaveLength(5);

    for (const ev of manifest.evidence) {
      const screenshotPath = path.join(intake.workspace, ev.path);
      await expect(access(screenshotPath)).resolves.toBeUndefined();
    }

    const finalRequirement = JSON.parse(await readFile(intake.artifacts.requirement, "utf8"));
    expect(["passed", "has_bugs", "blocked"]).toContain(finalRequirement.status);
    expect(finalRequirement.status).toBe("passed");

    const allActions = browser.calls.filter(([, action]) => action !== "session_identity" && action !== "claim" && action !== "release" && action !== "inspect_session");
    const mutatingActions = allActions.filter(([, action]) =>
      action === "save" || action === "submit" || action === "export" || action === "upload" || action === "delete"
    );
    expect(mutatingActions).toEqual([]);
  });
});

function vipCase(caseId: string, title: string, ruleIds: string[], steps: unknown[]) {
  return {
    title,
    ruleIds,
    priority: "P0",
    riskArea: "permission",
    preconditions: ["A dedicated UAT management-backend session is ready"],
    testData: [{ name: "vipLevel", value: "VIP1", sensitivity: "internal", source: "provided" }],
    steps,
    expectedResult: "VIP level and member count are visibly consistent.",
    evidenceRequired: ["Screenshot containing VIP level, rows, and total"],
    evidenceExpectationRefs: ["VIP level, rows, and total visible together"],
    residualRiskIfNotRun: "Member attribution and total remain unverified."
  };
}

function step(action: string, operation: string, operationTarget: string, evidenceRequired: boolean, operationValue?: string, expected?: string) {
  const assertionExpected = expected ?? (operationValue ?? operationTarget);
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
    expectedObservation: `${action} succeeds`,
    evidenceRequired
  };
}

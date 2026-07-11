import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { runQuestionGateJob } from "../../src/qa-workstation/question-gate-job.mjs";
import { runReadOnlyPlanningJob } from "../../src/qa-workstation/read-only-planning-job.mjs";

test.describe("read-only QA planning", () => {
  test("a question-gated job becomes a safe traceable executable plan", async ({}, testInfo) => {
    const intake = await runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260710-member-tier-plan",
        title: "Member-tier count and list consistency",
        description: "Verify count, selected tier, visible filter, and listed members.",
        capturedAt: "2026-07-10T10:00:00.000Z",
        businessSurface: {
          productSurfaces: ["h5_frontend", "management_backend"],
          modules: ["member", "report"],
          h5Paths: ["Member center"],
          managementBackendPaths: ["Member tier > View members"]
        },
        confirmedRules: [
          {
            ruleId: "RULE-001",
            text: "The selected member tier matches the filter and listed members.",
            riskArea: "permission",
            passFailImpact: "high"
          },
          {
            ruleId: "RULE-002",
            text: "The visible member count matches the list total.",
            riskArea: "display",
            passFailImpact: "low"
          }
        ]
      }
    });

    const result = await runReadOnlyPlanningJob({
      workspace: intake.workspace,
      plan: {
        strategy: {
          scope: {
            inScope: ["Member-tier count and list consistency"],
            outOfScope: ["Editing member tiers"],
            blockedScope: []
          },
          frontendBackendMapping: [
            {
              h5Capability: "Member center tier display",
              managementBackendModule: "Member-tier management",
              sharedBusinessObject: "Member tier",
              qaFocus: "Cross-surface tier consistency"
            }
          ],
          riskMatrix: [
            {
              area: "display",
              risk: "low",
              whyItMatters: "A cosmetic mismatch can confuse operators.",
              coverage: "P2"
            },
            {
              area: "permission",
              risk: "high",
              whyItMatters: "Wrong merchant or tier scope can expose member data.",
              coverage: "P0"
            }
          ],
          automationPriority: "P0",
          minimalLoopPosition: ["config_visibility", "member_attribution"],
          evidenceExpectations: ["Selected tier, visible filter, rows, and total"]
        },
        cases: [
          {
            title: "Selected member tier remains consistent",
            ruleIds: ["RULE-001"],
            priority: "P0",
            riskArea: "permission",
            preconditions: ["Authorized management-backend session is ready"],
            testData: [
              {
                name: "memberTier",
                value: "Tier 1",
                sensitivity: "internal",
                source: "provided"
              }
            ],
            steps: [
              {
                action: "Open Tier 1 member list",
                actionClass: "read_only",
                targetSurface: "management_backend",
                operation: "open_detail",
                operationTarget: "Member tier > Tier 1 members",
                assertion: { operator: "contains", expected: "Tier 1" },
                expectedObservation: "Filter and listed rows show Tier 1",
                evidenceRequired: true
              }
            ],
            expectedResult: "The clicked tier, filter, and rows agree.",
            evidenceRequired: ["Screenshot of Tier 1 filter and rows"],
            evidenceExpectationRefs: ["Selected tier, visible filter, rows, and total"],
            residualRiskIfNotRun: "A stale tier context may expose the wrong members."
          },
          {
            title: "Member count matches list total",
            ruleIds: ["RULE-002"],
            priority: "P2",
            riskArea: "display",
            preconditions: ["A member tier with visible members exists"],
            testData: [],
            steps: [
              {
                action: "Compare the tier count with the opened list total",
                actionClass: "read_only",
                targetSurface: "management_backend",
                operation: "read_visible",
                operationTarget: "Member tier count and list total",
                assertion: { operator: "contains", expected: "equal" },
                expectedObservation: "The count and total are equal",
                evidenceRequired: true
              }
            ],
            expectedResult: "Count and list total agree.",
            evidenceRequired: ["Screenshot containing count and total"],
            evidenceExpectationRefs: ["Selected tier, visible filter, rows, and total"],
            residualRiskIfNotRun: "Count accuracy would remain unverified."
          }
        ]
      }
    });

    expect(result.status).toBe("ready_for_execution");

    const requirement = JSON.parse(await readFile(intake.artifacts.requirement, "utf8"));
    const strategy = JSON.parse(await readFile(result.artifacts.strategy, "utf8"));
    const cases = JSON.parse(await readFile(result.artifacts.testCases, "utf8"));

    expect(requirement.status).toBe("ready_for_execution");
    expect(strategy).toMatchObject({
      requirement_id: "REQ-20260710-member-tier-plan",
      scope: {
        in_scope: ["Member-tier count and list consistency"],
        out_of_scope: ["Editing member tiers"],
        blocked_scope: []
      },
      frontend_backend_mapping: [
        {
          h5_capability: "Member center tier display",
          backend_module: "Member-tier management",
          shared_business_object: "Member tier",
          qa_focus: "Cross-surface tier consistency"
        }
      ],
      automation_priority: "P0"
    });
    expect(strategy.risk_matrix.map((entry: { risk: string }) => entry.risk)).toEqual([
      "high",
      "low"
    ]);
    expect(cases.cases).toHaveLength(2);
    expect(cases.cases[0]).toMatchObject({
      case_id: "TC-001",
      rule_ids: ["RULE-001"],
      priority: "P0",
      steps: [
        {
          step_id: "STEP-001",
          action_class: "read_only",
          target_surface: "management_backend",
          evidence_required: true
        }
      ]
    });
  });

  test("a job waiting for confirmation cannot enter planning", async ({}, testInfo) => {
    const intake = await runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260710-planning-gate",
        title: "Planning gate",
        description: "Do not design cases before product scope is confirmed.",
        questions: [
          {
            question: "Are disabled members included?",
            whyItMatters: "It changes the expected member count.",
            impacts: ["data_scope"]
          }
        ]
      }
    });

    await expect(
      runReadOnlyPlanningJob({ workspace: intake.workspace, plan: {} })
    ).rejects.toThrow(/waiting_for_confirmation.*cannot enter planning/i);
    await expect(access(path.join(intake.workspace, "strategy.json"))).rejects.toThrow();
    await expect(access(path.join(intake.workspace, "test-cases.json"))).rejects.toThrow();
  });

  test("missing and invalid action classes are refused before artifacts are written", async ({}, testInfo) => {
    const intake = await createPlanningFixture(testInfo, "invalid-action");
    const missingClass = makeValidPlan();
    delete missingClass.cases[0].steps[0].actionClass;

    await expect(runReadOnlyPlanningJob({ workspace: intake.workspace, plan: missingClass }))
      .rejects.toThrow(/actionClass has invalid value undefined/i);

    const invalidClass = makeValidPlan();
    invalidClass.cases[0].steps[0].actionClass = "read";
    await expect(runReadOnlyPlanningJob({ workspace: intake.workspace, plan: invalidClass }))
      .rejects.toThrow(/actionClass has invalid value read/i);
    await expect(access(path.join(intake.workspace, "strategy.json"))).rejects.toThrow();
    await expect(access(path.join(intake.workspace, "test-cases.json"))).rejects.toThrow();
  });

  test("a valid non-read-only action creates a blocked strategy without executable cases", async ({}, testInfo) => {
    const intake = await createPlanningFixture(testInfo, "blocked-action");
    const plan = makeValidPlan();
    plan.cases[0].steps[0].actionClass = "confirm_before_action";
    const proposedPlan = structuredClone(plan);

    const result = await runReadOnlyPlanningJob({ workspace: intake.workspace, plan });

    expect(plan).toEqual(proposedPlan);
    expect(result.status).toBe("blocked");
    expect(result.artifacts.testCases).toBeUndefined();
    const strategy = JSON.parse(await readFile(result.artifacts.strategy, "utf8"));
    const requirement = JSON.parse(await readFile(intake.artifacts.requirement, "utf8"));
    expect(requirement.status).toBe("blocked");
    expect(strategy.scope.blocked_scope).toContain(
      "STEP-001: confirm_before_action is outside the read-only first slice"
    );
    expect(strategy.rule_disposition).toMatchObject({ covered: [], blocked: ["RULE-001"] });
    await expect(access(path.join(intake.workspace, "test-cases.json"))).rejects.toThrow();
  });

  test("traceability rejects uncovered rules, empty cases, and missing evidence links", async ({}, testInfo) => {
    const intake = await createPlanningFixture(testInfo, "traceability");

    const uncovered = makeValidPlan();
    uncovered.cases = [];
    await expect(runReadOnlyPlanningJob({ workspace: intake.workspace, plan: uncovered }))
      .rejects.toThrow(/RULE-001 has no case or explicit disposition/i);

    const noSteps = makeValidPlan();
    noSteps.cases[0].steps = [];
    await expect(runReadOnlyPlanningJob({ workspace: intake.workspace, plan: noSteps }))
      .rejects.toThrow(/steps must be a non-empty array/i);

    const noEvidence = makeValidPlan();
    noEvidence.cases[0].steps[0].evidenceRequired = false;
    await expect(runReadOnlyPlanningJob({ workspace: intake.workspace, plan: noEvidence }))
      .rejects.toThrow(/no step linked to required evidence/i);

    const unknownEvidence = makeValidPlan();
    unknownEvidence.cases[0].evidenceExpectationRefs = ["Unrelated evidence"];
    await expect(runReadOnlyPlanningJob({ workspace: intake.workspace, plan: unknownEvidence }))
      .rejects.toThrow(/unknown strategy evidence expectation/i);
  });

  test("explicit rule disposition and gaming risk elevation remain inspectable", async ({}, testInfo) => {
    const intake = await createPlanningFixture(testInfo, "risk-ordering", [
      {
        ruleId: "RULE-002",
        text: "Wallet ledger balance is consistent.",
        riskArea: "wallet",
        passFailImpact: "high"
      }
    ]);
    const plan = makeValidPlan();
    plan.outOfScopeRuleIds = ["RULE-002"];
    plan.strategy.scope.outOfScope.push("Wallet mutation and ledger reconciliation");
    plan.strategy.riskMatrix = [
      {
        area: "display",
        risk: "low",
        whyItMatters: "Presentation clarity",
        coverage: "P2"
      },
      {
        area: "wallet",
        risk: "low",
        whyItMatters: "Money source of truth",
        coverage: "P0"
      },
      {
        area: "permission",
        risk: "medium",
        whyItMatters: "Member scope must remain isolated.",
        coverage: "P1"
      }
    ];

    const result = await runReadOnlyPlanningJob({ workspace: intake.workspace, plan });
    const strategy = JSON.parse(await readFile(result.artifacts.strategy, "utf8"));

    expect(strategy.rule_disposition.out_of_scope).toEqual(["RULE-002"]);
    expect(strategy.risk_matrix.map((risk: { area: string; risk: string; coverage: string }) => [
      risk.area,
      risk.risk,
      risk.coverage
    ])).toEqual([
      ["wallet", "high", "P0"],
      ["permission", "high", "P0"],
      ["display", "low", "P2"]
    ]);
  });

  test("a plan with no executable cases is blocked instead of becoming ready", async ({}, testInfo) => {
    const intake = await createPlanningFixture(testInfo, "no-executable-cases");
    const plan = makeValidPlan();
    plan.cases = [];
    plan.blockedRuleIds = ["RULE-001"];

    const result = await runReadOnlyPlanningJob({ workspace: intake.workspace, plan });
    const strategy = JSON.parse(await readFile(result.artifacts.strategy, "utf8"));

    expect(result.status).toBe("blocked");
    expect(strategy.rule_disposition).toMatchObject({ covered: [], blocked: ["RULE-001"] });
    await expect(access(path.join(intake.workspace, "test-cases.json"))).rejects.toThrow();
  });

  test("a mixed safe and unsafe plan does not claim unpersisted case coverage", async ({}, testInfo) => {
    const intake = await createPlanningFixture(testInfo, "mixed-safety", [
      {
        ruleId: "RULE-002",
        text: "The visible count matches the member list.",
        riskArea: "display",
        passFailImpact: "low"
      }
    ]);
    const plan = makeValidPlan();
    const displayCase = structuredClone(plan.cases[0]);
    displayCase.ruleIds = ["RULE-002"];
    displayCase.riskArea = "display";
    plan.cases.push(displayCase);
    plan.cases[0].steps[0].actionClass = "pre_authorized_mutation";
    plan.strategy.riskMatrix.push({
      area: "display",
      risk: "low",
      whyItMatters: "Visible totals guide operators.",
      coverage: "P2"
    });

    const result = await runReadOnlyPlanningJob({ workspace: intake.workspace, plan });
    const strategy = JSON.parse(await readFile(result.artifacts.strategy, "utf8"));

    expect(result.status).toBe("blocked");
    expect(strategy.rule_disposition.covered).toEqual([]);
    expect(strategy.rule_disposition.blocked).toEqual(["RULE-001", "RULE-002"]);
  });

  test("relevant risk coverage and frontend/backend mapping cannot be omitted", async ({}, testInfo) => {
    const intake = await createPlanningFixture(testInfo, "planning-completeness");
    const noRisk = makeValidPlan();
    noRisk.strategy.riskMatrix = [];
    await expect(runReadOnlyPlanningJob({ workspace: intake.workspace, plan: noRisk }))
      .rejects.toThrow(/riskMatrix must be a non-empty array/i);

    const noMapping = makeValidPlan();
    noMapping.strategy.frontendBackendMapping = [];
    await expect(runReadOnlyPlanningJob({ workspace: intake.workspace, plan: noMapping }))
      .rejects.toThrow(/frontendBackendMapping must be a non-empty array/i);
  });
});

async function createPlanningFixture(testInfo, suffix: string, extraRules = []) {
  return runQuestionGateJob({
    workspaceRoot: testInfo.outputPath("jobs"),
    rawJob: {
      requirementId: `REQ-20260710-${suffix}`,
      title: `Planning fixture ${suffix}`,
      description: "Validate a read-only management-backend observation.",
      businessSurface: {
        productSurfaces: ["management_backend"],
        modules: ["member"],
        managementBackendPaths: ["Member > Details"]
      },
      confirmedRules: [
        {
          ruleId: "RULE-001",
          text: "The visible member tier matches the selected tier.",
          riskArea: "permission",
          passFailImpact: "high"
        },
        ...extraRules
      ]
    }
  });
}

function makeValidPlan() {
  return {
    strategy: {
      scope: { inScope: ["Member tier visibility"], outOfScope: [], blockedScope: [] },
      frontendBackendMapping: [
        {
          h5Capability: "Member tier display",
          managementBackendModule: "Member details",
          sharedBusinessObject: "Member tier",
          qaFocus: "Selected and visible tier consistency"
        }
      ],
      riskMatrix: [
        {
          area: "permission",
          risk: "high",
          whyItMatters: "Member scope must remain isolated.",
          coverage: "P0"
        }
      ],
      automationPriority: "P0",
      minimalLoopPosition: ["member_attribution"],
      evidenceExpectations: ["Screenshot showing selected and visible tier"]
    },
    cases: [
      {
        title: "Read member tier",
        ruleIds: ["RULE-001"],
        priority: "P0",
        riskArea: "permission",
        preconditions: ["Authorized UAT session is ready"],
        testData: [],
        steps: [
          {
            action: "Open member details",
            actionClass: "read_only",
            targetSurface: "management_backend",
            operation: "open_detail",
            operationTarget: "Member > Details",
            assertion: { operator: "contains", expected: "Tier 1" },
            expectedObservation: "The selected tier is visible",
            evidenceRequired: true
          }
        ],
        expectedResult: "Selected and visible tiers match.",
        evidenceRequired: ["Member tier screenshot"],
        evidenceExpectationRefs: ["Screenshot showing selected and visible tier"],
        residualRiskIfNotRun: "Member attribution remains unverified."
      }
    ]
  };
}

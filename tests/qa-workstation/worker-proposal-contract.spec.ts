import { createHash } from "node:crypto";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { runQuestionGateJob } from "../../src/qa-workstation/question-gate-job.mjs";
import { runReadOnlyPlanningJob } from "../../src/qa-workstation/read-only-planning-job.mjs";
import { runAuthorizedBrowserCase } from "../../src/qa-workstation/authorized-browser-execution.mjs";
import { reviewWorkerProposals } from "../../src/qa-workstation/worker-proposal-contract.mjs";

test.describe("bounded worker proposal contract", () => {
  test("a source-backed bounded proposal is merged by main_agent with provenance", async ({}, testInfo) => {
    const intake = await prepareWorkerJob(testInfo, "accepted-worker");
    const assignment = await makeAssignment(intake.workspace);
    const proposal = makeProposal(assignment);

    const result = await reviewWorkerProposals({
      workspace: intake.workspace,
      assignments: [assignment],
      proposals: [proposal]
    });

    expect(result).toMatchObject({ status: "accepted", accepted: 1, rejected: 0 });
    const contributions = JSON.parse(await readFile(result.artifacts.contributions, "utf8"));
    const review = JSON.parse(await readFile(result.artifacts.review, "utf8"));
    expect(contributions.accepted_contributions).toEqual([
      expect.objectContaining({
        contribution_id: "WC-001",
        type: "test_case_candidate",
        rule_ids: ["RULE-001"],
        summary: "Check selected tier against visible rows and total",
        merged_by: "main_agent",
        provenance: expect.objectContaining({
          assignment_id: "WA-001",
          proposal_id: "WP-001",
          confidence: "confirmed"
        })
      })
    ]);
    expect(review.reviews[0]).toMatchObject({
      assignment_id: "WA-001",
      proposal_id: "WP-001",
      decision: "accepted"
    });
    await expect(access(path.join(intake.workspace, "execution-results.json"))).rejects.toThrow();
  });

  test("stale snapshots and missing evidence are rejected without authoritative contributions", async ({}, testInfo) => {
    const staleIntake = await prepareWorkerJob(testInfo, "stale-worker");
    const staleAssignment = await makeAssignment(staleIntake.workspace);
    const staleProposal = makeProposal(staleAssignment);
    staleProposal.inputRevisions[0].sha256 = "0".repeat(64);
    const staleResult = await reviewWorkerProposals({
      workspace: staleIntake.workspace,
      assignments: [staleAssignment],
      proposals: [staleProposal]
    });
    expect(staleResult).toMatchObject({ status: "rejected", accepted: 0, rejected: 1 });

    const evidenceIntake = await prepareWorkerJob(testInfo, "missing-worker-evidence");
    const evidenceAssignment = await makeAssignment(evidenceIntake.workspace);
    const evidenceProposal = makeProposal(evidenceAssignment);
    evidenceProposal.evidenceRefs = [];
    const evidenceResult = await reviewWorkerProposals({
      workspace: evidenceIntake.workspace,
      assignments: [evidenceAssignment],
      proposals: [evidenceProposal]
    });
    expect(evidenceResult).toMatchObject({ status: "rejected", accepted: 0, rejected: 1 });
    await expect(access(path.join(evidenceIntake.workspace, "worker-contributions.json"))).rejects.toThrow();
  });

  test("over-scoped and authority-claiming proposals are rejected", async ({}, testInfo) => {
    const scopedIntake = await prepareWorkerJob(testInfo, "over-scoped-worker");
    const scopedAssignment = await makeAssignment(scopedIntake.workspace);
    const scopedProposal = makeProposal(scopedAssignment);
    scopedProposal.contributions[0].ruleIds = ["RULE-999"];
    const scopedResult = await reviewWorkerProposals({
      workspace: scopedIntake.workspace,
      assignments: [scopedAssignment],
      proposals: [scopedProposal]
    });
    expect(scopedResult).toMatchObject({ status: "rejected", rejected: 1 });

    const authorityIntake = await prepareWorkerJob(testInfo, "authority-worker");
    const authorityAssignment = await makeAssignment(authorityIntake.workspace);
    const authorityProposal = makeProposal(authorityAssignment);
    authorityProposal.authorityClaims = ["control_live_browser", "assign_final_status"];
    const authorityResult = await reviewWorkerProposals({
      workspace: authorityIntake.workspace,
      assignments: [authorityAssignment],
      proposals: [authorityProposal]
    });
    expect(authorityResult).toMatchObject({ status: "rejected", rejected: 1 });

    const hiddenAuthorityIntake = await prepareWorkerJob(testInfo, "hidden-authority-worker");
    const hiddenAuthorityAssignment = await makeAssignment(hiddenAuthorityIntake.workspace);
    const hiddenAuthorityProposal = makeProposal(hiddenAuthorityAssignment);
    hiddenAuthorityProposal.contributions[0].payload.finalStatus = "passed";
    hiddenAuthorityProposal.contributions[0].payload.browserAdapter = "take-control";
    hiddenAuthorityProposal.contributions[0].payload.operation = "publish";
    const hiddenAuthorityResult = await reviewWorkerProposals({
      workspace: hiddenAuthorityIntake.workspace,
      assignments: [hiddenAuthorityAssignment],
      proposals: [hiddenAuthorityProposal]
    });
    expect(hiddenAuthorityResult).toMatchObject({ status: "rejected", rejected: 1 });

    const secretIntake = await prepareWorkerJob(testInfo, "secret-worker");
    const secretAssignment = await makeAssignment(secretIntake.workspace);
    const secretProposal = makeProposal(secretAssignment);
    secretProposal.contributions[0].payload.apiKey = "opaque-secret-value";
    const secretResult = await reviewWorkerProposals({
      workspace: secretIntake.workspace,
      assignments: [secretAssignment],
      proposals: [secretProposal]
    });
    expect(secretResult).toMatchObject({ status: "rejected", rejected: 1 });

    const aliasIntake = await prepareWorkerJob(testInfo, "authority-alias-worker");
    const aliasAssignment = await makeAssignment(aliasIntake.workspace);
    const aliasProposal = makeProposal(aliasAssignment);
    aliasProposal.contributions[0].payload.result = "passed";
    const aliasResult = await reviewWorkerProposals({
      workspace: aliasIntake.workspace,
      assignments: [aliasAssignment],
      proposals: [aliasProposal]
    });
    expect(aliasResult).toMatchObject({ status: "rejected", rejected: 1 });

    const opaqueIntake = await prepareWorkerJob(testInfo, "opaque-secret-worker");
    const opaqueAssignment = await makeAssignment(opaqueIntake.workspace);
    const opaqueProposal = makeProposal(opaqueAssignment);
    opaqueProposal.contributions[0].payload.assertion = "AbCDef0123456789AbCDef0123456789";
    const opaqueResult = await reviewWorkerProposals({
      workspace: opaqueIntake.workspace,
      assignments: [opaqueAssignment],
      proposals: [opaqueProposal]
    });
    expect(opaqueResult).toMatchObject({ status: "rejected", rejected: 1 });
  });

  test("assignments cannot expose artifacts outside the role's minimum data", async ({}, testInfo) => {
    const intake = await prepareWorkerJob(testInfo, "minimum-worker-data");
    const assignment = await makeAssignment(intake.workspace);
    assignment.role = "ledger_keeper";

    await expect(
      reviewWorkerProposals({ workspace: intake.workspace, assignments: [assignment], proposals: [] })
    ).rejects.toThrow(/more than its minimum necessary data.*questions\.json/i);
  });

  test("conflicting proposals return to the question gate instead of being decided by vote", async ({}, testInfo) => {
    const intake = await prepareWorkerJob(testInfo, "worker-conflict");
    const firstAssignment = await makeAssignment(intake.workspace, "WA-001", "design-a");
    const secondAssignment = await makeAssignment(intake.workspace, "WA-002", "design-b");
    const first = makeProposal(firstAssignment, "WP-001", "Compare visible rows with total");
    const second = makeProposal(secondAssignment, "WP-002", "Trust the displayed total only");

    const result = await reviewWorkerProposals({
      workspace: intake.workspace,
      assignments: [firstAssignment, secondAssignment],
      proposals: [first, second]
    });

    expect(result).toMatchObject({ status: "waiting_for_confirmation", accepted: 0 });
    const requirement = JSON.parse(await readFile(intake.artifacts.requirement, "utf8"));
    const questions = JSON.parse(await readFile(intake.artifacts.questions, "utf8"));
    expect(requirement.status).toBe("waiting_for_confirmation");
    expect(questions.questions.at(-1)).toMatchObject({
      classification: "blocking",
      affected_rules: ["RULE-001"],
      default_if_unanswered: "blocked"
    });
  });

  test("parallel assignments must have isolated output scopes", async ({}, testInfo) => {
    const intake = await prepareWorkerJob(testInfo, "worker-isolation");
    const first = await makeAssignment(intake.workspace, "WA-001", "parallel-design");
    const second = await makeAssignment(intake.workspace, "WA-002", "parallel-design");
    second.scope.outputScope = "different-free-form-label";

    await expect(
      reviewWorkerProposals({ workspace: intake.workspace, assignments: [first, second], proposals: [] })
    ).rejects.toThrow(/parallel assignments.*isolated output scopes/i);
  });

  test("the workstation remains valid when no workers are configured", async ({}, testInfo) => {
    const intake = await prepareWorkerJob(testInfo, "no-workers");

    const result = await reviewWorkerProposals({
      workspace: intake.workspace,
      assignments: [],
      proposals: []
    });

    expect(result).toEqual({ status: "no_workers", accepted: 0, rejected: 0, workspace: intake.workspace });
    await expect(access(path.join(intake.workspace, "worker-proposal-review.json"))).rejects.toThrow();

    await runReadOnlyPlanningJob({ workspace: intake.workspace, plan: noWorkerPlan() });
    const execution = await runAuthorizedBrowserCase({
      workspace: intake.workspace,
      browser: noWorkerBrowser()
    });
    expect(execution.status).toBe("passed");
  });

  test("later accepted proposals append contributions and review provenance", async ({}, testInfo) => {
    const intake = await prepareWorkerJob(testInfo, "worker-append-history");
    const firstAssignment = await makeAssignment(intake.workspace, "WA-001", "design-a");
    await reviewWorkerProposals({
      workspace: intake.workspace,
      assignments: [firstAssignment],
      proposals: [makeProposal(firstAssignment, "WP-001")]
    });
    const secondAssignment = await makeAssignment(
      intake.workspace,
      "WA-002",
      "design-b",
      "filter-switch-oracle"
    );
    const secondProposal = makeProposal(secondAssignment, "WP-002", "Check tier after switching filters");

    const result = await reviewWorkerProposals({
      workspace: intake.workspace,
      assignments: [secondAssignment],
      proposals: [secondProposal]
    });
    const contributions = JSON.parse(await readFile(result.artifacts.contributions, "utf8"));
    const review = JSON.parse(await readFile(result.artifacts.review, "utf8"));

    expect(contributions.accepted_contributions.map((item) => item.contribution_id)).toEqual([
      "WC-001",
      "WC-002"
    ]);
    expect(review.reviews.map((item) => item.proposal_id)).toEqual(["WP-001", "WP-002"]);
  });

  test("a later contradiction conflicts with accepted history even under a worker-chosen label", async ({}, testInfo) => {
    const intake = await prepareWorkerJob(testInfo, "worker-historical-conflict");
    const firstAssignment = await makeAssignment(intake.workspace, "WA-001", "design-a");
    await reviewWorkerProposals({
      workspace: intake.workspace,
      assignments: [firstAssignment],
      proposals: [makeProposal(firstAssignment, "WP-001", "Compare visible rows with total")]
    });
    const secondAssignment = await makeAssignment(intake.workspace, "WA-002", "design-b");
    const second = makeProposal(secondAssignment, "WP-002", "Trust the displayed total only");
    second.contributions[0].conflictKey = "worker-invented-non-conflict";

    const result = await reviewWorkerProposals({
      workspace: intake.workspace,
      assignments: [secondAssignment],
      proposals: [second]
    });

    expect(result.status).toBe("waiting_for_confirmation");
    expect(result.accepted).toBe(0);
  });

  test("irrelevant and inherited JSON pointers cannot serve as contribution evidence", async ({}, testInfo) => {
    for (const [suffix, pointer] of [["irrelevant-evidence", "/title"], ["inherited-evidence", "/constructor"]]) {
      const intake = await prepareWorkerJob(testInfo, suffix);
      const assignment = await makeAssignment(intake.workspace);
      const proposal = makeProposal(assignment);
      proposal.evidenceRefs[0].jsonPointer = pointer;
      const result = await reviewWorkerProposals({
        workspace: intake.workspace,
        assignments: [assignment],
        proposals: [proposal]
      });
      expect(result).toMatchObject({ status: "rejected", rejected: 1 });
    }
  });

  test("tampered authoritative history and reused assignment identities are refused", async ({}, testInfo) => {
    const intake = await prepareWorkerJob(testInfo, "worker-history-integrity");
    const assignment = await makeAssignment(intake.workspace);
    const first = await reviewWorkerProposals({
      workspace: intake.workspace,
      assignments: [assignment],
      proposals: [makeProposal(assignment)]
    });
    const contributions = JSON.parse(await readFile(first.artifacts.contributions, "utf8"));
    contributions.accepted_contributions[0].payload.apiKey = "forged-secret";
    await writeFile(
      first.artifacts.contributions,
      `${JSON.stringify(contributions, null, 2)}\n`,
      "utf8"
    );
    const nextAssignment = await makeAssignment(intake.workspace, "WA-002", "design-b", "another-topic");
    await expect(
      reviewWorkerProposals({
        workspace: intake.workspace,
        assignments: [nextAssignment],
        proposals: [makeProposal(nextAssignment, "WP-002")]
      })
    ).rejects.toThrow(/existing worker contribution|forbidden secret/i);

    const reuseIntake = await prepareWorkerJob(testInfo, "worker-assignment-reuse");
    const original = await makeAssignment(reuseIntake.workspace);
    await reviewWorkerProposals({
      workspace: reuseIntake.workspace,
      assignments: [original],
      proposals: [makeProposal(original)]
    });
    const reused = await makeAssignment(
      reuseIntake.workspace,
      "WA-001",
      "design-b",
      "different-topic"
    );
    await expect(
      reviewWorkerProposals({
        workspace: reuseIntake.workspace,
        assignments: [reused],
        proposals: [makeProposal(reused, "WP-002")]
      })
    ).rejects.toThrow(/reused with a different immutable definition/i);
  });

  test("one workspace cannot publish competing worker reviews concurrently", async ({}, testInfo) => {
    const intake = await prepareWorkerJob(testInfo, "worker-review-lock");
    const assignment = await makeAssignment(intake.workspace);
    const lockPath = path.join(intake.workspace, ".worker-proposal-review.lock");
    await writeFile(lockPath, "active", "utf8");
    try {
      await expect(
        reviewWorkerProposals({
          workspace: intake.workspace,
          assignments: [assignment],
          proposals: [makeProposal(assignment)]
        })
      ).rejects.toThrow(/review is already active/i);
    } finally {
      await rm(lockPath, { force: true });
    }
  });

  test("an expired review lease is recovered without manual file deletion", async ({}, testInfo) => {
    const intake = await prepareWorkerJob(testInfo, "worker-stale-lock");
    const assignment = await makeAssignment(intake.workspace);
    const lockPath = path.join(intake.workspace, ".worker-proposal-review.lock");
    await writeFile(
      lockPath,
      `${JSON.stringify({ owner: "main_agent", expires_at: "2020-01-01T00:00:00.000Z" })}\n`,
      "utf8"
    );

    await expect(
      reviewWorkerProposals({
        workspace: intake.workspace,
        assignments: [assignment],
        proposals: [makeProposal(assignment)]
      })
    ).resolves.toMatchObject({ status: "accepted" });
    await expect(access(lockPath)).rejects.toThrow();
  });
});

async function prepareWorkerJob(testInfo, suffix: string) {
  return runQuestionGateJob({
    workspaceRoot: testInfo.outputPath("jobs"),
    rawJob: {
      requirementId: `REQ-20260711-${suffix}`,
      title: "Worker proposal contract",
      description: "Analyze one member-tier consistency rule without browser authority.",
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
          text: "The selected tier, visible rows, and total remain consistent.",
          riskArea: "permission",
          passFailImpact: "high"
        }
      ]
    }
  });
}

async function makeAssignment(
  workspace,
  assignmentId = "WA-001",
  parallelGroup = "design-a",
  decisionTopic = "member-total-oracle"
) {
  const requirementPath = path.join(workspace, "requirement.json");
  const questionsPath = path.join(workspace, "questions.json");
  return {
    assignmentId,
    role: "test_designer",
    scope: {
      contributionTypes: ["test_case_candidate"],
      ruleIds: ["RULE-001"],
      decisionTopics: [decisionTopic],
      outputScope: "test-case-candidate:RULE-001"
    },
    inputRevisions: [
      { artifact: "requirement.json", sha256: await hashFile(requirementPath) },
      { artifact: "questions.json", sha256: await hashFile(questionsPath) }
    ],
    minimumData: [
      { artifact: "requirement.json", jsonPointers: ["/confirmed_rules/0"] },
      { artifact: "questions.json", jsonPointers: ["/questions"] }
    ],
    parallelGroup
  };
}

function makeProposal(assignment, proposalId = "WP-001", summary = "Check selected tier against visible rows and total") {
  return {
    proposalId,
    assignmentId: assignment.assignmentId,
    inputRevisions: structuredClone(assignment.inputRevisions),
    contributions: [
      {
        type: "test_case_candidate",
        ruleIds: ["RULE-001"],
        decisionTopic: assignment.scope.decisionTopics[0],
        evidenceRefIds: ["SRC-001"],
        summary,
        payload: {
          operation: "read_visible",
          assertion: "selected tier, rows, and total agree",
          sourceText: "The selected tier, visible rows, and total remain consistent."
        }
      }
    ],
    evidenceRefs: [
      {
        evidenceId: "SRC-001",
        artifact: "requirement.json",
        jsonPointer: "/confirmed_rules/0",
        sha256: assignment.inputRevisions[0].sha256
      }
    ],
    openQuestions: [],
    confidence: "confirmed",
    doNotGeneralize: ["Tier labels are requirement-specific"],
    completedAt: "2026-07-11T04:00:00.000Z",
    authorityClaims: []
  };
}

async function hashFile(filePath: string) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function noWorkerPlan() {
  return {
    strategy: {
      scope: { inScope: ["Tier consistency"], outOfScope: [], blockedScope: [] },
      frontendBackendMapping: [{
        h5Capability: "Tier display",
        managementBackendModule: "Member tiers",
        sharedBusinessObject: "Member tier",
        qaFocus: "Visible consistency"
      }],
      riskMatrix: [{
        area: "permission",
        risk: "high",
        whyItMatters: "Member scope must remain isolated.",
        coverage: "P0"
      }],
      automationPriority: "P0",
      minimalLoopPosition: ["member_attribution"],
      evidenceExpectations: ["Visible tier proof"]
    },
    cases: [{
      title: "Read tier summary",
      ruleIds: ["RULE-001"],
      priority: "P0",
      riskArea: "permission",
      preconditions: ["Prepared UAT session"],
      testData: [],
      steps: [{
        action: "Read tier summary",
        actionClass: "read_only",
        targetSurface: "management_backend",
        operation: "read_visible",
        operationTarget: "Tier summary",
        assertion: { operator: "equals", expected: "Tier summary is consistent" },
        expectedObservation: "Tier summary is consistent",
        evidenceRequired: true
      }],
      expectedResult: "Tier summary is consistent.",
      evidenceRequired: ["Visible tier proof"],
      evidenceExpectationRefs: ["Visible tier proof"],
      residualRiskIfNotRun: "Tier consistency remains unknown."
    }]
  };
}

function noWorkerBrowser() {
  return {
    async sessionIdentity() { return "no-worker-session"; },
    async claim() { return true; },
    async release() {},
    async inspectSession() {
      return {
        state: "ready",
        environment: "UAT",
        merchantScope: "merchant-7788",
        surface: "management_backend"
      };
    },
    async readVisible() {
      return { visible: true, observed: "Tier summary is consistent", facts: ["Tier summary is consistent"] };
    },
    async screenshot() {
      return {
        bytes: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nYQAAAAASUVORK5CYII=",
          "base64"
        ),
        mimeType: "image/png",
        sensitivity: "internal",
        redactionStatus: "not_needed"
      };
    }
  };
}

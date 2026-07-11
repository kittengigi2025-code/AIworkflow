import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { runClosingJob } from "../../src/qa-workstation/closing-job.mjs";
import { runAuthorizedBrowserCase } from "../../src/qa-workstation/authorized-browser-execution.mjs";
import { runQuestionGateJob } from "../../src/qa-workstation/question-gate-job.mjs";
import { runReadOnlyPlanningJob } from "../../src/qa-workstation/read-only-planning-job.mjs";

test.describe("closing job: reports, ledger, and retrospective", () => {
  test("an all-passing job generates a report with no bugs and a ledger row", async ({}, testInfo) => {
    const intake = await prepareCompletedJob(testInfo, "all-passing");
    const result = await runClosingJob({ workspace: intake.workspace, workspaceRoot: intake.workspaceRoot });

    const bugs = JSON.parse(await readFile(result.artifacts.bugs, "utf8"));
    expect(bugs.bugs).toEqual([]);

    const reportHtml = await readFile(result.artifacts.testReport, "utf8");
    expect(reportHtml).toContain("Confirmed Rules");
    expect(reportHtml).toContain("RULE-001");
    expect(reportHtml).toContain("Test Case Results");
    expect(reportHtml).toContain("passed");
    expect(reportHtml).not.toContain("Discovered Issues");

    expect(await fileExists(result.artifacts.bugTickets)).toBe(false);

    const retro = JSON.parse(await readFile(result.artifacts.retrospective, "utf8"));
    expect(retro.requirement_id).toBe(intake.requirementId);
    expect(retro.workflow_findings).toEqual([]);
    expect(retro.new_heuristics).toEqual([]);
    expect(retro.do_not_generalize).toEqual([]);

    const ledgerHtml = await readFile(result.artifacts.ledger, "utf8");
    expect(ledgerHtml).toContain("QA Ledger");
    expect(ledgerHtml).toContain(intake.requirementId);
    expect(ledgerHtml).toContain("test-report.html");
    expect(ledgerHtml).toContain("—");

    await expect(access(path.join(intake.workspace, "evidence", "EV-001.png"))).resolves.toBeUndefined();
  });

  test("a job with failures generates bug tickets with full traceability", async ({}, testInfo) => {
    const intake = await prepareCompletedJob(testInfo, "with-bugs", { failStep: true });
    const result = await runClosingJob({ workspace: intake.workspace, workspaceRoot: intake.workspaceRoot });

    const bugs = JSON.parse(await readFile(result.artifacts.bugs, "utf8"));
    expect(bugs.bugs).toHaveLength(1);
    expect(bugs.bugs[0]).toMatchObject({
      bug_id: "BUG-001",
      severity: "major",
      status: "open",
      environment: "UAT",
      case_ids: ["TC-001"],
      rule_ids: ["RULE-001"]
    });
    expect(bugs.bugs[0].repro_steps.length).toBeGreaterThan(0);
    expect(bugs.bugs[0].expected_result).toBeTruthy();
    expect(bugs.bugs[0].actual_result).toBeTruthy();

    expect(await fileExists(result.artifacts.bugTickets)).toBe(true);
    const bugHtml = await readFile(result.artifacts.bugTickets, "utf8");
    expect(bugHtml).toContain('id="BUG-001"');
    expect(bugHtml).toContain("Preconditions");
    expect(bugHtml).toContain("Reproduction Steps");
    expect(bugHtml).toContain("Expected Result");
    expect(bugHtml).toContain("Actual Result");
    expect(bugHtml).toContain("RULE-001");
    expect(bugHtml).toContain("TC-001");

    const reportHtml = await readFile(result.artifacts.testReport, "utf8");
    expect(reportHtml).toContain("Discovered Issues");
    expect(reportHtml).toContain("BUG-001");
    expect(reportHtml).toContain('href="bug-tickets.html#BUG-001"');

    const ledgerHtml = await readFile(result.artifacts.ledger, "utf8");
    expect(ledgerHtml).toContain("1");
    expect(ledgerHtml).toContain("bug-tickets.html");
  });

  test("running closing twice does not duplicate ledger rows", async ({}, testInfo) => {
    const intake = await prepareCompletedJob(testInfo, "idempotent");
    const workspaceRoot = intake.workspaceRoot;

    await runClosingJob({ workspace: intake.workspace, workspaceRoot });
    await runClosingJob({ workspace: intake.workspace, workspaceRoot });

    const ledgerPath = path.join(workspaceRoot, "qa-index.html");
    const ledgerHtml = await readFile(ledgerPath, "utf8");
    const rowCount = (ledgerHtml.match(/<tr>\s*<td>/g) || []).length;
    expect(rowCount).toBe(1);
  });

  test("sensitive evidence with incomplete redaction is withheld from HTML", async ({}, testInfo) => {
    const intake = await prepareCompletedJob(testInfo, "sensitive-ev", { failStep: true, sensitiveEvidence: true });
    const result = await runClosingJob({ workspace: intake.workspace, workspaceRoot: intake.workspaceRoot });

    const bugHtml = await readFile(result.artifacts.bugTickets, "utf8");
    expect(bugHtml).toContain("withheld");
    expect(bugHtml).not.toContain('src="evidence/EV-001.png"');

    const reportHtml = await readFile(result.artifacts.testReport, "utf8");
    expect(reportHtml).toContain("(withheld)");
  });

  test("all internal links resolve on disk", async ({}, testInfo) => {
    const intake = await prepareCompletedJob(testInfo, "links");
    const result = await runClosingJob({ workspace: intake.workspace, workspaceRoot: intake.workspaceRoot });

    const reportHtml = await readFile(result.artifacts.testReport, "utf8");
    const evidenceLinks = reportHtml.match(/href="evidence\/[^"]+"/g) || [];
    for (const link of evidenceLinks) {
      const filePath = link.replace(/href="|"/g, "");
      await expect(access(path.join(intake.workspace, filePath))).resolves.toBeUndefined();
    }

    await expect(access(path.join(intake.workspace, "test-report.html"))).resolves.toBeUndefined();
    await expect(access(result.artifacts.ledger)).resolves.toBeUndefined();
  });

  test("retrospective gate rejects weak findings promoted to heuristics", async ({}, testInfo) => {
    const intake = await prepareCompletedJob(testInfo, "retro-gate");
    const badRetrospective = {
      workflow_findings: [
        { type: "domain_rule", finding: "VIP levels start at 1", reuse_scope: "requirement_specific", confidence: "confirmed", recommended_update: "Apply as global rule" }
      ],
      new_heuristics: [
        { text: "VIP levels start at 1", allowed_scope: "gaming_domain", evidence: "VIP levels start at 1" }
      ],
      do_not_generalize: []
    };

    await expect(
      runClosingJob({
        workspace: intake.workspace,
        workspaceRoot: intake.workspaceRoot,
        retrospective: badRetrospective
      })
    ).rejects.toThrow(/not confirmed or is requirement-specific/);
  });

  test("retrospective accepts confirmed gaming-domain findings as heuristics", async ({}, testInfo) => {
    const intake = await prepareCompletedJob(testInfo, "retro-ok");
    const goodRetrospective = {
      workflow_findings: [
        { type: "domain_rule", finding: "Member count must match visible rows", reuse_scope: "gaming_domain", confidence: "confirmed", recommended_update: "Add to domain checklist" }
      ],
      new_heuristics: [
        { text: "Member count must match visible rows", allowed_scope: "gaming_domain", evidence: "Member count must match visible rows" }
      ],
      do_not_generalize: ["VIP0 offset is merchant-specific"]
    };

    const result = await runClosingJob({
      workspace: intake.workspace,
      workspaceRoot: intake.workspaceRoot,
      retrospective: goodRetrospective
    });

    const retro = JSON.parse(await readFile(result.artifacts.retrospective, "utf8"));
    expect(retro.new_heuristics).toHaveLength(1);
    expect(retro.do_not_generalize).toHaveLength(1);
  });

  test("HTML report is readable on mobile viewport", async ({ page }, testInfo) => {
    const intake = await prepareCompletedJob(testInfo, "mobile-html");
    const result = await runClosingJob({ workspace: intake.workspace, workspaceRoot: intake.workspaceRoot });

    await page.goto(`file:///${path.resolve(result.artifacts.testReport)}`, { waitUntil: "domcontentloaded" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible();
    const tableBox = await page.locator("table").first().boundingBox();
    expect(tableBox?.width).toBeLessThanOrEqual(390);
  });
});

async function prepareCompletedJob(testInfo, suffix, options = {}) {
  const workspaceRoot = testInfo.outputPath(`jobs-${suffix}`);

  const intake = await runQuestionGateJob({
    workspaceRoot,
    rawJob: {
      requirementId: `REQ-20260711-${suffix}`,
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
          { area: "permission", risk: "high", whyItMatters: "Merchant scope isolation.", coverage: "P0" }
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
          testData: [{ name: "vipLevel", value: "VIP1", sensitivity: "internal", source: "provided" }],
          steps: [
            {
              action: "Navigate to VIP management",
              actionClass: "read_only",
              targetSurface: "management_backend",
              operation: "navigate",
              operationTarget: "/members/vip",
              assertion: { operator: "contains", expected: "/members/vip" },
              expectedObservation: "Navigate succeeds",
              evidenceRequired: false
            },
            {
              action: "Filter to VIP1",
              actionClass: "read_only",
              targetSurface: "management_backend",
              operation: "filter",
              operationTarget: "VIP",
              operationValue: "VIP1",
              assertion: { operator: "contains", expected: "VIP1" },
              expectedObservation: "Filter succeeds",
              evidenceRequired: false
            },
            {
              action: "Open VIP1 members",
              actionClass: "read_only",
              targetSurface: "management_backend",
              operation: "open_detail",
              operationTarget: "VIP1 members",
              assertion: { operator: "contains", expected: "VIP1 members" },
              expectedObservation: "Open detail succeeds",
              evidenceRequired: false
            },
            {
              action: "Read VIP1 and totals",
              actionClass: "read_only",
              targetSurface: "management_backend",
              operation: "read_visible",
              operationTarget: "Member VIP summary",
              assertion: {
                operator: "equals",
                expected: options.failStep ? "VIP1, 99 visible members, total 99" : "VIP1, 12 visible members, total 12"
              },
              expectedObservation: "Read visible succeeds",
              evidenceRequired: true
            }
          ],
          expectedResult: "VIP1 and its member total are visibly consistent.",
          evidenceRequired: ["Screenshot containing VIP level, rows, and total"],
          evidenceExpectationRefs: ["VIP level, rows, and total visible together"],
          residualRiskIfNotRun: "Member attribution and total remain unverified."
        }
      ]
    }
  });

  const requirementPath = intake.artifacts.requirement;
  const requirement = JSON.parse(await readFile(requirementPath, "utf8"));
  requirement.status = "ready_for_execution";
  await writeFile(requirementPath, `${JSON.stringify(requirement, null, 2)}\n`, "utf8");

  const browser = createTestBrowser(options);
  await runAuthorizedBrowserCase({ workspace: intake.workspace, browser });

  if (options.sensitiveEvidence) {
    const manifestPath = path.join(intake.workspace, "evidence-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    for (const ev of manifest.evidence || []) {
      if (ev.sensitivity === "sensitive") {
        ev.redaction_status = "required";
      }
    }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  return { workspace: intake.workspace, workspaceRoot, requirementId: `REQ-20260711-${suffix}` };
}

function createTestBrowser(options = {}) {
  const calls = [];
  const observed = options.failStep ? "VIP1, 12 visible members, total 12" : "VIP1, 12 visible members, total 12";
  return {
    calls,
    async sessionIdentity() { calls.push(["session_identity"]); return "test-session"; },
    async claim(owner) { calls.push(["claim", owner]); return true; },
    async release(owner) { calls.push(["release", owner]); },
    async inspectSession() {
      calls.push(["inspect_session"]);
      return { state: "ready", environment: "UAT", merchantScope: "merchant-7788", surface: "management_backend" };
    },
    async navigate(target) { calls.push(["navigate", target]); return { visible: true, observed: `Opened ${target}`, facts: [] }; },
    async filter(target, value) { calls.push(["filter", target, value]); return { visible: true, observed: `${target} is ${value}`, facts: [] }; },
    async openDetail(target) { calls.push(["open_detail", target]); return { visible: true, observed: `Opened ${target}`, facts: [] }; },
    async readVisible(target) {
      calls.push(["read_visible", target]);
      return { visible: true, matchesExpected: !options.failStep, observed, facts: [observed] };
    },
    async screenshot({ stepId }) {
      calls.push(["screenshot", stepId]);
      return {
        bytes: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nYQAAAAASUVORK5CYII=", "base64"),
        mimeType: "image/png",
        sensitivity: options.sensitiveEvidence ? "sensitive" : "internal",
        redactionStatus: options.sensitiveEvidence ? "complete" : "not_needed"
      };
    }
  };
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

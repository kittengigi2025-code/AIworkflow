import { access, mkdir, readFile, rename, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

import { PHASES, markPhaseDone, markPhaseInProgress } from "./job-phase.mjs";

const BUG_SEVERITIES = new Set(["blocker", "critical", "major", "minor", "trivial"]);
const BUG_PRIORITIES = new Set(["P0", "P1", "P2"]);
const FINDING_TYPES = new Set([
  "prompt_gap",
  "artifact_gap",
  "browser_gap",
  "domain_rule",
  "automation_candidate",
  "low_value_check"
]);
const REUSE_SCOPES = new Set(["global", "gaming_domain", "merchant_specific", "requirement_specific"]);
const CONFIDENCE_LEVELS = new Set(["confirmed", "probable", "weak"]);
const SENSITIVE_PATTERN = /(?:password|passwd|secret|token|bearer|cookie|otp|captcha|api[_-]?key|authorization|credential)/gi;

export async function runClosingJob({ workspace, workspaceRoot, retrospective }) {
  assertString(workspace, "workspace");

  const requirementPath = path.join(workspace, "requirement.json");
  const requirement = await readJson(requirementPath);

  markPhaseInProgress(requirement, PHASES.close);

  const questions = await readJsonIfExists(path.join(workspace, "questions.json"));
  const strategy = await readJsonIfExists(path.join(workspace, "strategy.json"));
  const testCases = await readJsonIfExists(path.join(workspace, "test-cases.json"));
  const executionResults = await readJsonIfExists(path.join(workspace, "execution-results.json"));
  const evidenceManifest = await readJsonIfExists(path.join(workspace, "evidence-manifest.json"));

  if (!executionResults) {
    throw new Error("execution-results.json is required to close a job");
  }

  const caseMap = buildCaseMap(testCases);
  const evidenceMap = buildEvidenceMap(evidenceManifest);
  const bugs = synthesizeBugs(requirement, executionResults, caseMap);

  const existingRetrospective = await readJsonIfExists(path.join(workspace, "retrospective.json"));
  const retrospectiveData = buildRetrospective(
    requirement,
    retrospective === undefined ? existingRetrospective : retrospective
  );
  validateRetrospectiveGate(retrospectiveData);

  const testReportHtml = renderTestReport({
    requirement,
    questions,
    strategy,
    testCases,
    executionResults,
    evidenceManifest,
    bugs,
    evidenceMap
  });

  const artifacts = {
    bugs: path.join(workspace, "bugs.json"),
    testReport: path.join(workspace, "test-report.html"),
    retrospective: path.join(workspace, "retrospective.json"),
    closingManifest: path.join(workspace, "closing-manifest.json")
  };

  const writes = [
    [artifacts.bugs, `${JSON.stringify({ requirement_id: requirement.requirement_id, bugs }, null, 2)}\n`],
    [artifacts.testReport, testReportHtml],
    [artifacts.retrospective, `${JSON.stringify(retrospectiveData, null, 2)}\n`]
  ];

  let bugTicketsHtml = null;
  if (bugs.length > 0) {
    bugTicketsHtml = renderBugTickets({ requirement, bugs, evidenceMap, caseMap, executionResults });
    artifacts.bugTickets = path.join(workspace, "bug-tickets.html");
    writes.push([artifacts.bugTickets, bugTicketsHtml]);
  }

  validateNoSecretLeaks(testReportHtml);
  if (bugTicketsHtml) {
    validateNoSecretLeaks(bugTicketsHtml);
  }

  await publishArtifacts(writes);

  const ledgerPath = await regenerateLedger({
    workspaceRoot: workspaceRoot || path.dirname(workspace),
    workspace,
    requirement,
    bugs
  });
  artifacts.ledger = ledgerPath;

  await markPhaseDone(requirement, workspace, PHASES.close, [
    "bugs.json",
    "test-report.html",
    "retrospective.json",
    ...(artifacts.bugTickets ? ["bug-tickets.html"] : [])
  ]);
  await publishArtifacts([[requirementPath, `${JSON.stringify(requirement, null, 2)}\n`]]);

  const root = workspaceRoot || path.dirname(workspace);
  const sourcePaths = [
    "requirement.json",
    "questions.json",
    "strategy.json",
    "test-cases.json",
    "execution-results.json",
    "evidence-manifest.json"
  ].map((name) => path.join(workspace, name));
  const outputPaths = [
    artifacts.bugs,
    artifacts.testReport,
    artifacts.retrospective,
    ...(artifacts.bugTickets ? [artifacts.bugTickets] : []),
    artifacts.ledger
  ];
  const closingManifest = {
    requirement_id: requirement.requirement_id,
    generated_at: new Date().toISOString(),
    source_revisions: await hashExistingFiles(sourcePaths, workspace),
    outputs: await hashExistingFiles(outputPaths, root)
  };
  await publishArtifacts([
    [artifacts.closingManifest, `${JSON.stringify(closingManifest, null, 2)}\n`]
  ]);

  return {
    status: requirement.status,
    workspace,
    artifacts
  };
}

function synthesizeBugs(requirement, executionResults, caseMap) {
  const bugs = [];
  let bugNum = 1;

  for (const run of executionResults.runs || []) {
    const failedSteps = (run.step_results || []).filter((s) => s.status === "failed");
    if (failedSteps.length === 0 && run.status !== "failed") continue;

    const testCase = caseMap.get(run.case_id);
    const failingStep = failedSteps[0] || run.step_results?.[run.step_results.length - 1];
    const stepDef = testCase?.steps?.find((s) => s.step_id === failingStep?.step_id);
    const bugId = `BUG-${String(bugNum).padStart(3, "0")}`;
    bugNum++;

    const regression = findPassingRetry(executionResults.runs || [], run.result_id);
    bugs.push({
      bug_id: bugId,
      title: testCase ? `${testCase.title} — ${failingStep?.step_id || "failure"}` : `${run.case_id} failure`,
      severity: "major",
      priority: testCase?.priority || "P1",
      impact_scope: testCase?.risk_area || "unknown",
      environment: requirement.environment?.name || "unknown",
      preconditions: testCase?.preconditions || [],
      repro_steps: (testCase?.steps || []).map((s, i) => `${i + 1}. ${s.action}`),
      expected_result: stepDef?.assertion?.expected || testCase?.expected_result || "Expected observation not met",
      actual_result: failingStep?.observed || "Observed state contradicted expected state",
      rule_ids: testCase?.rule_ids || [],
      case_ids: [run.case_id],
      result_ids: [run.result_id],
      evidence_ids: failedSteps.flatMap((s) => s.evidence_ids || []),
      status: regression ? "closed" : "open",
      regression_result: regression ? `passed:${regression.result_id}` : ""
    });
  }

  return bugs;
}

function findPassingRetry(runs, resultId) {
  let frontier = [resultId];
  const seen = new Set(frontier);
  while (frontier.length > 0) {
    const children = runs.filter((run) => frontier.includes(run.retry_of) && !seen.has(run.result_id));
    const passed = children.find((run) => run.status === "passed");
    if (passed) return passed;
    frontier = children.map((run) => run.result_id);
    frontier.forEach((id) => seen.add(id));
  }
  return null;
}

function renderTestReport(ctx) {
  const { requirement, questions, strategy, testCases, executionResults, evidenceManifest, bugs, evidenceMap } = ctx;
  const env = requirement.environment || {};
  const runs = executionResults.runs || [];
  const allStepResults = runs.flatMap((r) => r.step_results || []);
  const residualRisks = allStepResults.filter((s) => s.status === "blocked" || s.status === "residual_risk");
  const evidence = evidenceManifest?.evidence || [];

  const bugIds = bugs.map((b) => b.bug_id);

  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(requirement.title)} — Test Report</title>
<style>
:root { --bg:#f5f6fa; --panel:#fff; --line:#e0e0e0; --ok:#1a7f37; --warn:#b08800; --fail:#cf222e; --info:#0969da; --chip:#e8f0fe; }
* { box-sizing: border-box; }
body { font-family: sans-serif; margin:0; padding:16px; background:var(--bg); color:#1f2328; }
h1 { font-size:20px; margin:0 0 4px; }
h2 { font-size:16px; margin:20px 0 8px; border-bottom:1px solid var(--line); padding-bottom:4px; }
.meta { color:#656d76; font-size:13px; margin-bottom:12px; }
.badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:12px; background:var(--chip); color:var(--info); margin-right:4px; }
.badge.pass { background:#dcffe4; color:var(--ok); }
.badge.fail { background:#ffebe9; color:var(--fail); }
.badge.block { background:#fff8c5; color:var(--warn); }
table { width:100%; border-collapse:collapse; background:var(--panel); border-radius:4px; overflow:hidden; margin-bottom:12px; }
th, td { padding:8px 12px; text-align:left; border-bottom:1px solid var(--line); font-size:14px; }
th { background:#f0f0f0; font-weight:600; }
td.status-passed { color:var(--ok); font-weight:600; }
td.status-failed { color:var(--fail); font-weight:600; }
td.status-blocked, td.status-residual_risk { color:var(--warn); }
.evidence-img { max-width:100%; border:1px solid var(--line); border-radius:4px; margin:4px 0; }
.residual { background:#fff8c5; padding:8px 12px; border-radius:4px; font-size:13px; margin-bottom:4px; }
a { color:var(--info); text-decoration:none; }
a:hover { text-decoration:underline; }
@media (max-width: 860px) { table { font-size:12px; } th, td { padding:4px 6px; } .evidence-img { max-width:100%; } }
</style>
</head>
<body>
<h1>${escapeHtml(requirement.title)}</h1>
<div class="meta">
  <span class="badge">${escapeHtml(requirement.requirement_id)}</span>
  <span class="badge">Env: ${escapeHtml(env.name || "unknown")}</span>
  <span class="badge">Merchant: ${escapeHtml(env.merchant_scope || "unknown")}</span>
  <span class="badge ${statusClass(requirement.status)}">${escapeHtml(requirement.status)}</span>
</div>

<h2>Confirmed Rules</h2>
<table>
<thead><tr><th>Rule ID</th><th>Text</th><th>Risk Area</th><th>Impact</th></tr></thead>
<tbody>
${(requirement.confirmed_rules || []).map((r) => `<tr><td>${escapeHtml(r.rule_id)}</td><td>${escapeHtml(r.text)}</td><td>${escapeHtml(r.risk_area)}</td><td>${escapeHtml(r.pass_fail_impact)}</td></tr>`).join("")}
</tbody>
</table>

${(requirement.assumptions || []).length > 0 ? `
<h2>Assumptions</h2>
<table>
<thead><tr><th>Assumption</th><th>Risk If Wrong</th></tr></thead>
<tbody>
${(requirement.assumptions || []).map((a) => `<tr><td>${escapeHtml(a.text)}</td><td>${escapeHtml(a.risk_if_wrong)}</td></tr>`).join("")}
</tbody>
</table>` : ""}

${questions ? `
<h2>Questions</h2>
<table>
<thead><tr><th>Q ID</th><th>Classification</th><th>Question</th><th>Answered</th></tr></thead>
<tbody>
${(questions.questions || []).map((q) => `<tr><td>${escapeHtml(q.question_id || "")}</td><td>${escapeHtml(q.classification || "")}</td><td>${escapeHtml(q.question || "")}</td><td>${q.answer ? "Yes" : "No"}</td></tr>`).join("")}
</tbody>
</table>` : ""}

${strategy ? `
<h2>Strategy</h2>
<table>
<thead><tr><th>Scope</th><th>Items</th></tr></thead>
<tbody>
<tr><td>In Scope</td><td>${escapeHtml((strategy.scope?.in_scope || []).join(", "))}</td></tr>
<tr><td>Out of Scope</td><td>${escapeHtml((strategy.scope?.out_of_scope || []).join(", "))}</td></tr>
<tr><td>Blocked</td><td>${escapeHtml((strategy.scope?.blocked_scope || []).join(", "))}</td></tr>
</tbody>
</table>` : ""}

<h2>Test Case Results</h2>
<table>
<thead><tr><th>Run</th><th>Case ID</th><th>Rules</th><th>Priority</th><th>Status</th><th>Observed</th><th>Evidence</th>${bugIds.length > 0 ? "<th>Bug</th>" : ""}</tr></thead>
<tbody>
${runs.map((run) => {
  const testCase = (testCases?.cases || []).find((c) => c.case_id === run.case_id);
  const evIds = (run.step_results || []).flatMap((s) => s.evidence_ids || []);
  const observations = (run.step_results || [])
    .map((step) => step.observed)
    .filter(Boolean)
    .join(" | ");
  const bugLinks = bugs
    .filter((b) => b.result_ids?.includes(run.result_id))
    .map((b) => `<a href="bug-tickets.html#${b.bug_id}">${b.bug_id}</a>`);
  return `<tr>
<td>${escapeHtml(run.result_id)}${run.retry_of ? `<br><small>after ${escapeHtml(run.retry_of)}</small>` : ""}</td>
<td>${escapeHtml(run.case_id)}</td>
<td>${escapeHtml(testCase?.rule_ids?.join(", ") || "")}</td>
<td>${escapeHtml(testCase?.priority || "")}</td>
<td class="status-${run.status}">${escapeHtml(run.status)}</td>
<td>${escapeHtml(observations || run.judgment || "")}</td>
<td>${evIds.map((id) => safeEvidenceLink(id, evidenceMap)).join(" ")}</td>
${bugIds.length > 0 ? `<td>${bugLinks.join(", ") || "—"}</td>` : ""}
</tr>`;
}).join("")}
</tbody>
</table>

${residualRisks.length > 0 ? `
<h2>Residual Risks</h2>
${residualRisks.map((s) => `<div class="residual"><strong>${escapeHtml(s.step_id)}</strong>: ${escapeHtml(s.blocker || "residual_risk")} — ${escapeHtml(s.observed || "")}</div>`).join("")}` : ""}

${bugs.length > 0 ? `
<h2>Discovered Issues</h2>
<table>
<thead><tr><th>Bug ID</th><th>Title</th><th>Severity</th><th>Status</th></tr></thead>
<tbody>
${bugs.map((b) => `<tr><td><a href="bug-tickets.html#${b.bug_id}">${b.bug_id}</a></td><td>${escapeHtml(b.title)}</td><td>${escapeHtml(b.severity)}</td><td>${escapeHtml(b.status)}</td></tr>`).join("")}
</tbody>
</table>` : ""}

</body>
</html>`;
}

function renderBugTickets({ requirement, bugs, evidenceMap, caseMap, executionResults }) {
  const runs = executionResults.runs || [];

  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(requirement.title)} — Bug Tickets</title>
<style>
:root { --bg:#f5f6fa; --panel:#fff; --line:#e0e0e0; --fail:#cf222e; --warn:#b08800; --info:#0969da; }
* { box-sizing: border-box; }
body { font-family: sans-serif; margin:0; padding:16px; background:var(--bg); }
h1 { font-size:20px; }
.bug { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; margin-bottom:16px; }
.bug h2 { font-size:16px; margin:0 0 8px; }
.bug h2 a { color:var(--info); }
.meta { font-size:13px; color:#656d76; margin-bottom:8px; }
.meta span { margin-right:8px; }
table { width:100%; border-collapse:collapse; margin-bottom:8px; }
th, td { padding:6px 10px; text-align:left; border-bottom:1px solid var(--line); font-size:13px; }
th { background:#f0f0f0; }
.steps { counter-reset: step; margin:8px 0; padding-left:0; list-style:none; }
.steps li { counter-increment: step; padding:4px 0 4px 28px; position:relative; font-size:14px; }
.steps li::before { content: counter(step); position:absolute; left:0; top:4px; width:20px; height:20px; border-radius:50%; background:var(--info); color:#fff; font-size:11px; line-height:20px; text-align:center; }
.evidence-img { max-width:100%; border:1px solid var(--line); border-radius:4px; margin:4px 0; }
a { color:var(--info); text-decoration:none; }
@media (max-width: 860px) { .bug { padding:8px; } table { font-size:12px; } }
</style>
</head>
<body>
<h1>Bug Tickets — ${escapeHtml(requirement.title)}</h1>
${bugs.map((bug) => {
  const evidenceItems = (bug.evidence_ids || []).map((id) => evidenceMap.get(id)).filter(Boolean);
  const testCase = caseMap.get(bug.case_ids[0]);
  const run = runs.find((r) => bug.result_ids?.includes(r.result_id));

  return `<div class="bug" id="${bug.bug_id}">
<h2><a href="#${bug.bug_id}">${bug.bug_id}</a> — ${escapeHtml(bug.title)}</h2>
<div class="meta">
<span>Severity: <strong>${escapeHtml(bug.severity)}</strong></span>
<span>Priority: <strong>${escapeHtml(bug.priority)}</strong></span>
<span>Environment: ${escapeHtml(bug.environment)}</span>
<span>Status: ${escapeHtml(bug.status)}</span>
</div>
<table>
<tr><th>Impact Scope</th><td>${escapeHtml(bug.impact_scope)}</td></tr>
<tr><th>Rules</th><td>${escapeHtml(bug.rule_ids.join(", "))}</td></tr>
<tr><th>Cases</th><td>${escapeHtml(bug.case_ids.join(", "))}</td></tr>
<tr><th>Runs</th><td>${escapeHtml((bug.result_ids || []).join(", "))}</td></tr>
${run ? `<tr><th>Run</th><td>${escapeHtml(run.result_id)}</td></tr>` : ""}
</table>
<h3>Preconditions</h3>
<ul>${(bug.preconditions || []).map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
<h3>Reproduction Steps</h3>
<ol class="steps">${(bug.repro_steps || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
<table>
<tr><th>Expected Result</th><td>${escapeHtml(bug.expected_result)}</td></tr>
<tr><th>Actual Result</th><td>${escapeHtml(bug.actual_result)}</td></tr>
</table>
${evidenceItems.length > 0 ? `<h3>Evidence</h3>${evidenceItems.map((ev) => safeEvidenceEmbed(ev)).join("")}` : ""}
</div>`;
}).join("")}
</body>
</html>`;
}

async function regenerateLedger({ workspaceRoot, workspace, requirement, bugs }) {
  const reqDir = path.basename(workspace);
  const ledgerPath = path.join(workspaceRoot, "qa-index.html");

  await mkdir(workspaceRoot, { recursive: true });

  const seen = new Set();
  const entries = [];
  const subdirs = await listDirectories(workspaceRoot);
  for (const dir of subdirs) {
    if (dir === reqDir) continue;
    const reportPath = path.join(workspaceRoot, dir, "test-report.html");
    try {
      await access(reportPath);
      const reqPath = path.join(workspaceRoot, dir, "requirement.json");
      const req = await readJsonIfExists(reqPath);
      if (!req) continue;
      const bugsJson = await readJsonIfExists(path.join(workspaceRoot, dir, "bugs.json"));
      const bugCount = bugsJson?.bugs?.length || 0;
      const hasBugTickets = await fileExists(path.join(workspaceRoot, dir, "bug-tickets.html"));
      entries.push({
        reqId: req.requirement_id,
        title: req.title,
        dir,
        status: req.status,
        bugCount,
        hasBugTickets,
        updatedAt: new Date().toISOString().slice(0, 10)
      });
      seen.add(req.requirement_id);
    } catch {
      // No report, skip
    }
  }

  if (!seen.has(requirement.requirement_id)) {
    entries.push({
      reqId: requirement.requirement_id,
      title: requirement.title,
      dir: reqDir,
      status: requirement.status,
      bugCount: bugs.length,
      hasBugTickets: bugs.length > 0,
      updatedAt: new Date().toISOString().slice(0, 10)
    });
  }

  const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QA Ledger</title>
<style>
:root { --bg:#f5f6fa; --panel:#fff; --line:#e0e0e0; --ok:#1a7f37; --fail:#cf222e; --warn:#b08800; --info:#0969da; }
* { box-sizing: border-box; }
body { font-family: sans-serif; margin:0; padding:16px; background:var(--bg); }
h1 { font-size:20px; }
table { width:100%; border-collapse:collapse; background:var(--panel); border-radius:4px; overflow:hidden; }
th, td { padding:8px 12px; text-align:left; border-bottom:1px solid var(--line); font-size:14px; }
th { background:#f0f0f0; font-weight:600; }
.status-passed { color:var(--ok); font-weight:600; }
.status-has_bugs { color:var(--fail); font-weight:600; }
.status-blocked { color:var(--warn); font-weight:600; }
a { color:var(--info); text-decoration:none; }
a:hover { text-decoration:underline; }
@media (max-width: 860px) { table { font-size:12px; } th, td { padding:4px 6px; } }
</style>
</head>
<body>
<h1>QA Ledger</h1>
<table>
<thead><tr><th>Date</th><th>Requirement</th><th>Status</th><th>Issues</th><th>Report</th><th>Bug Tickets</th><th>Regression</th></tr></thead>
<tbody>
${entries.map((e) => `<tr>
<td>${e.updatedAt}</td>
<td>${escapeHtml(e.reqId)} — ${escapeHtml(e.title || "")}</td>
<td class="status-${e.status}">${escapeHtml(e.status || "")}</td>
<td>${e.bugCount}</td>
<td><a href="${e.dir}/test-report.html">Report</a></td>
<td>${e.hasBugTickets ? `<a href="${e.dir}/bug-tickets.html">Bugs</a>` : "—"}</td>
<td>—</td>
</tr>`).join("")}
</tbody>
</table>
</body>
</html>`;

  await writeFile(ledgerPath, html, "utf8");
  return ledgerPath;
}

function buildRetrospective(requirement, retrospective) {
  if (retrospective && typeof retrospective === "object") {
    return {
      requirement_id: requirement.requirement_id,
      workflow_findings: retrospective.workflow_findings || [],
      new_heuristics: retrospective.new_heuristics || [],
      do_not_generalize: retrospective.do_not_generalize || []
    };
  }

  return {
    requirement_id: requirement.requirement_id,
    workflow_findings: [],
    new_heuristics: [],
    do_not_generalize: []
  };
}

function validateRetrospectiveGate(retrospective) {
  for (const finding of retrospective.workflow_findings) {
    if (!FINDING_TYPES.has(finding.type)) {
      throw new Error(`Unknown finding type: ${finding.type}`);
    }
    if (!REUSE_SCOPES.has(finding.reuse_scope)) {
      throw new Error(`Unknown reuse scope: ${finding.reuse_scope}`);
    }
    if (!CONFIDENCE_LEVELS.has(finding.confidence)) {
      throw new Error(`Unknown confidence level: ${finding.confidence}`);
    }
  }

  const eligible = retrospective.workflow_findings.filter(
    (f) => f.reuse_scope !== "requirement_specific" && f.confidence === "confirmed"
  );
  const eligibleTexts = new Set(eligible.map((f) => f.finding));

  for (const heuristic of retrospective.new_heuristics) {
    if (!eligibleTexts.has(heuristic.evidence)) {
      throw new Error(
        `Heuristic "${heuristic.text}" references finding that is not confirmed or is requirement-specific`
      );
    }
  }
}

function buildCaseMap(testCases) {
  const map = new Map();
  if (testCases?.cases) {
    for (const c of testCases.cases) {
      map.set(c.case_id, c);
    }
  }
  return map;
}

function buildEvidenceMap(evidenceManifest) {
  const map = new Map();
  if (evidenceManifest?.evidence) {
    for (const e of evidenceManifest.evidence) {
      map.set(e.evidence_id, e);
    }
  }
  return map;
}

function safeEvidenceEmbed(ev) {
  if (!ev) return "";
  if (ev.sensitivity === "sensitive" && ev.redaction_status !== "complete") {
    return `<div class="residual">Evidence ${escapeHtml(ev.evidence_id)} is sensitive and not fully redacted — image withheld.</div>`;
  }
  return `<img class="evidence-img" src="${escapeHtml(ev.path)}" alt="${escapeHtml(ev.description || ev.evidence_id)}">`;
}

function safeEvidenceLink(evidenceId, evidenceMap) {
  const ev = evidenceMap.get(evidenceId);
  if (!ev) return escapeHtml(evidenceId);
  if (ev.sensitivity === "sensitive" && ev.redaction_status !== "complete") {
    return `${escapeHtml(evidenceId)} (withheld)`;
  }
  return `<a href="${escapeHtml(ev.path)}">${escapeHtml(evidenceId)}</a>`;
}

function validateNoSecretLeaks(html) {
  const matches = html.match(SENSITIVE_PATTERN);
  if (matches) {
    throw new Error(`Generated HTML contains potential sensitive values: ${matches.slice(0, 5).join(", ")}`);
  }
}

function statusClass(status) {
  if (status === "passed") return "pass";
  if (status === "has_bugs") return "fail";
  if (status === "blocked") return "block";
  return "";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function publishArtifacts(writes) {
  const tempFiles = [];
  try {
    for (const [targetPath, content] of writes) {
      await mkdir(path.dirname(targetPath), { recursive: true });
      const tmp = `${targetPath}.${randomUUID()}.tmp`;
      await writeFile(tmp, content, "utf8");
      tempFiles.push([tmp, targetPath]);
    }
    for (const [tmp, targetPath] of tempFiles) {
      await rename(tmp, targetPath);
    }
  } catch (error) {
    for (const [tmp] of tempFiles) {
      await rm(tmp, { force: true });
    }
    throw error;
  }
}

async function listDirectories(dir) {
  const { readdir } = await import("node:fs/promises");
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function readJson(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function readJsonIfExists(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function hashExistingFiles(filePaths, relativeRoot) {
  const revisions = [];
  for (const filePath of filePaths) {
    try {
      const bytes = await readFile(filePath);
      revisions.push({
        path: path.relative(relativeRoot, filePath).replaceAll(path.sep, "/"),
        sha256: createHash("sha256").update(bytes).digest("hex")
      });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return revisions;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
}

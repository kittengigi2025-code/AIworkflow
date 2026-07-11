import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { resumeQaJob } from "./resume-job.mjs";

const TERMINAL = new Set(["passed", "has_bugs", "blocked", "residual_risk"]);

export async function runQaWorkstation(options) {
  const result = await resumeQaJob(options);
  if (!TERMINAL.has(result.status)) return result;

  const validation = await validateTerminalPackage(result.workspace);
  const requirement = await readJson(path.join(result.workspace, "requirement.json"));
  const record = {
    schema_version: 1,
    requirement_id: requirement.requirement_id,
    accepted_at: new Date().toISOString(),
    product_status: result.status,
    workstation_status: validation.valid ? "passed" : "failed",
    residual_risks: requirement.residual_risks ?? [],
    human_next_action: result.status === "blocked" ? result.blocker ?? "resolve_recorded_blocker" : null,
    unattended_after_start: true,
    validation
  };
  const acceptanceRecord = path.join(result.workspace, "acceptance-record.json");
  await writeFile(acceptanceRecord, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  if (!validation.valid) throw new Error(`Terminal package validation failed: ${validation.errors.join("; ")}`);
  return { ...result, acceptance: record, artifacts: { ...result.artifacts, acceptanceRecord } };
}

export async function validateTerminalPackage(workspace) {
  const requirement = await readJson(path.join(workspace, "requirement.json"));
  const casesDoc = await readJson(path.join(workspace, "test-cases.json"));
  const execution = await readJson(path.join(workspace, "execution-results.json"));
  const manifest = await readJson(path.join(workspace, "evidence-manifest.json"));
  const bugs = await readJson(path.join(workspace, "bugs.json"));
  const errors = [];
  const rules = new Set((requirement.confirmed_rules ?? []).map((x) => x.rule_id));
  const cases = new Map((casesDoc.cases ?? []).map((x) => [x.case_id, x]));
  const evidence = new Set((manifest.evidence ?? []).map((x) => x.evidence_id));
  const runs = new Set((execution.runs ?? []).map((x) => x.result_id));

  for (const rule of rules) {
    if (![...cases.values()].some((x) => x.rule_ids?.includes(rule))) errors.push(`uncovered rule ${rule}`);
  }
  for (const run of execution.runs ?? []) {
    const testCase = cases.get(run.case_id);
    if (!testCase) errors.push(`unknown case ${run.case_id}`);
    for (const step of run.step_results ?? []) {
      if (!testCase?.steps?.some((x) => x.step_id === step.step_id)) errors.push(`unknown step ${step.step_id}`);
      if (step.authorization_ref && !step.authorization_ref.startsWith("prepared-session:")) errors.push(`invalid authorization ${step.step_id}`);
      for (const id of step.evidence_ids ?? []) if (!evidence.has(id)) errors.push(`missing evidence ${id}`);
    }
  }
  for (const bug of bugs.bugs ?? []) {
    for (const id of bug.result_ids ?? []) if (!runs.has(id)) errors.push(`missing bug run ${id}`);
    for (const id of bug.evidence_ids ?? []) if (!evidence.has(id)) errors.push(`missing bug evidence ${id}`);
  }
  for (const item of manifest.evidence ?? []) {
    try { await readFile(path.resolve(workspace, item.path)); } catch { errors.push(`missing evidence file ${item.evidence_id}`); }
  }
  for (const name of ["test-report.html", "retrospective.json", "closing-manifest.json"]) {
    try { await readFile(path.join(workspace, name)); } catch { errors.push(`missing artifact ${name}`); }
  }
  return { valid: errors.length === 0, errors };
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

import { createHash, randomUUID } from "node:crypto";
import { access, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const PHASES = {
  intake: "intake",
  design: "design",
  execute: "execute",
  close: "close"
};

export const PHASE_JOURNAL_STATES = {
  pending: "pending",
  inProgress: "in_progress",
  done: "done"
};

const PHASE_ARTIFACTS = {
  [PHASES.intake]: ["requirement.json", "questions.json"],
  [PHASES.design]: ["strategy.json", "test-cases.json"],
  [PHASES.execute]: ["execution-results.json", "evidence-manifest.json"],
  [PHASES.close]: ["bugs.json", "test-report.html", "retrospective.json"]
};

export async function inspectJob(workspace) {
  const requirementPath = path.join(workspace, "requirement.json");
  const requirement = await readJsonIfExists(requirementPath);
  if (!requirement) {
    return { phase: PHASES.intake, nextAction: "run_question_gate", missingArtifacts: ["requirement.json"] };
  }

  const status = requirement.status;
  const journal = requirement.phase_journal ?? {};
  const artifacts = await listPresentArtifacts(workspace);

  if (status === "waiting_for_confirmation") {
    return {
      phase: PHASES.intake,
      nextAction: "await_answers",
      missingArtifacts: []
    };
  }

  if (status === "ready_for_design") {
    return {
      phase: PHASES.design,
      nextAction: "run_planning",
      missingArtifacts: []
    };
  }

  if (status === "blocked") {
    if (artifacts.has("strategy.json") && !artifacts.has("execution-results.json")) {
      return {
        phase: PHASES.design,
        nextAction: "review_blocked_plan",
        missingArtifacts: []
      };
    }
  }

  if (status === "ready_for_execution" || (status === "blocked" && artifacts.has("execution-results.json"))) {
    if (isPhaseComplete(journal, PHASES.execute) && artifacts.has("execution-results.json")) {
      return {
        phase: PHASES.execute,
        nextAction: "run_closing",
        missingArtifacts: []
      };
    }
    return {
      phase: PHASES.execute,
      nextAction: "run_execution",
      missingArtifacts: []
    };
  }

  if (["testing", "has_bugs", "passed", "blocked"].includes(status)) {
    if (isPhaseComplete(journal, PHASES.close) && artifacts.has("test-report.html")) {
      return {
        phase: PHASES.close,
        nextAction: "none",
        missingArtifacts: []
      };
    }
    return {
      phase: PHASES.execute,
      nextAction: "run_closing",
      missingArtifacts: []
    };
  }

  return {
    phase: PHASES.intake,
    nextAction: "run_question_gate",
    missingArtifacts: []
  };
}

export async function listPresentArtifacts(workspace) {
  const names = [
    "requirement.json",
    "questions.json",
    "strategy.json",
    "test-cases.json",
    "execution-results.json",
    "evidence-manifest.json",
    "bugs.json",
    "test-report.html",
    "bug-tickets.html",
    "retrospective.json"
  ];
  const present = new Set();
  for (const name of names) {
    if (await fileExists(path.join(workspace, name))) {
      present.add(name);
    }
  }
  return present;
}

export function isPhaseComplete(journal, phase) {
  return journal[phase]?.state === PHASE_JOURNAL_STATES.done;
}

export function markPhaseInProgress(requirement, phase) {
  const journal = requirement.phase_journal ?? {};
  journal[phase] = {
    state: PHASE_JOURNAL_STATES.inProgress,
    updated_at: new Date().toISOString()
  };
  requirement.phase_journal = journal;
}

export async function markPhaseDone(requirement, workspace, phase, extraArtifacts = []) {
  const artifacts = [...(PHASE_ARTIFACTS[phase] ?? []), ...extraArtifacts];
  const checksums = {};
  for (const name of artifacts) {
    const filePath = path.join(workspace, name);
    if (await fileExists(filePath)) {
      checksums[name] = await hashFile(filePath);
    }
  }
  const journal = requirement.phase_journal ?? {};
  journal[phase] = {
    state: PHASE_JOURNAL_STATES.done,
    artifacts,
    checksums,
    updated_at: new Date().toISOString()
  };
  requirement.phase_journal = journal;
}

export async function verifyPhaseIntegrity(requirement, workspace, phase) {
  const entry = requirement.phase_journal?.[phase];
  if (!entry || entry.state !== PHASE_JOURNAL_STATES.done) return false;
  for (const [name, expectedChecksum] of Object.entries(entry.checksums ?? {})) {
    const filePath = path.join(workspace, name);
    if (!(await fileExists(filePath))) return false;
    const actualChecksum = await hashFile(filePath);
    if (actualChecksum !== expectedChecksum) return false;
  }
  return true;
}

export async function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(tempPath, filePath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

export async function publishJsonArtifacts(entries) {
  const temporary = entries.map(([filePath, value]) => ({
    filePath,
    tempPath: `${filePath}.${randomUUID()}.tmp`,
    contents: `${JSON.stringify(value, null, 2)}\n`
  }));
  try {
    await Promise.all(temporary.map(({ tempPath, contents }) => writeFile(tempPath, contents, "utf8")));
    for (const { filePath, tempPath } of temporary) await rename(tempPath, filePath);
  } finally {
    await Promise.all(temporary.map(({ tempPath }) => rm(tempPath, { force: true }).catch(() => undefined)));
  }
}

async function hashFile(filePath) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJsonIfExists(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

import { readFile } from "node:fs/promises";

import { runQuestionGateJob } from "../src/qa-workstation/question-gate-job.mjs";

try {
  const inputPath = requiredOption("--input");
  const workspaceRoot = requiredOption("--workspace");
  const rawJob = JSON.parse(await readFile(inputPath, "utf8"));
  const result = await runQuestionGateJob({ rawJob, workspaceRoot });

  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Question gate failed: ${message}\n`);
  process.exitCode = 1;
}

function requiredOption(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing required option: ${name}`);
  }
  return value;
}

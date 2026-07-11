import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runQaWorkstation } from "../src/qa-workstation/workstation-runner.mjs";

const configPath = process.argv[2];
if (!configPath) throw new Error("Usage: npm run qa:run -- <job-config.json>");
const absoluteConfig = path.resolve(configPath);
const config = JSON.parse(await readFile(absoluteConfig, "utf8"));
const base = path.dirname(absoluteConfig);
const rawJob = JSON.parse(await readFile(path.resolve(base, config.rawJob), "utf8"));
const plan = JSON.parse(await readFile(path.resolve(base, config.plan), "utf8"));
const sessionModule = await import(pathToFileURL(path.resolve(base, config.sessionAdapter)).href);
const browser = await sessionModule.createPreparedSession(config.session ?? {});
const workspaceRoot = path.resolve(base, config.workspaceRoot ?? "jobs");
const result = await runQaWorkstation({
  workspace: path.join(workspaceRoot, rawJob.requirementId), workspaceRoot, rawJob, plan, browser
});
process.stdout.write(`${JSON.stringify({ status: result.status, workspace: result.workspace, artifacts: result.artifacts }, null, 2)}\n`);

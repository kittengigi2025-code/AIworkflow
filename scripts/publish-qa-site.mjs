import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const workspaceRoot = resolve(".");
const scratchRoot = join(workspaceRoot, ".scratch");
const dataPath = join(scratchRoot, "data", "qa-dashboard.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function collectLinks(data) {
  const links = [];

  for (const requirement of data.requirements ?? []) {
    for (const link of requirement.links ?? []) {
      links.push({
        owner: `requirement:${requirement.id}:${link.label}`,
        href: link.href,
      });
    }
  }

  for (const issue of data.issues ?? []) {
    for (const link of issue.links ?? []) {
      links.push({
        owner: `issue:${issue.id}:${link.label}`,
        href: link.href,
      });
    }
  }

  for (const item of data.attention ?? []) {
    links.push({
      owner: `attention:${item.type}`,
      href: item.href,
    });
  }

  for (const item of data.packages ?? []) {
    links.push({
      owner: `package:${item.name}`,
      href: item.href,
    });
  }

  if (data.multicaWorkflow?.runbookHref) {
    links.push({
      owner: "multicaWorkflow:runbook",
      href: data.multicaWorkflow.runbookHref,
    });
  }

  return links;
}

function isExternal(href) {
  return /^https?:\/\//i.test(href) || href.startsWith("mailto:");
}

function validateLinks(links) {
  const missing = [];

  for (const link of links) {
    if (!link.href || isExternal(link.href)) continue;
    const pathOnly = link.href.split("#")[0];
    if (!pathOnly) continue;
    const target = join(scratchRoot, pathOnly);
    if (!existsSync(target)) {
      missing.push({ ...link, target });
    }
  }

  return missing;
}

function summarize(data) {
  const requirements = data.requirements ?? [];
  const packages = data.packages ?? [];
  const issues = data.issues ?? [];
  const byStatus = requirements.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    requirements: requirements.length,
    issues: issues.length,
    activeIssues: issues.filter((item) => item.status === "active" || item.status === "reopened").length,
    packages: packages.length,
    status: byStatus,
    dataBytes: statSync(dataPath).size,
  };
}

if (!existsSync(dataPath)) {
  console.error(`Missing dashboard data: ${dataPath}`);
  process.exit(1);
}

const data = readJson(dataPath);
const links = collectLinks(data);
const missing = validateLinks(links);
const summary = summarize(data);

console.log(JSON.stringify({
  ok: missing.length === 0,
  summary,
  checkedLinks: links.length,
  missingLinks: missing.map(item => ({
    owner: item.owner,
    href: item.href,
    target: item.target,
  })),
}, null, 2));

if (missing.length > 0) {
  process.exit(1);
}

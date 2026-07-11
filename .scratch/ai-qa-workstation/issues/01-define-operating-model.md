Title: Define AI QA workstation operating model
Type: grilling
Status: resolved
Blocked by:

## Question

What exactly is the "AI QA workstation" as an operating model?

Resolve:

- The canonical meaning of "AI workstation" in this repo.
- Whether the first target is local files, a local web app, a command runner, a browser-control workflow, or a combined system.
- The roles inside the workflow: requirement analyst, question gatekeeper, test designer, executor, bug writer, ledger keeper, retrospective writer, and human approver.
- The lifecycle of one remote testing job from intake to final report.
- The minimum success definition for version 1.

## Answer

The v1 AI QA workstation is a local-first operating system for repeatable gaming-platform QA work. It is not a full SaaS product yet. It combines:

- A local artifact workspace under `.scratch/`.
- HTML deliverables that can be opened or shared directly.
- Structured intermediate data for requirement facts, questions, test cases, execution results, evidence, bugs, ledger entries, and retrospectives.
- Browser-control execution for H5 frontend and management backend verification.
- One main agent that owns live browser actions, final judgment, and artifact merge.
- Optional worker agents for bounded analysis or writing tasks that do not touch live authenticated browser sessions.

Canonical term:

**AI QA workstation** means the repeatable local workflow and artifact system that lets an AI agent receive a remote testing job, analyze requirements, gate blocking questions, design tests, execute authorized checks, capture evidence, write reports and bug tickets, update the QA ledger, and feed lessons back into future runs.

It is a workstation because it packages the workbench, playbook, artifacts, browser execution discipline, and memory loop. It is not just a prompt collection, not just test automation, and not a generic test management system.

## Roles

- Requirement Analyst: extracts requirement facts, acceptance rules, affected product paths, and unclear terms from source material.
- Question Gatekeeper: separates blocking questions from non-blocking uncertainties.
- Test Strategist: maps the requirement onto gaming-platform risk areas and chooses the right test depth.
- Test Designer: writes focused cases with expected evidence.
- Executor: operates H5 frontend and management backend through browser control under the safety boundary.
- Evidence Keeper: stores screenshots and observed facts close to the related result or bug.
- Bug Writer: creates developer-facing bug tickets with steps, expected result, actual result, severity, impact, and evidence.
- Ledger Keeper: updates `qa-index.html` and per-requirement status.
- Retrospective Writer: records what the workflow learned and what should be reused next time.
- Human Approver: provides credentials/session readiness, authorizes mutations when needed, answers blocking product questions, and owns final business-risk acceptance.

## Job Lifecycle

1. Intake: receive requirement text, screenshots, Axure/Lark/product notes, H5 URL, management backend URL, or an already-open browser session.
2. Normalize: create a requirement workspace and structured requirement facts.
3. Question gate: ask only blocking questions that change pass/fail criteria, data scope, permissions, money, rewards, or risk decisions.
4. Strategy: map the requirement to H5/frontend, management backend, wallet, activity, audit, report, agent, channel, or merchant surfaces.
5. Test design: generate test cases, edge cases, and evidence expectations.
6. Execution: run read-only checks by default; run mutations only after exact human authorization.
7. Evidence: capture screenshots and observations under the requirement workspace.
8. Judgment: mark each case passed, failed, blocked, not run, or residual risk.
9. Report: produce `test-report.html` and `bug-tickets.html` when issues exist.
10. Ledger: update `.scratch/qa-index.html`.
11. Feedback: update reusable heuristics, known risks, and workflow retrospectives without treating unverified project-specific assumptions as global truth.

## V1 Success Definition

Version 1 succeeds when one real remote gaming-platform QA requirement can travel from intake to final artifacts with minimal manual steering:

- Requirement facts are extracted.
- Blocking questions are identified.
- A gaming-domain test strategy is generated.
- Test cases are produced.
- Browser execution can be performed where session access exists.
- Evidence is captured.
- A readable HTML test report is produced.
- Bug tickets are produced when failures are found.
- The QA ledger is updated.
- A retrospective note records what should improve in the next run.

V1 does not need cloud deployment, a multi-user UI, automatic credential handling, automatic CAPTCHA/OTP solving, live financial approval automation, or broad support for non-gaming domains.

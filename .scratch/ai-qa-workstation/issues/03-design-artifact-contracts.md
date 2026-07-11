Title: Design QA artifact contracts
Type: prototype
Status: resolved
Blocked by: 01, 02

## Question

What artifact contracts let the workflow be both human-readable and machine-operable?

Resolve:

- Requirement facts schema.
- Blocking-question schema.
- Test strategy and test case schema.
- Execution result schema.
- Evidence manifest schema.
- Bug ticket schema.
- HTML report and ledger contract.
- How feedback from reports and retrospectives updates future requirement analysis and test design.

## Answer

The artifact contract prototype is captured in [`../artifact-contract-v1.md`](../artifact-contract-v1.md).

The core decision is to split every QA job into two artifact layers:

- Machine-operable JSON files as the source of truth.
- Human-readable HTML files as the shareable deliverables.

The required per-requirement workspace is:

```text
.scratch/<requirement-slug>/
  requirement.json
  questions.json
  strategy.json
  test-cases.json
  execution-results.json
  evidence-manifest.json
  bugs.json
  retrospective.json
  test-report.html
  bug-tickets.html
  evidence/
```

HTML reports can be regenerated from the JSON files and evidence manifest. The JSON files preserve enough structure for the next agent run to resume, audit, or improve the workflow.

## Key Contract Decisions

- `requirement.json` owns requirement facts, source references, affected H5/backend surfaces, environment, actors, confirmed rules, and assumptions.
- `questions.json` separates blocking questions from non-blocking uncertainties, so the agent interrupts the user only when pass/fail criteria, permissions, money, rewards, data scope, or risk decisions change.
- `strategy.json` owns the gaming-platform QA map for the requirement: scope, frontend/backend mapping, risk matrix, automation priority, minimal-loop position, and evidence expectations.
- `test-cases.json` owns cases and executable steps. Every executable step must include `action_class`: `read_only`, `pre_authorized_mutation`, `confirm_before_action`, or `prohibited_by_default`.
- `execution-results.json` owns run status, step observations, evidence links, blockers, bug links, and residual risks.
- `evidence-manifest.json` owns evidence paths, related cases/bugs, sensitivity, redaction status, and proof descriptions.
- `bugs.json` owns developer-facing bug facts and regression status.
- `test-report.html`, `bug-tickets.html`, and `.scratch/qa-index.html` remain the human-facing deliverables required by the QA ledger workflow.
- `retrospective.json` is the feedback loop. Findings can influence future jobs only when their reuse scope and confidence allow it; requirement-specific assumptions must not become global heuristics.

## Design Consequence

The workstation should treat HTML as output, not memory. Future implementation should generate or update HTML from structured artifacts so the AI can resume reliably after interruption and avoid losing state in prose-only reports.

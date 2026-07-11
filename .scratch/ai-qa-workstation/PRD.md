# AI QA Workstation V1

Status: ready-for-agent

## Problem Statement

Remote software-testing work for gaming platforms arrives in inconsistent forms: requirement text, screenshots, Axure or Lark material, product replies, management-backend URLs, H5 URLs, exported files, and already-open browser sessions. A tester must repeatedly reconstruct the same workflow by hand: understand the requirement, identify missing acceptance rules, map H5 and management-backend effects, assess gaming-business risk, design cases, execute browser checks, capture evidence, write bugs and reports, update a QA ledger, and remember what should improve next time.

The work is difficult to automate reliably because critical state currently lives in chat history and prose, requirement ambiguity is easily mistaken for a defect, live browser actions can change money or account state, evidence can lose its relationship to a rule or case, and lessons from one merchant can leak into another job as unverified assumptions. Multi-agent execution adds another risk when independent workers compete for a logged-in browser session or produce conflicting conclusions.

The user needs a local-first AI QA workstation that repeatedly executes the same disciplined workflow for gaming-platform requirements. It must make every step inspectable, resumable, evidence-backed, and feedback-producing. The long-term direction is unattended execution, while credentials, CAPTCHA/OTP, state-changing actions, production operations, and final business-risk acceptance remain under explicit human control.

## Solution

Build a local-first QA job runner around one high-level operation: accept a raw remote-job bundle plus an authorized browser-session handoff, then advance the job through requirement intake, question gate, test design, execution gate, single-threaded browser execution, artifact synthesis, ledger update, and retrospective learning until it reaches an evidence-backed terminal state.

Machine-operable JSON artifacts are the authoritative job memory. Human-readable HTML reports, bug tickets, and the QA ledger are regenerated views over that state and its evidence. Every confirmed rule, test case, executable step, execution result, evidence item, and bug uses stable IDs so the complete reasoning chain can be audited and resumed without relying on chat history.

The main agent is the only owner of workflow state, live browser execution, authorization gates, evidence numbering, final QA judgment, and artifact merging. Optional workers may analyze immutable snapshots and return bounded proposals, but they cannot control the browser, handle credentials, mutate authoritative artifacts, or decide final status. V1 must work correctly with the main agent alone.

The first vertical slice replays a read-only management-backend requirement for VIP member-count and member-list consistency. It begins with raw requirement material and confirmed product answers, uses a manually prepared UAT browser session, and runs without intervention after startup. The slice proves the workstation workflow rather than requiring the VIP feature itself to pass.

## User Stories

1. As a remote QA contractor, I want to submit one raw testing job, so that I do not have to manually recreate the QA workflow for every assignment.
2. As a remote QA contractor, I want the job to accept requirement text, screenshots, Axure or Lark material, product replies, URLs, and exported references, so that real-world intake formats are supported.
3. As a QA lead, I want every source fact to retain its source reference and capture time, so that conclusions can be audited later.
4. As a QA lead, I want confirmed product rules separated from assumptions, so that uncertain information is not silently treated as acceptance criteria.
5. As a product owner, I want questions that change pass/fail, data scope, permissions, money, rewards, or safety classified as blocking, so that the workstation does not invent business rules.
6. As a product owner, I want non-blocking uncertainties recorded without unnecessarily pausing the job, so that safe read-only progress can continue.
7. As a gaming-platform tester, I want each requirement mapped to H5, management-backend, merchant, member, agent, game, wallet, activity, audit, and report surfaces as applicable, so that business effects are not tested in isolation.
8. As a gaming-platform tester, I want money and traceability risks prioritized over cosmetic checks, so that high-impact failures receive the strongest coverage.
9. As a QA lead, I want a strategy that explicitly lists in-scope, out-of-scope, and blocked coverage, so that the report does not imply broader testing than was performed.
10. As a QA lead, I want every test case linked to confirmed rule IDs, so that coverage gaps can be detected automatically.
11. As a tester, I want each case to declare preconditions, test data, steps, expected observations, and evidence requirements, so that execution is reproducible.
12. As a security owner, I want every executable step assigned an action class, so that the executor can enforce the correct authorization boundary.
13. As a security owner, I want the executor to refuse steps without an action class, so that unclassified actions cannot run by accident.
14. As an operator, I want read-only browser navigation to run unattended in an authorized session, so that normal observation does not require repeated confirmation.
15. As an operator, I want scoped sandbox mutations to require recorded pre-authorization, so that permitted state changes stay bounded to the intended environment, account, object, and amount.
16. As an operator, I want sensitive or state-changing actions to require action-time confirmation, so that broad task approval cannot be misused.
17. As a security owner, I want production, credential, access-control, audit-deletion, and unauthorized financial actions prohibited by default, so that automation cannot cross critical safety boundaries.
18. As a user, I want to complete login, OTP, CAPTCHA, and password work myself before handing off the session, so that credentials do not enter the QA artifact store.
19. As a user, I want session expiry or a new login challenge to produce a precise blocked state, so that the workstation stops safely and tells me what is needed.
20. As a QA lead, I want live browser execution single-threaded under the main agent, so that concurrent workers cannot corrupt session or business state.
21. As a QA lead, I want optional workers limited to requirement extraction, risk analysis, question detection, case drafting, consistency review, bug drafting, reporting, ledger, and retrospective work, so that parallelism remains bounded.
22. As an auditor, I want each worker proposal tied to immutable input versions, evidence references, scope, and confidence, so that stale or over-scoped proposals can be rejected.
23. As an auditor, I want conflicting worker proposals resolved from source evidence or returned to the question gate, so that conclusions are not decided by majority vote.
24. As a tester, I want important pass conditions and every confirmed failure captured as evidence, so that both passing and failing judgments are defensible.
25. As a privacy owner, I want evidence tagged for sensitivity and redaction, so that passwords, tokens, payment details, and unrelated member data are not broadly shared.
26. As a developer, I want each bug to include environment, preconditions, reproduction steps, expected result, actual result, severity, priority, and embedded evidence, so that it is actionable without another interview.
27. As a developer, I want each bug linked back to the requirement rule, test case, run, and evidence, so that its business basis and reproduction trail are clear.
28. As a stakeholder, I want one HTML test report that separates confirmed outcomes, blocked checks, residual risks, and discovered bugs, so that I can understand the result quickly.
29. As a QA manager, I want one current ledger entry per tested requirement, so that job status, issue count, report, bugs, and regression state can be scanned across assignments.
30. As an agent resuming work, I want to reconstruct the current phase from durable artifacts and evidence, so that chat history is not required for recovery.
31. As an auditor, I want retries to append new run records instead of overwriting previous outcomes, so that the execution history remains intact.
32. As a QA lead, I want evidence IDs checked before repeated browser actions, so that interruption recovery does not create duplicate or misleading proof.
33. As a process owner, I want each completed job to generate a retrospective, so that prompt gaps, artifact gaps, browser gaps, domain rules, and automation candidates are captured.
34. As a process owner, I want reusable learning gated by provenance, scope, and confidence, so that merchant-specific or weak assumptions cannot contaminate future jobs.
35. As a process owner, I want confirmed global or gaming-domain learning applied as candidate guidance rather than silent acceptance rules, so that every new requirement still controls its own truth.
36. As a tester, I want a requirement to end as passed, has bugs, blocked, not run, or residual risk based on evidence, so that uncertainty is represented honestly.
37. As a user, I want the workstation verdict separated from the product verdict, so that finding a defect demonstrates successful QA execution rather than workstation failure.
38. As a user, I want the first VIP slice to start from raw input rather than historical reports, so that the entire workflow is genuinely exercised.
39. As a user, I want historical VIP artifacts used only as a post-run coverage benchmark, so that changing UAT data does not force artificial result matching.
40. As a user, I want the first slice to run without intervention after session handoff, so that it proves a meaningful unattended operating boundary.

## Implementation Decisions

- V1 is a local-first QA operating system for gaming-platform work. It is not a generic test-management product and does not depend on a remote orchestration service.
- The primary module boundary is the complete QA job runner. Its public behavior accepts a normalized raw-job bundle and browser-session readiness, then returns a terminal job state plus authoritative artifacts. Internal prompts and worker roles remain implementation details behind this boundary.
- A job bundle contains requirement identity and description, source references, available product material, environment and merchant scope, confirmed product answers, and browser-session readiness. It never contains passwords, OTP values, cookies, access tokens, or recovery codes.
- The durable workflow phases are `intake`, `question_gate`, `design`, `execution_gate`, `execution`, `synthesis`, `retrospective`, and terminal `complete` or `blocked` handling.
- Requirement status values include intake, waiting for confirmation, ready for design, ready for execution, testing, has bugs, passed, blocked, waiting for regression, regression passed, and regression failed.
- Case result values include passed, failed, blocked, not run, and residual risk. A job may complete successfully as a workstation run while reporting product failures.
- JSON artifacts are the machine-operable source of truth. HTML test reports, conditional bug tickets, and the QA ledger are generated views and must not become hidden state.
- The authoritative artifact set covers requirement facts, blocking questions, strategy, test cases, execution results, evidence manifest, bugs, and retrospective findings.
- Shared stable identifiers connect requirements, questions, rules, cases, steps, runs, evidence, and bugs. All generators and validators preserve those relationships.
- The question gate interrupts only for ambiguity that changes pass/fail, data scope, permission, money, rewards, risk, or execution safety. Non-blocking ambiguity becomes an assumption, read-only observation, or residual risk.
- Gaming-domain strategy follows a money-and-traceability-first model across configuration visibility, member attribution, recharge, wallet ledger, game bet trace, valid bet and win/loss, activity and reward audit, withdrawal, and report reconciliation.
- Every executable step uses one of four action classes: read only, pre-authorized mutation, confirm before action, or prohibited by default.
- The execution gate refuses missing or invalid action classes. It also stops when the observed environment, merchant, account, amount, object, or operation differs from recorded authorization.
- Read-only navigation, filtering, detail views, table inspection, visible-value capture, and screenshots may run unattended after session handoff.
- Login and credential handoff remain human-owned. OTP, CAPTCHA, password, device verification, and session recovery stop execution with a precise blocker.
- The main agent exclusively owns workflow status, the logged-in browser, action authorization, evidence numbering, append order, final case judgment, conflict resolution, and authoritative artifact merging.
- Optional workers operate on immutable snapshots and return versioned proposals. They cannot control the live browser, receive session secrets, execute steps, publish externally, assign final status, or directly edit authoritative artifacts.
- Worker proposals declare assignment, role, bounded scope, input revisions, proposed changes, evidence references, open questions, confidence, and do-not-generalize notes. Stale, ungrounded, over-scoped, or authority-claiming proposals are rejected.
- Browser execution remains single-threaded. Analysis and post-execution synthesis may run in parallel only when their inputs and outputs are isolated.
- Evidence records include type, capture time, source surface, related cases and bugs, proof description, sensitivity, redaction status, and integrity metadata where available.
- Execution results are append-only per run. A retry creates a new result linked to the prior run instead of rewriting history.
- Resume logic reconstructs state from artifact completeness, question status, execution runs, evidence, and authorization records. It does not trust chat narration or assume that a previous browser session is still valid.
- A failed observation is recorded with evidence before bug synthesis. Failure never triggers an automatic rollback, cleanup, or compensating mutation.
- HTML reports include requirement rules, assumptions, question status, strategy, completed observations, issues, case outcomes, evidence links, and residual risk. Bug evidence appears with the related bug rather than in a detached gallery.
- The QA ledger exposes one current entry per requirement with date, product path, status, issue count, report, bug deliverable, regression status, and last update.
- Retrospective findings are the only cross-job learning path. Reuse requires source provenance, global or gaming-domain scope, confirmed confidence or explicit human acceptance, and no conflict with the new requirement.
- Merchant-specific learning remains merchant-scoped. Requirement-specific, probable, and weak findings remain suggestions or do-not-generalize entries.
- V1 must run correctly with one main agent and local artifacts. Multi-agent support is an optional latency optimization behind the same contracts.
- The first implementation slice is the read-only management-backend VIP member-count and member-list consistency requirement.
- The first slice input includes raw requirement material, confirmed answers for known blocking VIP rules, expected UAT and merchant scope, and a dedicated manually authenticated management-backend session.
- The first slice checks VIP management availability, count semantics, selected-level list behavior, clicked/filter/row/total consistency, level switching, zero-member behavior, and meaningful read-only pagination, search, refresh, or context retention.
- The first slice succeeds when it reaches passed, has bugs, or an honest blocked terminal state without intervention after startup; generates every applicable artifact; preserves complete traceability; performs no unauthorized mutation; resolves report evidence links; scopes retrospective learning; and achieves coverage materially comparable to the historical VIP run.

## Testing Decisions

- The highest and preferred test seam is one complete QA job run: raw job bundle plus prepared browser session in, terminal state plus authoritative artifacts and HTML views out. The user explicitly confirmed this seam during vertical-slice planning.
- End-to-end acceptance tests verify externally observable workflow behavior rather than prompt wording, worker count, model reasoning text, or private module calls.
- Contract tests validate required artifact fields, allowed status values, stable ID formats, source references, action classes, and cross-artifact traceability.
- Safety tests verify that a step without an action class is refused; prohibited actions never execute; confirmation-required actions cannot inherit broad task approval; and pre-authorized actions stop when scope differs.
- Question-gate tests verify that pass/fail, money, permission, reward, data-scope, and safety ambiguity blocks, while non-blocking uncertainty becomes an assumption, observation, or residual risk.
- State-machine tests verify legal phase transitions, safe terminal states, and correct re-entry after a product answer or authorization is added.
- Resume tests begin from incomplete artifact combinations and verify that the runner continues from the earliest invalid or incomplete gate without duplicating evidence or overwriting prior runs.
- Worker-contract tests, when workers are enabled, verify snapshot versioning, scope enforcement, stale-proposal rejection, conflict escalation, and main-agent-only merge authority.
- Evidence tests verify that important passes and confirmed failures have resolvable proof, sensitive evidence carries redaction state, and no bug references missing evidence.
- Report-generation tests verify that HTML is derived from authoritative JSON, current ledger links resolve, conditional bug deliverables appear only when appropriate, and stale drafts are not presented as current.
- Retrospective tests verify that weak, probable, merchant-specific, and requirement-specific findings cannot silently become global acceptance rules.
- The live first-slice acceptance run uses a dedicated authenticated UAT management-backend session and only read-only actions. Manual login occurs before the timed unattended run.
- The first-slice result is evaluated independently from the VIP feature result. Passed, has bugs, and specific blocked outcomes can all demonstrate correct workstation behavior when their evidence and artifacts are complete.
- Historical VIP reports, bugs, and screenshots provide prior art for coverage comparison, report structure, question-gate behavior, and evidence placement. They are excluded from runtime input and are not an exact-output golden master.
- A changing UAT environment does not require the same defects, counts, wording, or screenshots as a previous run. Acceptance depends on rule coverage, evidence quality, traceability, safety, and honest judgment.
- Negative-path acceptance includes session expiry, OTP/CAPTCHA challenge, unexpected environment or merchant, newly discovered blocking ambiguity, missing visible data, and broken evidence capture.
- Visual QA of generated HTML verifies readable tables, non-overlapping text, correct relative evidence links, embedded bug evidence, and usable desktop and mobile layouts.

## Out of Scope

- Replacing product owners, developers, or human acceptance of final business risk.
- Storing or autonomously entering credentials, passwords, OTP values, CAPTCHA solutions, recovery codes, browser tokens, or session secrets.
- Unauthorized production operations or a general production-operations mode.
- Live withdrawal payout, wallet adjustment, reward issuance, commission settlement, permission elevation, account-state mutation, audit deletion, or other high-risk business changes.
- A generic QA management product for every industry before the gaming-platform workflow is proven.
- Recharge callback simulation or test-payment-channel integration in the first slice.
- Deterministic supplier bets, game-round creation, or automated game-play validation in the first slice.
- Immediate, delayed, or batch report-reconciliation automation in the first slice.
- Concurrent H5 and management-backend browser-session isolation in the first slice.
- Requiring multi-agent workers for V1 correctness.
- Exact reproduction of historical VIP defects, counts, screenshots, or report prose.
- Automatic external publication, messaging, ticket submission, or file sharing without a separately authorized integration.

## Further Notes

- The operating model intentionally distinguishes unattended QA execution from unattended authentication and production operations. V1 begins after a human marks an authorized UAT session ready.
- The first slice is deliberately read-only so the full analysis-to-retrospective loop can be proven before introducing financial mutation, rollback, deterministic test data, and reconciliation complexity.
- Later slices should expand in risk order: scoped sandbox data creation, recharge and wallet ledger, deterministic game-bet trace, activity/reward/audit, withdrawal up to a safe boundary, and delayed report reconciliation.
- A future implementation-ticket breakdown should preserve the end-to-end job-runner seam and deliver tracer bullets that remain executable as progressively richer vertical slices.

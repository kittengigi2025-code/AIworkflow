# Tickets: AI QA Workstation V1

These tickets build the local-first gaming-platform AI QA workstation defined by the [source specification](.scratch/ai-qa-workstation/PRD.md).

Work the **frontier**: any ticket whose blockers are all done. Start each ticket in a fresh context and implement it through `/implement`.

## Run a raw job through the question gate

**What to build:** Accept one raw remote QA job and turn it into durable, auditable requirement facts and question-gate output. The user can see whether the job is ready for design or is safely waiting for product clarification without relying on chat history.

**Blocked by:** None - can start immediately.

- [x] A user can start a job from requirement identity and text plus any supported source references, product replies, environment scope, and session-readiness metadata.
- [x] The job assigns stable requirement, rule, and question identifiers and preserves the source and capture time for every confirmed fact.
- [x] Confirmed rules and assumptions remain distinct in the authoritative output.
- [x] Questions affecting pass/fail, data scope, permissions, money, rewards, business risk, or execution safety are classified as blocking.
- [x] Non-blocking uncertainty becomes an explicit assumption, read-only observation target, or residual risk instead of pausing the job.
- [x] An unanswered blocking question produces `waiting_for_confirmation`; a fully answered bundle produces `ready_for_design`.
- [x] No design or browser execution occurs while blocking questions remain unanswered.
- [x] Inputs containing credentials, OTP values, cookies, access tokens, or recovery codes are rejected or redacted from durable artifacts.
- [x] Automated tests demonstrate both the ready and waiting paths from raw job fixtures.

## Produce a safe and traceable read-only test plan

**What to build:** Advance a question-gated job into a gaming-domain strategy and executable read-only cases whose coverage and safety classification can be validated before any browser action occurs.

**Blocked by:** Run a raw job through the question gate.

- [x] The generated strategy states in-scope, out-of-scope, and blocked coverage and maps relevant H5 and management-backend business surfaces.
- [x] Risk ordering prioritizes money, member attribution, ledger, audit, and cross-surface traceability over cosmetic checks.
- [x] Every confirmed rule is covered by at least one test case or is explicitly recorded as blocked or out of scope.
- [x] Every case declares preconditions, test data, ordered steps, expected observations, and required evidence.
- [x] Every executable step has a valid action class and target surface.
- [x] Missing or invalid action classes are refused before the execution phase.
- [x] Any action outside the read-only first-slice boundary produces a safe blocked plan rather than an executable step.
- [x] A traceability validator detects missing rule-to-case, case-to-step, and evidence-expectation links.
- [x] A fully valid read-only plan reaches `ready_for_execution` and can be inspected without opening a browser.

## Execute one authorized browser case with evidence

**What to build:** Execute one planned read-only case in a user-prepared UAT management-backend session, then produce an evidence-backed result without exposing credentials or allowing competing browser owners.

**Blocked by:** Produce a safe and traceable read-only test plan.

- [x] The runner verifies the expected environment and merchant or site scope before executing the case.
- [x] Only the main agent can own and operate the live browser session.
- [x] Navigation, filtering, detail opening, visible-value reading, and screenshots work as read-only actions.
- [x] The run records start and end time, environment, case and step IDs, observed facts, judgment, and terminal case status.
- [x] Required screenshots receive stable evidence IDs and resolvable evidence-manifest entries.
- [x] A passing result includes positive proof of the expected observation; absence of an error alone is insufficient.
- [x] A failing result captures the contradictory observed state before bug synthesis.
- [x] Session expiry, login redirect, OTP/CAPTCHA, unexpected environment, missing visible data, or evidence-capture failure produces a precise `blocked` or `residual_risk` result.
- [x] Automated tests use a controllable browser fixture, and one documented UAT smoke path demonstrates the real session handoff.

## Run the complete VIP member-consistency workflow

**What to build:** Run the approved first gaming-platform slice from raw VIP requirement material through live read-only execution, reaching an honest product result while preserving the workstation's safety and traceability guarantees.

**Blocked by:** Execute one authorized browser case with evidence.

- [x] Runtime input excludes historical test strategies, cases, reports, bug tickets, and screenshots.
- [x] Known product answers for VIP level mapping, member-count scope, zero-member behavior, and default or filter behavior are traced through the question gate.
- [x] The run verifies VIP management and View Members availability.
- [x] The run verifies member-count meaning and consistency among the clicked VIP level, visible filter, row-level VIP values, total, and member list.
- [x] The run switches between at least two VIP levels and detects stale filter, total, or row state.
- [x] The run verifies confirmed zero-member behavior.
- [x] Search, pagination, refresh, or context retention is checked wherever current visible data permits a meaningful read-only assertion.
- [x] Every confirmed VIP rule links to cases, executed steps, results, and evidence.
- [x] The job reaches `passed`, `has_bugs`, or a specific evidence-backed `blocked` state without any save, submit, export, upload, permission, account, wallet, reward, or financial mutation.
- [x] The workstation run can succeed when the VIP feature passes or when it finds defects; product outcome and workstation outcome remain separate.

## Close a job with reports, ledger, and retrospective

**What to build:** Turn a completed job's authoritative state into the complete human-facing package: test report, conditional developer bug tickets, current QA ledger entry, and safely scoped retrospective learning.

**Blocked by:** Run the complete VIP member-consistency workflow.

- [x] The HTML test report is generated from authoritative artifacts and includes rules, assumptions, question state, strategy, observations, case outcomes, evidence, bugs, and residual risk.
- [x] A bug deliverable is generated only when confirmed failures produce bugs.
- [x] Every bug includes environment, impact, preconditions, reproduction steps, expected result, actual result, severity, priority, and evidence next to the bug.
- [x] Every bug traces back to its rules, cases, run results, and evidence.
- [x] The QA ledger contains one current row for the requirement with date, product path, status, issue count, report, bug deliverable, regression state, and last update.
- [x] Ledger and report links resolve, evidence paths are portable, and stale draft deliverables are not presented as current.
- [x] Sensitive evidence carries redaction state and the generated package does not expose credentials, tokens, or unrelated member data.
- [x] The retrospective records process gaps and automation candidates with provenance, confidence, reuse scope, recommended update, and do-not-generalize notes.
- [x] Weak, probable, merchant-specific, and requirement-specific findings cannot silently become global acceptance rules.
- [x] Rendered desktop and mobile HTML remains readable, non-overlapping, table-oriented, and keeps evidence with the related result or bug.

## Resume and retry without losing audit history

**What to build:** Resume an interrupted QA job from durable state, revalidate external conditions, and continue only the invalid or incomplete work while preserving every previous observation and run.

**Blocked by:** Close a job with reports, ledger, and retrospective.

- [x] Resume reconstructs the current phase from artifact completeness, question state, execution runs, evidence, and authorization records rather than chat narration.
- [x] Browser-session readiness, expected environment, and authorization scope are revalidated before resumed execution.
- [x] The runner continues from the earliest incomplete or invalid gate instead of blindly repeating the last narrated action.
- [x] Existing evidence IDs and manifest entries are checked before capture so repeated execution does not create duplicate or misleading proof.
- [x] Retrying a blocked or failed case appends a new run linked to the previous run and never overwrites history.
- [x] Completed immutable observations remain available to reports and audit after a retry.
- [x] Resuming an already complete and valid job is idempotent and does not repeat browser actions.
- [x] Tests cover interruption during intake, design, browser execution, evidence capture, synthesis, and retrospective generation.

## Enforce the bounded worker-proposal contract

**What to build:** Allow optional analysis workers to accelerate bounded QA work while ensuring that the main agent remains the sole browser operator, judge, and authoritative artifact owner.

**Blocked by:** Produce a safe and traceable read-only test plan.

- [x] A worker assignment declares a stable assignment ID, role, bounded scope, immutable input revisions, and minimum necessary data.
- [x] A worker proposal declares proposed changes, evidence references, open questions, confidence, do-not-generalize notes, and completion time.
- [x] Proposals based on stale input, missing evidence, exceeded scope, or claimed execution authority are rejected.
- [x] Workers cannot receive credentials or session secrets, control the live browser, execute test steps, publish externally, assign final status, or edit authoritative artifacts directly.
- [x] Conflicting proposals are resolved from source evidence or returned to the question gate rather than decided by vote.
- [x] Accepted proposals are merged by the main agent and retain provenance; proposal files never become a competing source of truth.
- [x] Analysis and synthesis may run concurrently only when their snapshots and outputs are isolated; browser execution remains single-threaded.
- [x] The full workstation continues to work when no workers are configured.
- [x] Tests demonstrate accepted, stale, conflicting, over-scoped, and authority-violating proposals.

## Certify unattended AI QA Workstation V1

**What to build:** Prove the V1 workstation as one repeatable user workflow: after a user supplies a raw VIP job bundle and marks a dedicated UAT session ready, the system runs to a defensible terminal package without further intervention.

**Blocked by:** Close a job with reports, ledger, and retrospective; Resume and retry without losing audit history; Enforce the bounded worker-proposal contract.

- [ ] One documented command or entry point starts the complete run from the raw job bundle and prepared session.
- [ ] No human interaction is required after startup unless the job correctly reaches a safety or information blocker.
- [ ] The run reaches `passed`, `has_bugs`, or a precise `blocked` terminal state and creates every artifact applicable to that state.
- [ ] Automated validation proves rule-to-case-to-step-to-result-to-evidence-to-bug traceability and rejects broken references.
- [ ] Safety validation proves that every executed browser action is read only and that no unauthorized state change occurred.
- [ ] HTML reports, conditional bug tickets, the current ledger entry, evidence, and retrospective pass content and link checks.
- [ ] An interruption-and-resume acceptance scenario completes without duplicate evidence or overwritten run history.
- [ ] A worker-enabled or worker-proposal scenario preserves main-agent authority, while a worker-disabled scenario produces the same contract-compatible terminal package.
- [ ] Post-run comparison shows coverage materially comparable to the historical VIP test without requiring identical wording, screenshots, counts, or defects.
- [ ] The final acceptance record distinguishes product status, workstation status, residual risk, and any human-owned next action.

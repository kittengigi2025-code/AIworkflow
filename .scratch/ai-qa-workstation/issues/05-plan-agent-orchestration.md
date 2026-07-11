Title: Plan agent orchestration
Type: research
Status: resolved
Blocked by: 01, 03, 04

## Question

How should the workstation coordinate one main agent, optional sub-agents, browser control, file artifacts, and feedback loops?

Resolve:

- Which tasks are safe for parallel agents.
- Which tasks must stay single-threaded in the main agent.
- How workers exchange structured outputs.
- How failed or ambiguous steps return to the question gate.
- How the workflow resumes after interruption.
- How the system records learning without contaminating future jobs with unverified assumptions.

## Answer

The workstation uses a conductor-and-workers model. One main agent owns the job state, live execution, judgment, and final artifacts. Optional worker agents perform bounded analysis against immutable artifact snapshots and return proposals; they never become independent operators of the system under test.

Multi-agent execution is an optimization, not a V1 dependency. The same contracts must work when the main agent performs every role sequentially.

## Ownership Boundary

The main agent exclusively owns:

- The current workflow phase and requirement status.
- Logged-in H5 and management-backend browser sessions.
- Credentials, OTP, CAPTCHA, password, account-sensitive, and session-sensitive handoffs.
- Validation of every executable step's `action_class`.
- All state-changing actions and their authorization checks.
- Evidence capture IDs and the append order of execution results.
- Final pass/fail/blocked/residual-risk judgment.
- Conflict resolution and final merge into authoritative JSON and HTML artifacts.

Workers may only read the input snapshot declared in their assignment and propose updates for these bounded roles:

- Requirement extraction from text, screenshots, product notes, Axure/Lark material, and exports.
- Gaming-domain surface mapping and risk analysis.
- Blocking-question detection and assumption review.
- Test strategy and test-case drafting.
- Consistency checks across rules, cases, results, evidence, and bugs.
- Bug-ticket drafting from already recorded failures.
- Report, ledger, and retrospective drafting from authoritative execution artifacts.

Workers must not control a live browser, receive credentials or session tokens, execute test steps, assign final status, publish external messages, or modify authoritative artifacts directly.

## Workflow State Machine

The main agent advances one requirement through these durable phases:

1. `intake`: normalize sources into `requirement.json`.
2. `question_gate`: collect worker findings, resolve conflicts, and write `questions.json`.
3. `design`: write approved `strategy.json` and `test-cases.json`.
4. `execution_gate`: verify blocking questions, session readiness, test data, authorization scope, and every step's `action_class`.
5. `execution`: run browser steps single-threaded and append results and evidence.
6. `synthesis`: derive `bugs.json`, HTML reports, and the ledger entry from authoritative artifacts.
7. `retrospective`: write scoped learning and candidate workflow improvements.
8. `complete` or `blocked`: stop with an evidence-backed terminal job status.

Parallel workers are useful during `intake`, `question_gate`, `design`, and post-execution `synthesis`. The `execution_gate` and `execution` phases stay single-threaded. A later requirement may be analyzed while another requirement executes only when their workspaces and browser sessions are isolated; V1 does not assume that isolation exists.

## Worker Exchange Contract

Each worker returns a proposal file under `worker-output/<assignment-id>.json`. It has this minimum envelope:

```json
{
  "assignment_id": "ASG-001",
  "worker_role": "requirement_extractor",
  "scope": "Explicit bounded question",
  "input_versions": {
    "requirement.json": "sha256-or-revision"
  },
  "proposals": [],
  "evidence_refs": [],
  "open_questions": [],
  "confidence": "confirmed|probable|weak",
  "do_not_generalize": [],
  "completed_at": "ISO-8601"
}
```

The main agent rejects a proposal when its declared input version is stale, its scope is exceeded, its evidence reference cannot be resolved, or it attempts to assign authority it does not own. Accepted proposals are merged into the normal source artifacts; worker files remain provenance, not a second source of truth.

Workers receive the minimum necessary data. Sensitive values are replaced with stable local references where possible, and no browser cookies, tokens, passwords, OTP values, or unrelated member data enter a worker assignment.

## Question And Failure Loop

- A worker ambiguity that can change pass/fail, money, permissions, rewards, data scope, or safety becomes a proposed blocking item in `questions.json`.
- Non-blocking ambiguity becomes an explicit assumption, read-only observation, or residual risk; it does not interrupt execution unnecessarily.
- Conflicting worker proposals are never settled by majority vote. The main agent follows source evidence or creates a blocking question.
- A missing or invalid `action_class`, authorization mismatch, changed environment/account/amount, unavailable session, or unresolved blocking question stops the affected case before action and records it as `blocked`.
- A failed observation records the actual state and evidence first, then enters bug synthesis. A test failure does not automatically rewind or mutate the environment.
- After a human answer or authorization arrives, the main agent updates the authoritative artifact, records its source and time, reruns the affected gate, and resumes only the invalidated cases.

## Interruption And Resume

Chat history is not recovery state. On every start or resume, the main agent:

1. Locates the requirement workspace and validates the JSON artifacts and referenced evidence.
2. Reconstructs the current phase from requirement status, artifact completeness, blocking questions, and incomplete test runs.
3. Invalidates unmerged worker proposals whose input versions no longer match.
4. Checks the evidence manifest before assigning new evidence IDs or repeating browser actions.
5. Revalidates browser-session readiness and all mutation authorizations; session state is never inferred from a previous conversation.
6. Continues from the earliest incomplete or invalidated gate, not merely from the last narrated step.

Execution results are append-only per run. Retries create a new run/result record linked to the previous blocked or failed run, preserving the audit trail.

## Learning Isolation

`retrospective.json` is the only path by which one job can propose learning for another. A finding may influence future jobs only when:

- It has source/evidence provenance.
- Its `reuse_scope` is `global` or `gaming_domain`.
- Its confidence is `confirmed`, or a human explicitly accepts it.
- It does not conflict with the new requirement's confirmed rules.

`merchant_specific` findings stay in that merchant's scoped profile. `requirement_specific`, `probable`, and `weak` findings remain suggestions or `do_not_generalize` entries. Reusable heuristics are versioned and applied as candidate guidance during intake/design, never silently promoted into acceptance rules.

## Design Consequence

The first implementation should run correctly with one main agent and file artifacts alone. Worker support can then be added behind the proposal envelope without changing the workflow state machine or authoritative artifact contracts. This preserves a deterministic audit trail while allowing safe parallel analysis when it brings real latency savings.

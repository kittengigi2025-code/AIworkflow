Title: Choose first vertical slice
Type: grilling
Status: resolved
Blocked by: 02, 03, 04, 05

## Question

What is the smallest end-to-end slice that proves the AI QA workstation is real?

Resolve:

- One representative remote testing job type.
- Inputs required from the user.
- Browser/session requirements.
- Artifacts produced.
- Pass/fail evidence.
- Human approvals required.
- Acceptance criteria for calling the slice successful.

## Comments

### Decision 1: Representative job type

Recommended first slice: replay the existing read-only `VIP management > View members > member count and list consistency` requirement. Existing artifacts prove it already exercises the question gate, browser observations, evidence, bug tickets, report, and QA ledger without requiring financial mutation authorization.

User decision: approved on 2026-07-10. The first slice is the read-only VIP member-count and member-list consistency workflow. Recharge and wallet mutations are not required to prove the first slice.

### Decision 2: Input boundary

User decision: approved on 2026-07-10. The run starts from a raw remote-job bundle containing the requirement title and original description, available Axure/screenshots/product replies, the UAT backend URL, and a user-prepared logged-in browser session. Existing test strategy, cases, reports, bug tickets, and evidence are excluded from runtime input and used only for post-run baseline comparison.

### Decision 3: Browser session boundary

User decision: approved on 2026-07-10. The user performs one manual login in a dedicated UAT browser session and marks it ready. From task start through report generation, the main agent performs the read-only workflow without intervention. Session expiry, OTP/CAPTCHA, login challenges, or an unknown environment produce a recorded `blocked` result; the workstation does not bypass authentication controls.

### Inherited artifact output

The first slice uses the existing artifact contract without another format decision: `requirement.json`, `questions.json`, `strategy.json`, `test-cases.json`, `execution-results.json`, `evidence-manifest.json`, `bugs.json`, `test-report.html`, conditional `bug-tickets.html`, the `qa-index.html` entry, and `retrospective.json`.

### Decision 4: Product-answer gate

User decision: approved on 2026-07-10. Confirmed product answers for all known blocking VIP questions are included in the input bundle before task start. The workstation must still classify and trace them through `questions.json`, but the first run does not pause for product clarification. A newly discovered blocking ambiguity may still produce an honest `blocked` result.

## Answer

The first implementation slice is a complete read-only replay of the gaming-management-backend requirement `VIP management > View members > member count and list consistency`.

It proves that the workstation can accept a raw remote QA job, analyze the requirement, apply the question gate, design risk-focused cases, execute them in a live authorized UAT session, capture evidence, judge results, generate bugs and reports, update the ledger, and produce scoped retrospective learning without human intervention after startup.

## Runtime Input

The run receives only a raw job bundle:

- Requirement title/ID and original description.
- Available Axure links, screenshots, product notes, and product replies.
- Confirmed answers for all known blocking questions, including `vipGrade` mapping, member-count scope, zero-member behavior, and default/filter behavior.
- UAT management-backend URL and expected merchant/site scope.
- A dedicated browser session that the user has logged into and marked ready.

Existing strategies, cases, reports, bug tickets, and evidence from the historical VIP run are excluded from runtime input. They are a post-run coverage benchmark only.

## Human Boundary

Before task start, the human owns login, session readiness, environment/site confirmation, and product answers. After task start, the main agent runs without intervention.

The slice contains only `read_only` test actions. It requires no recharge, wallet, reward, withdrawal, account-state, permission, export, upload, save, or submit authorization. If the session expires, OTP/CAPTCHA appears, the environment is unknown, or a new blocking ambiguity is discovered, the agent stops safely and records an evidence-backed `blocked` result.

## Required Verification

At minimum, generated cases cover:

- VIP management and `View members` availability.
- Member-count values and their confirmed statistical meaning.
- Opening a selected VIP level's member list.
- Agreement among the clicked VIP level, visible filter, row-level VIP values, and total/list count.
- Switching between at least two VIP levels without stale filter or list state.
- Confirmed zero-member behavior.
- Search, pagination, refresh, or context retention where the visible data permits a meaningful read-only check.

Pass/fail evidence consists of timestamped screenshots and recorded visible facts linked to the exact rule, case, step, and result. A failed case requires evidence showing the expected rule and contradictory observed state. A passed case requires positive evidence of the acceptance rule, not merely absence of an error. Inaccessible or unverifiable coverage is `blocked` or `residual_risk`, never silently passed.

## Produced Artifacts

The slice generates the full V1 contract:

- `requirement.json`
- `questions.json`
- `strategy.json`
- `test-cases.json`
- `execution-results.json`
- `evidence-manifest.json` and evidence files
- `bugs.json`
- `test-report.html`
- `bug-tickets.html` when failures produce bugs
- `.scratch/qa-index.html` entry
- `retrospective.json`

Every confirmed rule must trace to one or more cases; every executed case must trace to step results and evidence; every bug must trace back to the rule, case, result, and evidence that proves it.

## Slice Acceptance Criteria

The workstation slice is successful when all of these are true:

1. It starts from only the raw job bundle and ready browser session.
2. It reaches `passed`, `has_bugs`, or an honest and specific `blocked` terminal state without human intervention after start.
3. It creates all artifacts applicable to that terminal state, and they validate against the agreed contracts.
4. Rule-to-case-to-result-to-evidence-to-bug traceability is complete and internally consistent.
5. Every browser action is classified `read_only`; no unauthorized state change occurs.
6. The HTML report and ledger are generated from authoritative JSON and resolve their evidence links.
7. The retrospective separates confirmed reusable learning from merchant/requirement-specific facts and `do_not_generalize` items.
8. Post-run comparison shows that coverage is materially comparable to the historical VIP test, without requiring identical wording, identical screenshots, or the same business defects in a changing UAT environment.

The VIP feature may pass or fail without changing the workstation verdict. The slice judges whether the QA workflow ran correctly and produced defensible evidence, not whether the product happened to be defect-free.

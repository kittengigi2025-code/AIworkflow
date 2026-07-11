# AI QA Workstation Wayfinder Map

## Destination

Produce a build-ready spec for an AI workstation that can repeatedly run gaming-platform software testing work: requirement analysis, test strategy, test cases, execution, evidence, bug tickets, reports, ledger updates, and retrospective feedback loops.

The spec must define the operating model, safety boundaries, artifact contracts, automation architecture, and first implementation slice for a mostly unattended workflow, while keeping human authorization for credentials, CAPTCHA/OTP, financial mutations, account-state mutations, and final business-risk acceptance.

## Notes

- Domain: gaming platform QA, including H5 frontend, management backend, member, merchant, agent, game, wallet, recharge, withdrawal, activity, reward, audit, risk control, channel, and report flows.
- Use `gaming-platform-qa-map` for business mapping, minimal end-to-end testing loops, risk matrix, and automation priority.
- Use `gaming-qa-ledger` for artifact contracts: `qa-index.html`, per-requirement `test-report.html`, `bug-tickets.html`, and evidence folders.
- Use `domain-modeling` when terminology becomes overloaded, especially "AI workstation", "requirement", "test task", "workflow", "unattended", "evidence", and "pass/fail".
- Planning map only. Do not build the workstation in this map. Close the map when the spec and first implementation ticket set are clear enough to hand to `/to-spec` and `/to-tickets`.

## Decisions so far

- [Define AI QA workstation operating model](issues/01-define-operating-model.md) - V1 is a local-first QA operating system: `.scratch/` workspaces, structured intermediates, HTML deliverables, browser-control execution, one main agent for live sessions, optional workers for bounded analysis, and human approval for credentials, mutations, and final business-risk acceptance.
- [Map gaming QA business workflow](issues/02-map-gaming-qa-business-workflow.md) - The workstation standardizes a money-and-traceability-first gaming QA loop across H5 frontend and management backend: config visibility, member attribution, recharge, wallet ledger, game bet trace, valid bet/win-loss, activity/reward/audit, withdrawal, and report reconciliation.
- [Set unattended execution safety boundary](issues/04-set-unattended-safety-boundary.md) - Execution uses four tiers: read-only unattended actions, scoped pre-authorized sandbox mutations, action-time confirmation for state changes, and prohibited-by-default production/credential/security/audit-dangerous actions. Every executable test step must carry an `action_class`.
- [Design QA artifact contracts](issues/03-design-artifact-contracts.md) - Each QA job has machine-operable JSON source artifacts plus human-readable HTML deliverables. The contract is captured in [artifact-contract-v1.md](artifact-contract-v1.md), with `action_class` required on every executable step and `retrospective.json` closing the feedback loop.
- [Plan agent orchestration](issues/05-plan-agent-orchestration.md) - One main agent exclusively owns workflow state, browser execution, authorization gates, judgments, and artifact merges; optional workers operate on versioned snapshots and return bounded proposals, while durable JSON artifacts provide interruption recovery and scoped retrospectives prevent unverified learning leakage.
- [Choose first vertical slice](issues/06-choose-first-vertical-slice.md) - V1 proves the full workflow by replaying a raw-input, read-only VIP member-count/list-consistency job in a manually prepared UAT session, generating the complete artifact chain and judging workstation success by traceability, evidence, safety, and autonomous completion rather than whether the feature itself passes.

## Not yet specified

None for the V1 spec handoff.

## Out of scope

- Replacing product owners, developers, or final business-risk acceptance.
- Performing unauthorized production actions.
- Building generic QA management software for every industry before the gaming-platform workflow is proven.
- Automating live financial approvals, account-state mutations, or permission changes without explicit human authorization.
- Recharge callback simulation or test-payment-channel integration; this belongs to a later money-flow slice after the read-only workstation loop is proven.
- Deterministic supplier bets and game-round automation; this belongs to a later game-flow slice.
- Immediate/delayed/batch report-freshness automation; this belongs to a later reconciliation slice.
- Concurrent H5/backend browser-session isolation; the first slice uses one dedicated management-backend UAT session.

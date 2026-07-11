Title: Map gaming QA business workflow
Type: research
Status: resolved
Blocked by: 01

## Question

What gaming-platform QA workflow must the workstation standardize first?

Resolve:

- Frontend/backend mapping for H5 frontend and management backend.
- Core business flows: member onboarding, recharge to game to withdrawal, activity to reward to audit, agent attribution to commission, merchant configuration to H5 behavior, and reports/reconciliation.
- Minimal testing loop that proves member identity, wallet movement, game betting, audit, withdrawal constraints, and backend traceability.
- Risk matrix and automation priority.
- Low-value repeated testing areas that should become smoke checks, sampling, or monitoring rather than full repeated execution.

## Answer

The workstation should standardize a money-and-traceability-first gaming QA workflow. The default business surface is both H5 frontend and management backend. The central risk theme is correctness of money movement, eligibility, attribution, audit constraints, and operational traceability.

## Frontend / Backend Mapping

| H5 capability | Backend owner/module | Shared business object | QA focus |
| --- | --- | --- | --- |
| Registration/login | Member management, risk control, channel attribution | Member, member attribution, login record | Identity creation, login state, attribution, risk restrictions |
| Game lobby/game entry | Game management, supplier config, game reports | Game, game category, supplier, bet record | Visibility, enabled/disabled state, supplier handoff, bet trace |
| Recharge | Payment channel, wallet, funds ledger, recharge report | Recharge order, wallet, funds ledger | Balance increase, order state, ledger consistency, report trace |
| Withdrawal | Withdrawal review, audit, risk control, wallet, withdrawal report | Withdrawal order, audit state, frozen amount, funds ledger | Eligibility, freeze/unfreeze, review state, final balance, report trace |
| Promotion center | Promotion config, member level, reward, audit | Activity, activity eligibility, reward, audit requirement | Eligibility rules, visibility, reward trigger, audit effect |
| Rewards/rebate | Reward management, audit, wallet ledger, activity report | Reward issuance, rebate, wallet, report | Amount correctness, repeat prevention, ledger/report consistency |
| Personal center/wallet | Member profile, wallet, funds ledger | Member, wallet, balance, transaction record | H5/backend balance consistency, history correctness |
| Agent invite/attribution | Agent management, agent hierarchy, commission report | Agent, member attribution, commission | Attribution correctness, team scope, commission/report trace |
| Merchant-visible config | Merchant/site config, level/rules/config modules | Merchant config, member level, payment/game/promotion config | Backend config changes visible H5 behavior without cross-merchant leakage |

## Core Business Flows

1. Member onboarding and attribution:
   Backend setup creates merchant, channel or agent attribution. H5 registration/login creates or reuses a member. Backend member records, attribution fields, login traces, and reports prove identity and source.

2. Recharge success and wallet ledger:
   Backend config enables a payment method. H5 member submits recharge or receives a controlled success callback. Backend order, wallet balance, funds ledger, and recharge report must agree.

3. Game entry, betting, valid bet, win/loss, and game report:
   Backend config enables a game supplier/category/game. H5 member enters a game and produces a deterministic or observable bet record. Backend bet record, valid bet, win/loss, and game report must reconcile with member wallet state.

4. Promotion eligibility, reward issuance, audit requirement, and wallet change:
   Backend config defines activity scope, member level, timing, recharge/bet thresholds, reward formula, and audit requirement. H5 member sees or triggers the activity. Backend eligibility, reward issuance, wallet ledger, audit state, and activity report prove correctness.

5. Withdrawal request, audit decision, review, wallet freeze/unfreeze, and withdrawal report:
   H5 member requests withdrawal. Backend audit and risk rules decide eligibility. Wallet freeze occurs during pending review. Approval, rejection, or cancellation updates freeze, available balance, funds ledger, and withdrawal report consistently.

6. Agent attribution, team performance, and commission:
   Backend establishes agent hierarchy and invite path. H5 member joins through attribution. Recharge, valid bet, win/loss, and reward behavior roll into team performance. Agent report and commission records prove attribution and amount logic.

7. Merchant configuration affecting H5 behavior:
   Backend changes payment, game, promotion, level, channel, or merchant config. H5 visibility and permitted actions reflect the active config. Reports and records stay scoped to the merchant.

## Minimal Test Loop

The smallest useful closed loop for the workstation should prove:

1. Backend configuration creates visible H5 behavior.
2. A member can register or log in with known merchant/channel/agent attribution.
3. The member can recharge through a controlled test path and wallet balance increases.
4. The recharge creates a funds ledger record and appears in the recharge report.
5. The member can enter an enabled game and produce a bet record.
6. Valid bet or win/loss appears in backend game records and reports.
7. A promotion or reward path creates a wallet change or audit constraint.
8. Withdrawal respects balance, audit, freeze, review, and final ledger state.
9. Backend reports reconcile with H5-visible member state.

Required test data:

- Merchant or site scope.
- H5 member.
- Optional agent and invite/channel attribution.
- Member level.
- Test payment method or controlled recharge callback.
- Enabled game and supplier path.
- Promotion/reward rule.
- Withdrawal account.
- Management backend account with read-only access and explicit approval for any mutation.

## Risk Matrix

| Area | Risk | Why it matters | Suggested coverage |
| --- | --- | --- | --- |
| Wallet/funds ledger | High | Source of truth for member money and every money-adjacent assertion | P0 automated reconciliation |
| Recharge | High | External channel state must match wallet and reports | P0 controlled success/failure paths where available |
| Withdrawal | High | Balance, audit, freeze, review, and payout states can lose money | P0 path with human-approved mutation or sandbox |
| Audit/wagering requirement | High | Controls withdrawal and reward constraints | P0 rule assertions around eligibility and state transitions |
| Reward issuance/rebate | High | Directly affects wallet and activity cost | P0/P1 amount, repeat, eligibility, ledger checks |
| Valid bet/win-loss | High | Drives audit, reports, promotion eligibility, and agent performance | P0 deterministic or observable bet trace |
| Reports/reconciliation | High | Operations depend on backend truth matching business events | P0 report-to-record reconciliation |
| Permissions/merchant isolation | High | Cross-merchant leakage and unauthorized actions are severe | P0/P1 role and scope checks |
| Agent attribution/commission | Medium | Revenue sharing depends on correct hierarchy and team scope | P1 representative hierarchy and commission checks |
| Member level | Medium | Affects rules, activity, payment, withdrawal, and risk | P1 boundary cases |
| Channel attribution | Medium | Acquisition reporting and agent/channel settlement can drift | P1 attribution persistence checks |
| Game supplier availability | Medium | Provider state affects H5 availability and records | P1 enabled/disabled and contract status checks |
| Static banners/help/copy | Low | Usually cosmetic unless tied to eligibility or money | Smoke or sample only |
| Repeated table filters/export UI | Low | Often shared components with low business variance | Component-level or sample checks |

## Automation Priority

P0, every release candidate or job-critical regression:

- Login/session readiness smoke: prove the AI can see expected H5 and backend pages.
- Recharge controlled success or callback simulation: assert order, wallet, ledger, report.
- Wallet ledger reconciliation: assert every money movement has matching balance delta.
- Game entry and bet trace: assert enabled game can create backend evidence.
- Audit gate: assert withdrawal/reward constraints respond to valid bet and reward state.
- Withdrawal review path in sandbox or with explicit approval: assert freeze, review, ledger, report.
- Report reconciliation: assert backend reports match underlying orders, bet records, and wallet ledger.

P1, nightly or targeted regression:

- Promotion eligibility variants by level, time, recharge, valid bet, game category, and reward limit.
- Reward issuance/rebate repeat prevention and failure states.
- Member level boundary transitions.
- Agent attribution and representative commission calculation.
- Channel attribution persistence across registration/login.
- Supplier on/off switches and H5 visibility.
- Backend role permissions for sensitive pages and actions.

P2, sample or manual:

- Static marketing content, banners, and help pages.
- Cosmetic-only H5 theme/language variants.
- Rare promotion template permutations after engine-level coverage exists.
- Every report export format after one shared export path is covered.
- Repeated backend table search/reset/pagination where behavior is shared.
- Third-party provider internals beyond contract/status handling.

## Low-Value Repeated Testing Areas

- Static H5 banners and CMS copy after one smoke validation.
- Same search/reset/pagination pattern repeated across backend tables.
- Cosmetic theme or language variants with no rule changes.
- Export/download on every report when the shared export component is already checked.
- Every promotion template permutation when representative eligibility and reward engine cases exist.
- Manual retesting of third-party payment or game provider internals beyond status handling and contract boundaries.

## Assumptions and Open Questions

- Assume the first workstation slice runs against test/UAT environments, not production.
- Assume real credentials, OTP, CAPTCHA, and login handoff are provided by the human or pre-existing browser session.
- Need to decide whether recharge callbacks can be simulated or must use a test payment channel.
- Need to decide whether game suppliers can provide deterministic test bets.
- Need to decide whether withdrawal approval is allowed in sandbox or must stop at pending review.
- Need to decide report freshness expectations: immediate, delayed, or batch.
- Need to decide whether merchant isolation and multi-agent hierarchy are part of the first vertical slice or later P1 coverage.

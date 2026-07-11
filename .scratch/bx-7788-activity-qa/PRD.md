# BX/7788 UAT 活动测试任务说明书

Status: ready-for-agent

## Problem Statement

BX/7788 UAT 的 H5 前台与管理后台已经形成活动、奖励、会员限制和稽核相关的完整业务链路，但测试范围容易被拆散成单点页面检查：后台活动配置只看表单，H5 活动展示只看图片和文案，奖励记录只看列表，会员参与限制和稽核规则只看字段。这样会漏掉真正高风险的问题：后台配置没有正确驱动 H5 展示，会员不符合资格却能参与，奖励发放与钱包或稽核状态不一致，以及活动报表无法与奖励记录对账。

需要把当前 QA 地图沉淀成一个可执行的测试任务说明书，用于下周围绕活动列表、活动配置、H5 活动展示、奖励记录、会员参与限制和稽核规则开展测试。

## Solution

围绕一个最高层测试缝合点组织测试：管理后台配置活动 -> H5 前台展示活动 -> 会员参与活动 -> 后台产生奖励记录 -> 钱包或奖励状态变化 -> 稽核规则生效 -> 活动报表或相关记录可对账。

测试不以实现细节或组件内部状态为准，而以会员、后台账号、活动、奖励、稽核、钱包和报表上的外部可观察行为为准。每个核心用例都应能回答四个问题：

- 后台活动配置是否正确影响 H5 前台？
- 会员参与限制是否被严格执行？
- 奖励记录是否准确反映奖励发放状态？
- 稽核规则是否正确限制后续提现或奖励动作？

## User Stories

1. As a 后台账号, I want to create an activity with a clear title, category, image, time range, and status, so that the H5 前台 can show the intended activity to eligible 会员.
2. As a 后台账号, I want to edit an existing activity, so that changes to title, image, sort order, or rules are reflected consistently in the H5 前台.
3. As a 后台账号, I want to disable an activity, so that 会员 can no longer see or participate in that activity.
4. As a 后台账号, I want to configure an activity start time in the future, so that the H5 前台 does not expose the activity before it becomes active.
5. As a 后台账号, I want to configure an activity end time, so that expired activities cannot be participated in.
6. As a 后台账号, I want to configure activity sorting, so that the H5 活动列表 displays priority activities first.
7. As a 后台账号, I want to configure activity categories, so that 会员 can browse activities by the intended grouping.
8. As a 后台账号, I want to upload or choose activity images, so that H5 activity cards and details show the correct visual material.
9. As a 后台账号, I want to preview activity display content, so that obvious H5 presentation mistakes are caught before release.
10. As a 会员, I want the H5 活动列表 to show only currently available activities, so that I do not attempt to join unavailable campaigns.
11. As a 会员, I want activity cards to show consistent title, image, category, status, and entry behavior, so that I can identify the right activity.
12. As a 会员, I want activity details to match the backend configuration, so that the participation rules are clear.
13. As a 会员, I want hidden, disabled, expired, or not-yet-started activities to be unavailable, so that I do not receive misleading opportunities.
14. As a 会员, I want H5 activity entry behavior to work after login, so that I can participate from the intended page.
15. As a visitor who is not logged in, I want protected activity actions to require login, so that activity participation is tied to a 会员 identity.
16. As a 后台账号, I want to limit activity participation by 会员层级, so that only eligible 会员 can participate.
17. As a 后台账号, I want to limit activity participation by specified 会员, so that targeted activities are not exposed to unrelated 会员.
18. As a 后台账号, I want to limit activity participation by 推广渠道 when configured, so that channel-specific campaigns do not leak across sources.
19. As a 后台账号, I want to limit activity participation by recharge or valid bet conditions, so that rewards are granted only after the business requirement is satisfied.
20. As an ineligible 会员, I want the system to block activity participation, so that I cannot receive a reward outside the configured rules.
21. As an eligible 会员, I want to participate successfully when all conditions are met, so that the campaign behaves as configured.
22. As a 会员, I want repeated participation to follow the configured repeat rule, so that duplicate rewards cannot be claimed accidentally or abusively.
23. As a 后台账号, I want the system to create a 奖励记录 when a reward is triggered, so that operations can review and trace the reward.
24. As a 后台账号, I want pending reward records to include the 会员, activity, reward amount, status, and timestamps, so that review decisions are auditable.
25. As a 后台账号, I want to approve a pending reward, so that eligible rewards can move to a completed state.
26. As a 后台账号, I want to reject a pending reward with a reason, so that rejected rewards remain traceable.
27. As a 后台账号, I want reward approval state changes to be visible in reward records, so that operations can distinguish pending, approved, rejected, and issued rewards.
28. As a 会员, I want approved rewards to appear in the correct H5-visible state when applicable, so that I can understand whether a reward has been granted.
29. As a 会员, I want wallet-impacting rewards to create correct 钱包 or 资金流水 evidence, so that my 可用余额 is accurate.
30. As a 后台账号, I want reward issuance failures to remain visible, so that operations can retry or investigate without losing traceability.
31. As a 后台账号, I want activity rewards to generate the correct 流水要求 when configured, so that 稽核 can control later 提现.
32. As a 会员, I want rewards with no 流水要求 to avoid unnecessary 稽核 constraints, so that valid withdrawals are not blocked.
33. As a 会员, I want rewards with a 流水要求 to block 提现 until the requirement is satisfied, so that the business rule is enforced.
34. As a 后台账号, I want 稽核状态 to update after valid bets satisfy the requirement, so that completed activity obligations no longer block 提现.
35. As a 后台账号, I want 稽核 records to reference the relevant activity or reward source, so that the reason for the constraint is understandable.
36. As a 后台账号, I want rejected or cancelled rewards to avoid creating active 稽核 constraints, so that invalid rewards do not affect the 会员 wallet.
37. As a 后台账号, I want activity records and reward records to reconcile with 活动报表, so that campaign cost and participation can be trusted.
38. As a 后台账号, I want activity participation counts to reflect actual eligible participation, so that 活动报表 does not inflate results.
39. As a 后台账号, I want reward amount totals to match approved or issued reward records, so that activity cost reporting is accurate.
40. As a QA engineer, I want a minimal closed loop from backend activity config to H5 participation to reward and audit evidence, so that regression testing covers the highest-risk behavior efficiently.
41. As a QA engineer, I want representative activity templates instead of exhaustive cosmetic permutations, so that effort focuses on eligibility, reward, and 稽核 risk.
42. As a QA engineer, I want negative cases for time windows, 会员层级, repeated participation, and insufficient conditions, so that abuse-prone paths are covered.
43. As a QA engineer, I want test data to identify 商户, 会员, 会员层级, 推广渠道, activity, reward, and 稽核 state, so that failures can be debugged quickly.
44. As a QA engineer, I want backend and H5 observations recorded together, so that mismatches between configuration and member experience are visible.
45. As a QA engineer, I want known low-value repeated checks excluded from the main regression loop, so that the team does not spend time retesting unchanged table mechanics or cosmetic content.

## Implementation Decisions

- The work is a QA task specification for BX/7788 UAT, not a product feature implementation.
- The primary test seam is the end-to-end activity lifecycle: 管理后台 activity configuration -> H5 活动展示 -> 会员 participation -> 奖励记录 -> 稽核状态 -> report or wallet evidence.
- The H5 target is `https://99.bx-1234.xyz/#/dashboard/game`; the management backend target is `http://site.bx-tytest.xyz`.
- The management backend is treated as the source of truth for activity configuration, reward approval state, member restrictions, and audit rule setup.
- The H5 前台 is treated as the member-facing evidence surface for activity visibility, participation entry, login gating, and eligible/ineligible behavior.
- Activity configuration should be tested through business effects, not by asserting internal UI component state.
- Activity list testing should cover enabled, disabled, not-started, active, expired, sorted, categorized, and member-restricted activities.
- H5 activity display should be verified against backend-visible configuration for title, category, image, status, ordering, details, and action availability.
- Member participation restrictions should cover at least 会员层级, specified 会员, 推广渠道, login state, time window, recharge condition, valid bet condition, and repeat participation rule.
- Reward records should be treated as the operational audit trail for reward-triggering behavior.
- Reward issuance should be checked against both reward state and wallet or funds evidence when the reward affects money.
- 稽核 rules should be checked as business constraints attached to rewards or activity participation, especially when they affect 提现.
- 活动报表 should be used as reconciliation evidence, not as the sole source of truth.
- Low-value repeated testing should be explicitly excluded from the main loop: static banner cosmetics, repeated table pagination/search/reset checks, and exhaustive activity template permutations without rule differences.

## Testing Decisions

- Good tests must assert external behavior across the H5 前台 and 管理后台, not implementation details.
- The preferred highest-level automated or semi-automated test is one closed activity loop:
  1. Configure an active activity in the 管理后台.
  2. Log in as an eligible 会员 on H5.
  3. Confirm activity visibility and detail correctness.
  4. Participate or trigger the activity condition.
  5. Confirm 奖励记录 creation and status.
  6. Confirm 钱包, 资金流水, or 稽核状态 changes when applicable.
  7. Confirm 活动报表 reflects participation and reward cost.
- Test modules in scope:
  - 管理后台活动配置.
  - 管理后台活动列表.
  - H5 活动列表 and activity detail display.
  - 奖励记录, including pending, approved, rejected, and issued states.
  - 会员 participation restrictions.
  - 稽核 rules created or affected by activity rewards.
  - 活动报表 and related reconciliation evidence.
- P0 test coverage:
  - Active activity appears on H5 for eligible 会员.
  - Disabled, expired, and not-started activities are not participable.
  - Ineligible 会员 is blocked by 会员层级, specified member, or channel restriction.
  - Eligible 会员 can participate once when rules allow it.
  - Duplicate participation is blocked or allowed according to configuration.
  - Reward record is created with correct 会员, activity, amount, and state.
  - Approved wallet-impacting reward changes wallet or 资金流水 correctly.
  - Reward-created 流水要求 affects 稽核状态 and 提现 eligibility.
- P1 test coverage:
  - Activity category, sort order, image, and detail fields.
  - Reward rejection and failure states.
  - Batch approval behavior if available.
  - Activity report totals for participants and reward amount.
  - Multiple representative activity templates, selected by rule differences.
- P2 or sampling coverage:
  - Static banner content and cosmetic-only image differences.
  - Repeated backend table search, reset, pagination, and export behavior after one shared pattern is covered.
  - Every possible activity template permutation when eligibility and reward engines are already represented.
- Regression evidence should include the test 会员, activity identifier or title, reward record, 稽核状态, wallet or 资金流水 entry if applicable, and report screenshot or exported row when available.
- If deterministic game or payment data is unavailable, tests may use controlled backend setup or existing UAT records, but assumptions must be recorded.

## Out of Scope

- Testing third-party payment provider internals beyond configured channel status, callback outcome, and wallet evidence.
- Testing third-party game supplier internals beyond game availability, activity eligibility inputs, and valid bet evidence.
- Full visual QA of every activity image, banner, language variant, and theme.
- Exhaustive testing of every backend CRUD table pattern when the same component behavior is already covered elsewhere.
- Full performance, load, security penetration, and compliance testing.
- Refactoring or implementing application code.
- Defining final production business policy for reward amounts, exact 稽核倍率, or campaign economics.

## Further Notes

- Use the project glossary terms from `CONTEXT.md`: 会员, 管理后台, H5 前台, 活动, 奖励, 奖励发放, 稽核, 流水要求, 会员层级, 推广渠道, 钱包, 资金流水, 活动报表.
- The immediate testing focus is the activity system, not the full gaming platform.
- The next-week activity testing window previously discussed was 2026-07-13 through 2026-07-19 in Asia/Shanghai time. If the actual UAT campaign dates differ, use the configured backend time window as the source of truth.
- Known environment notes from prior exploration:
  - H5 URL: `https://99.bx-1234.xyz/#/dashboard/game`.
  - 管理后台 URL: `http://site.bx-tytest.xyz`.
  - 管理后台 static entry identifies the product as `DD.GG`.
  - Backend bundle exposes activity configuration, reward approval, payment, withdrawal, game, agent, member, and report-related modules.
- Open assumptions:
  - Test accounts, backend permissions, payment callback controls, and deterministic game or valid bet data are available in UAT.
  - Reports may be delayed; if so, the expected delay should be recorded in test evidence.
  - Merchant isolation and agent hierarchy are not the main objective unless they affect activity eligibility or reporting.

# BX/7788 UAT Playwright 冒烟测试设计

Status: ready-for-agent

## Confirmed Test Seams

These Playwright smoke tests use browser-visible behavior as the public interface. They do not assert internal API payloads, local storage shape, DOM implementation classes, component state, or database rows.

## Scope

Targets:

- H5 前台: `https://99.bx-1234.xyz/#/dashboard/game`
- 管理后台: `http://site.bx-tytest.xyz`

First smoke set:

1. H5 会员身份 seam.
2. 管理后台会员查询 seam.
3. 活动列表筛选 seam.
4. 活动详情查看 seam.
5. VIP 管理成员数量 seam.

## Test Data Contract

Use explicit UAT test data from environment variables or a local ignored config file. Do not hard-code production-like credentials in tests.

Required values:

- `H5_BASE_URL`
- `ADMIN_BASE_URL`
- `H5_MEMBER_ACCOUNT`
- `H5_MEMBER_PASSWORD`
- `ADMIN_ACCOUNT`
- `ADMIN_PASSWORD`
- `SMOKE_MEMBER_KEYWORD`
- `SMOKE_ACTIVITY_KEYWORD`
- `SMOKE_VIP_GRADE_A`
- `SMOKE_VIP_GRADE_B`

Optional values:

- `SMOKE_ACTIVITY_CATEGORY`
- `SMOKE_ACTIVITY_STATUS`
- `SMOKE_EXPECTED_ACTIVITY_TITLE`
- `SMOKE_EXPECTED_RULE_TEXT`
- `SMOKE_VIP_MEMBER_COUNT_A`
- `SMOKE_VIP_MEMBER_COUNT_B`

The test data should reference a stable UAT 会员 and a stable 活动 that is safe to view repeatedly. The first smoke pass should avoid creating or mutating activities unless a dedicated reset path exists.

## Selector Strategy

Prefer selectors in this order:

1. `data-testid` or stable test attributes, if the app supports adding them.
2. Accessible roles and names, such as button names, table headers, search fields, tab labels, and dialog titles.
3. Stable visible business text, such as known activity title or member account.
4. URL route assertions only for coarse navigation.

Avoid:

- CSS module names, hashed classes, and generated component class names.
- Deep XPath.
- Index-based selectors such as `nth(3)` unless the list order is the behavior under test.
- Assertions against loading skeletons or transient animation text.
- Capturing implementation details such as auth token keys or Vue component names.

Recommended app improvements before broad automation:

- Add `data-testid` on H5 login form fields, member identity area, activity list, activity card, and activity detail title/rule block.
- Add `data-testid` on 管理后台 login form, member search input, activity search input, status filter, table rows, detail drawer title, VIP member count link, and VIP view-members tab.

## Fixtures

Use Playwright fixtures to isolate login and navigation:

- `h5Page`: opens H5 base URL and provides H5 login helper.
- `adminPage`: opens management backend and provides backend login helper.
- `memberIdentity`: returns the member account/keyword used for cross-surface lookup.
- `activityIdentity`: returns the activity keyword/title used for list and detail assertions.

Persist storage state only when the login session is stable and not user-specific across test runs. Otherwise log in through the UI in the smoke setup and keep the assertions minimal.

## Smoke Tests

### 1. H5 会员可以登录并进入游戏大厅

Purpose:
Prove that the H5 前台 accepts the known 会员 identity and reaches the member-facing game surface.

Arrange:

- Open `H5_BASE_URL`.
- Log in with `H5_MEMBER_ACCOUNT` and `H5_MEMBER_PASSWORD`.

Act:

- Navigate to or remain on `#/dashboard/game`.

Assert:

- The page is not on the login screen.
- A member-visible surface is present: game lobby, wallet entry, member center entry, or other agreed logged-in marker.
- The URL or page state indicates the game dashboard is accessible.

Do not assert:

- Token storage keys.
- Exact CSS classes.
- Full game list content.

### 2. 管理后台可以查询到指定会员

Purpose:
Prove that the 管理后台 can find the same 会员 used by H5 smoke tests.

Arrange:

- Log in to `ADMIN_BASE_URL` with `ADMIN_ACCOUNT` and `ADMIN_PASSWORD`.
- Navigate to the member management/search page.

Act:

- Search by `SMOKE_MEMBER_KEYWORD`.

Assert:

- The results contain the target member account or agreed unique identifier.
- The member row exposes a stable member state or detail entry.

Do not assert:

- Table pagination internals.
- Backend request shape.
- Every member profile field.

### 3. 管理后台活动列表可以筛选目标活动，H5 活动列表展示对应活动

Purpose:
Prove that 活动配置 is discoverable in the 管理后台 and the corresponding 活动 is visible on H5 when it should be.

Arrange:

- Log in to 管理后台.
- Navigate to the activity list/configuration page.

Act:

- Filter by `SMOKE_ACTIVITY_KEYWORD`.
- Optionally apply `SMOKE_ACTIVITY_CATEGORY` or `SMOKE_ACTIVITY_STATUS` if those values are part of the stable test data.

Assert in 管理后台:

- The activity list includes the expected activity title.
- The activity row exposes an active/displayable state, or the expected configured state if the smoke intentionally covers hidden/expired behavior.

Assert in H5:

- Log in as the 会员.
- Navigate to the H5 activity list.
- The expected activity appears when the backend state says it should be visible.

Negative smoke variant, if stable data exists:

- A disabled, not-started, or expired activity should not expose a participation action on H5.

Do not assert:

- All filter permutations.
- Exact activity card layout.
- Pixel-level image correctness.

### 4. 会员可以从 H5 活动列表进入活动详情并看到关键规则

Purpose:
Prove that the H5 活动详情 reflects the business-critical parts of backend activity configuration.

Arrange:

- Log in as H5 会员.
- Navigate to the H5 activity list.
- Locate the activity by `SMOKE_ACTIVITY_KEYWORD` or `SMOKE_EXPECTED_ACTIVITY_TITLE`.

Act:

- Open the activity detail.

Assert:

- The detail title matches the expected activity.
- The detail page exposes the key rule text, time range, reward description, participation button, or member restriction message relevant to the configured activity.
- If the activity is restricted, the H5 state clearly blocks or explains ineligible participation.

Do not assert:

- Full rich-text HTML structure.
- Every line of marketing copy.
- Image rendering beyond existence and non-broken state.

### 5. 管理后台 VIP 管理成员数量进入查看会员 tab 且不串层级参数

Purpose:
Prove that VIP 管理的成员数量 can be used as trustworthy evidence for 会员层级 membership, and that switching between VIP levels does not reuse stale `vipGrade` or `siteId` parameters.

Arrange:

- Log in to 管理后台.
- Navigate to VIP 管理.
- Identify two VIP levels using `SMOKE_VIP_GRADE_A` and `SMOKE_VIP_GRADE_B`.

Act:

- Click the member count for VIP A.
- Wait for the 查看会员 tab list to load.
- Capture business-visible evidence: tab label, list total, and at least one member row or empty state.
- Observe the list request and record `siteId`, `vipGrade`, `curPage`, and `pageSize`.
- Return to VIP 管理 or select VIP B through the supported product path.
- Click the member count for VIP B and repeat the same observation.

Assert:

- 查看会员 tab opens after clicking the member count.
- VIP A request uses VIP A's `vipGrade`.
- VIP B request uses VIP B's `vipGrade`.
- `siteId` remains the current site for both requests.
- `curPage` resets to `1` when switching VIP level, unless product explicitly specifies otherwise.
- The visible list total matches the clicked member count, or is less than/equal to it when an explicit search filter is active.
- VIP B data does not reuse VIP A rows, total, or request parameters.

Do not assert:

- Database rows.
- Internal table component state.
- Every table column, sort option, or page-size permutation.
- Pixel-level layout of the tab.

## Red-Green Slice Order

Build one thin test at a time:

1. H5 login reaches logged-in game dashboard.
2. Admin login reaches backend shell.
3. Admin member query finds the smoke member.
4. Admin activity search finds the smoke activity.
5. H5 activity list shows the smoke activity.
6. H5 activity detail shows the smoke activity rules.
7. Admin VIP member count opens 查看会员 tab for one VIP level.
8. Admin VIP member count switches to a second VIP level without stale `vipGrade`.

Stop after each red/green step and stabilize selectors before adding the next slice.

## Flake Controls

- Wait for business-visible states, not fixed sleeps.
- Treat loading indicators as transient; wait for final table/list content.
- Use unique UAT test data where possible.
- Keep activity smoke data stable for at least one test cycle.
- Capture screenshots, trace, and console/network errors only on failure.
- Mark external-provider-dependent checks as smoke prerequisites, not test assertions.

## Out of Scope For First Smoke Set

- Creating or editing activities through automation.
- Reward approval and wallet mutation.
- 稽核 state changes.
- Payment callbacks.
- Third-party game provider betting flow.
- Full activity template matrix.
- Full backend table CRUD coverage.
- Full VIP level matrix beyond representative levels with and without members.

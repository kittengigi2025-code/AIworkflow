Title: Set unattended execution safety boundary
Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

Which actions may the AI run unattended, which need approval, and which are prohibited?

Resolve:

- Read-only browser navigation boundary.
- Credentials, OTP, CAPTCHA, and login handoff.
- Test data creation and cleanup policy.
- Financial, wallet, reward, withdrawal, export, upload, permission, and account-state mutation policy.
- Evidence privacy and redaction rules.
- Final pass/fail ownership.

## Answer

The workstation uses a four-tier execution boundary. The default is read-only and evidence-producing. Any action that changes business state must be explicitly classified before execution.

## Tier 1: Allowed Unattended

The AI may run these actions after the user asks it to test a requirement or continue a QA job:

- Read requirement text, screenshots, Axure/Lark/product notes, existing local artifacts, and non-sensitive exported files.
- Create local requirement workspaces under `.scratch/`.
- Generate requirement facts, blocking questions, test strategy, test cases, reports, bug tickets, ledger entries, and retrospectives.
- Navigate read-only H5 frontend and management backend pages in an already authorized browser session.
- Open menus, tabs, filters, table detail pages, detail modals, and read-only drawers.
- Apply filters for observation when the filter does not submit a state-changing job.
- Read visible table fields, page text, balances, statuses, timestamps, IDs, and report values.
- Capture screenshots for evidence.
- Copy visible non-sensitive facts into local reports.
- Mark test cases as passed, failed, blocked, not run, or residual risk based on observed evidence.

Tier 1 does not include saving, submitting, approving, rejecting, exporting, uploading, deleting, sending, or any money/account/permission mutation.

## Tier 2: Allowed With Pre-Authorization

These actions may be executed without asking again only when the user has given an explicit scoped authorization before the run, including environment, account, allowed action, data scope, and rollback/cleanup expectation:

- Creating disposable test data in a UAT/sandbox environment.
- Registering a test member using approved test phone/email patterns.
- Submitting a sandbox recharge through a test channel or controlled callback.
- Entering a sandbox game and placing a known low-risk/deterministic test bet when the account and stake limits are approved.
- Triggering a sandbox activity/reward path when the reward has no production value and the test member is disposable.
- Submitting a withdrawal request in sandbox up to pending review when the account and amount are approved.
- Running approved exports when the file contains no sensitive data or the destination is local and controlled.
- Cleaning up disposable test data where cleanup does not hide evidence needed for the report.

Pre-authorization must be recorded in the requirement workspace before execution. If the observed page, amount, merchant, account, environment, or action differs from the authorization, the AI must stop and ask.

## Tier 3: Requires Action-Time Confirmation

These actions require confirmation immediately before the action, even if the broader job is authorized:

- Saving or submitting forms that change configuration, member state, wallet state, activity state, or report generation state.
- Creating, editing, approving, rejecting, deleting, exporting, uploading, sending, or importing.
- Entering or handling credentials, password fields, OTP, CAPTCHA, recovery codes, or security prompts.
- Recharge, payment callback, wallet adjustment, freeze/unfreeze, reward issuance, rebate issuance, withdrawal request, withdrawal approval/rejection, audit state change, risk-control state change, account lock/unlock, level change, attribution change, permission change, merchant config change, agent hierarchy change, or commission settlement.
- Any action in production or an environment whose safety is unclear.
- Any action whose effect cannot be observed, undone, or bounded.

The confirmation prompt must name the exact environment, account/member, action, amount or business object, expected state change, evidence to capture, and known risk.

## Tier 4: Prohibited By Default

The workstation must not perform these actions unless a future spec deliberately creates a separate, audited production-operations mode:

- Unauthorized production actions.
- Live financial approval, withdrawal payout, manual wallet adjustment, reward issuance, commission settlement, or account-state mutation.
- Permission elevation or creation of privileged backend accounts.
- Bypassing CAPTCHA, OTP, device binding, fraud checks, rate limits, or access controls.
- Using or storing credentials supplied in chat or local artifacts without a dedicated secure credential mechanism.
- Deleting audit trails, ledger records, orders, reports, screenshots, or failure evidence.
- Hiding, overwriting, or reclassifying a confirmed failure to make a report pass.
- Exfiltrating sensitive member data, payment data, credentials, internal URLs, or exported reports outside the local workspace without user instruction.

## Login and Credential Handoff

The preferred pattern is:

1. The user opens or logs into H5 frontend and management backend manually.
2. The user says the browser/session is ready.
3. The AI continues from the already logged-in page.

The AI may report that execution is blocked if a login, OTP, CAPTCHA, password reset, device check, or inaccessible browser session prevents progress. It should tell the user exactly which page/session is needed.

## Test Data Policy

- Use UAT/sandbox data whenever possible.
- Mark disposable members, agents, activities, recharge orders, withdrawal accounts, and promotions with a recognizable test naming pattern when creation is authorized.
- Store test data identifiers in the requirement workspace.
- Do not clean up data before evidence is captured.
- Do not delete records that are part of audit, ledger, report, or failure evidence.
- If cleanup is needed, treat it as its own authorized action and record the cleanup result.

## Evidence Privacy and Redaction

- Store evidence under the requirement workspace, near the related result or bug.
- Screenshots may include visible fields needed to prove the issue.
- Redact or avoid capturing passwords, OTP, full payment account numbers, full phone/email where unnecessary, identity documents, tokens, cookies, API keys, and private member details unrelated to the test.
- Bug tickets should include the minimum data needed to reproduce and diagnose.
- If a screenshot contains sensitive data that cannot be avoided, mark the report as sensitive and do not create a broadly shareable version until redacted.

## Final Judgment Ownership

The AI can make evidence-based QA judgments for individual test cases and requirements:

- `passed`: observed evidence satisfies the acceptance rule.
- `failed`: observed evidence contradicts the rule.
- `blocked`: required access, data, authorization, or product answer is missing.
- `not run`: intentionally skipped or outside the authorized scope.
- `residual risk`: evidence is partial, delayed, or environment-limited.

The human remains the owner of:

- Credentials and session readiness.
- Authorization for state-changing actions.
- Product/business answers to blocking questions.
- Acceptance of residual business risk.
- Any production operation decision.

## Design Consequence

Every executable test step in the artifact contract must carry an `action_class`:

- `read_only`
- `pre_authorized_mutation`
- `confirm_before_action`
- `prohibited_by_default`

The executor must refuse to run steps that lack an `action_class`.

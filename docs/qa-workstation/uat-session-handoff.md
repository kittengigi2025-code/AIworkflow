# UAT Management-Backend Session Handoff

This is the real-session smoke path for one authorized read-only QA case. Authentication remains human-owned; execution and artifact publication remain main-agent-owned.

## Before Handoff

1. Use a dedicated UAT management-backend account with the minimum read permission needed by the planned case.
2. Open the expected UAT management-backend URL and complete login, password, OTP, CAPTCHA, or device verification manually.
3. Select the intended merchant or site scope.
4. Leave the browser on a page where the active environment and merchant scope can be visibly verified.
5. Mark `environment.known_session_state` as `user_ready` in the raw job. Do not place credentials, cookies, tokens, OTP values, recovery codes, or remote-debug endpoints in any job artifact.

## Main-Agent Handoff

The main agent binds the prepared tab to the browser adapter and calls:

```js
await runAuthorizedBrowserCase({
  workspace: "<ready_for_execution job workspace>",
  browser: preparedManagementBackendAdapter,
  caseId: "TC-001"
});
```

The adapter contract is deliberately narrow:

| Capability | Allowed behavior |
| --- | --- |
| `sessionIdentity()` | Return a stable non-secret tab/session label used only through its SHA-256 lease key. |
| `claim("main_agent")` | Grant exclusive ownership of the live tab. |
| `inspectSession()` | Read visible session state, environment, merchant scope, and surface. |
| `navigate(target)` | Navigate to the planned read-only route. |
| `filter(target, value)` | Change an in-page list filter without submitting a business form. |
| `openDetail(target)` | Open a planned read-only row or detail view. |
| `readVisible(target)` | Return visible facts and an explicit expected-observation judgment. |
| `screenshot(context)` | Return PNG bytes plus sensitivity and redaction state. |
| `release("main_agent")` | Release the tab after terminal persistence. |

No worker or parallel agent receives this adapter. Save, submit, create, edit, delete, approve, reject, export, upload, wallet, reward, audit, account, and permission actions are outside this smoke path.

## Smoke Evidence

The smoke is successful when all of the following are true:

- Preflight records `UAT`, the expected merchant scope, and `management_backend` from visible page state.
- The planned navigation, filter, detail, and visible-value operations run in order.
- Every required screenshot resolves from `evidence-manifest.json` and its SHA-256 hash matches the file.
- `execution-results.json` contains `RUN-001`, the selected case and step IDs, observations, evidence IDs, start/end timestamps, and `executor: main_agent`.
- The terminal result is `passed`, `failed`, `blocked`, or `residual_risk`; a missing login or evidence challenge never becomes a pass.
- The browser history and UAT audit trail show no state-changing action.

If the session expires or presents login, OTP, CAPTCHA, device verification, an unexpected environment, or an unexpected merchant, stop. Preserve the precise blocker and ask the user to prepare a new session instead of handling authentication.

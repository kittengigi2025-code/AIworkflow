# Run AI QA Workstation V1

Prepare and authenticate a dedicated read-only UAT session, then provide a config file:

```json
{
  "rawJob": "./raw-job.json",
  "plan": "./plan.json",
  "sessionAdapter": "./prepared-session.mjs",
  "workspaceRoot": "./jobs"
}
```

The session module exports `createPreparedSession(options)` and returns the authorized browser adapter. Start or resume the complete job with:

```powershell
npm run qa:run -- .\job-config.json
```

After startup, the runner proceeds without interaction. It stops only for a recorded requirement, authorization, environment, merchant, login, OTP/CAPTCHA, session, visible-data, or evidence blocker. A terminal run writes `acceptance-record.json`, separating product status, workstation status, residual risk, and the human-owned next action.

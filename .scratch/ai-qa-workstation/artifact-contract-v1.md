# AI QA Workstation Artifact Contract V1

This is a prototype contract for the local-first AI QA workstation. It defines the durable artifacts that let one remote gaming-platform QA job move from requirement intake to report, bug tickets, ledger update, and retrospective feedback.

## File Layout

```text
.scratch/
  qa-index.html
  qa-process-retrospective.html
  <requirement-slug>/
    requirement.json
    questions.json
    strategy.json
    test-cases.json
    worker-proposal-review.json
    worker-contributions.json
    execution-results.json
    evidence-manifest.json
    bugs.json
    retrospective.json
    test-report.html
    bug-tickets.html
    evidence/
      <evidence-id>.png
      <evidence-id>.html
      <evidence-id>.txt
```

HTML files are the human-facing deliverables. JSON files are the machine-operable source of truth. HTML can be regenerated from JSON plus evidence files.

## Shared IDs and Status Values

IDs:

- `requirement_id`: `REQ-YYYYMMDD-short-slug`
- `question_id`: `Q-001`
- `rule_id`: `RULE-001`
- `case_id`: `TC-001`
- `step_id`: `STEP-001`
- `result_id`: `RUN-001`
- `evidence_id`: `EV-001`
- `bug_id`: `BUG-001`

Requirement statuses:

- `intake`
- `waiting_for_confirmation`
- `ready_for_design`
- `ready_for_execution`
- `testing`
- `has_bugs`
- `passed`
- `blocked`
- `waiting_for_regression`
- `regression_passed`
- `regression_failed`

Case result statuses:

- `passed`
- `failed`
- `blocked`
- `not_run`
- `residual_risk`

Action classes:

- `read_only`
- `pre_authorized_mutation`
- `confirm_before_action`
- `prohibited_by_default`

The executor must refuse to run a step with no `action_class`.

## Requirement Facts Schema

`requirement.json`

```json
{
  "requirement_id": "REQ-20260710-vip-count",
  "title": "Requirement title",
  "status": "ready_for_design",
  "source_refs": [
    {
      "type": "text|screenshot|axure|lark|url|browser|export",
      "label": "Human-readable source name",
      "path_or_url": "local path or URL",
      "captured_at": "ISO-8601"
    }
  ],
  "business_surface": {
    "product_surface": ["h5_frontend", "management_backend"],
    "modules": ["member", "wallet", "activity", "report"],
    "h5_paths": ["Promotion center"],
    "backend_paths": ["Activity management > ..."]
  },
  "environment": {
    "name": "UAT",
    "h5_url": "",
    "backend_url": "",
    "merchant_scope": "",
    "known_session_state": "unknown|user_ready|blocked"
  },
  "actors": {
    "member": "",
    "agent": "",
    "merchant": "",
    "backend_account_role": ""
  },
  "confirmed_rules": [
    {
      "rule_id": "RULE-001",
      "text": "Confirmed acceptance rule",
      "source_ref": "source id or note",
      "risk_area": "wallet|recharge|withdrawal|activity|reward|audit|agent|report|permission|display",
      "pass_fail_impact": "high|medium|low"
    }
  ],
  "assumptions": [
    {
      "text": "Assumption used for test design",
      "risk_if_wrong": "What changes if this assumption is wrong"
    }
  ]
}
```

## Blocking Question Schema

`questions.json`

```json
{
  "requirement_id": "REQ-20260710-vip-count",
  "questions": [
    {
      "question_id": "Q-001",
      "classification": "blocking|non_blocking",
      "question": "Pasteable product/development question",
      "why_it_matters": "Pass/fail, data scope, permission, money, reward, or risk impact",
      "affected_rules": ["RULE-001"],
      "default_if_unanswered": "blocked|test_read_only|assume_low_risk",
      "answer": "",
      "answered_by": "",
      "answered_at": ""
    }
  ]
}
```

Only blocking questions should interrupt the user. Non-blocking questions become assumptions, read-only observations, or residual risks.

## Test Strategy Schema

`strategy.json`

```json
{
  "requirement_id": "REQ-20260710-vip-count",
  "scope": {
    "in_scope": ["What will be tested"],
    "out_of_scope": ["What is deliberately not tested"],
    "blocked_scope": ["What cannot be tested yet"]
  },
  "rule_disposition": {
    "covered": ["RULE-001"],
    "blocked": [],
    "out_of_scope": []
  },
  "frontend_backend_mapping": [
    {
      "h5_capability": "Recharge",
      "backend_module": "Payment channel / wallet / recharge report",
      "shared_business_object": "Recharge order",
      "qa_focus": "Wallet and report reconciliation"
    }
  ],
  "risk_matrix": [
    {
      "area": "wallet",
      "risk": "high",
      "why_it_matters": "Money source of truth",
      "coverage": "P0"
    }
  ],
  "automation_priority": "P0|P1|P2",
  "minimal_loop_position": [
    "config_visibility",
    "member_attribution",
    "recharge",
    "wallet_ledger",
    "game_bet_trace",
    "activity_reward_audit",
    "withdrawal",
    "report_reconciliation"
  ],
  "evidence_expectations": ["Screenshots, records, reports, ledger rows"]
}
```

## Test Case Schema

`test-cases.json`

```json
{
  "requirement_id": "REQ-20260710-vip-count",
  "cases": [
    {
      "case_id": "TC-001",
      "title": "Case title",
      "rule_ids": ["RULE-001"],
      "priority": "P0|P1|P2",
      "risk_area": "wallet|recharge|withdrawal|activity|reward|audit|agent|report|permission|display",
      "preconditions": ["Session ready", "Known member exists"],
      "test_data": [
        {
          "name": "member",
          "value": "test member id",
          "sensitivity": "public|internal|sensitive",
          "source": "provided|created|observed"
        }
      ],
      "steps": [
        {
          "step_id": "STEP-001",
          "action": "Navigate to backend member detail",
          "action_class": "read_only",
          "target_surface": "h5_frontend|management_backend|local_artifact",
          "operation": "navigate|filter|open_detail|read_visible",
          "operation_target": "URL, filter, detail entry, or visible field",
          "operation_value": "Required for filter; otherwise empty",
          "assertion": {
            "operator": "equals|contains|matches_regex",
            "expected": "Machine-checkable expected value"
          },
          "expected_observation": "Member detail is visible",
          "confirmation_prompt": "",
          "evidence_required": true
        }
      ],
      "expected_result": "What must be true for the case to pass",
      "evidence_required": ["EV screenshot of member detail"],
      "strategy_evidence_expectations": ["Screenshots, records, reports, ledger rows"],
      "residual_risk_if_not_run": "Risk statement"
    }
  ]
}
```

## Worker Proposal Review Schema

Optional workers receive immutable, minimum-necessary snapshots and return proposals. Workers never receive credentials or a browser/session adapter and never edit authoritative artifacts.

`worker-proposal-review.json`

```json
{
  "requirement_id": "REQ-20260710-vip-count",
  "reviewed_by": "main_agent",
  "reviewed_at": "ISO-8601",
  "reviews": [
    {
      "assignment_id": "WA-001",
      "proposal_id": "WP-001",
      "decision": "accepted|rejected|waiting_for_confirmation",
      "reasons": [],
      "input_revisions": [
        { "artifact": "requirement.json", "sha256": "SHA-256" }
      ],
      "reviewed_by": "main_agent"
    }
  ]
}
```

`worker-contributions.json`

```json
{
  "requirement_id": "REQ-20260710-vip-count",
  "authoritative_owner": "main_agent",
  "accepted_contributions": [
    {
      "contribution_id": "WC-001",
      "type": "requirement_fact_candidate|blocking_question_candidate|test_case_candidate|bug_draft|ledger_entry_candidate|retrospective_candidate",
      "rule_ids": ["RULE-001"],
      "decision_topic": "business-oracle",
      "conflict_key": "Main-agent-derived type + rule IDs + decision topic",
      "summary": "Bounded proposed contribution",
      "payload": {},
      "merged_by": "main_agent",
      "provenance": {
        "assignment_id": "WA-001",
        "proposal_id": "WP-001",
        "input_revisions": [],
        "evidence_refs": [],
        "confidence": "confirmed|probable|weak",
        "do_not_generalize": [],
        "completed_at": "ISO-8601"
      }
    }
  ]
}
```

Assignments declare a stable ID, role, bounded contribution types, rule IDs, main-agent-owned decision topics, immutable input hashes, minimum JSON pointers, and an isolated parallel group. Proposals declare input revisions, contributions, per-contribution evidence reference IDs, source-evidence pointers, open questions, confidence, do-not-generalize notes, completion time, and no authority claims. Conflict keys are derived by the main agent from contribution type, sorted rule IDs, and the assigned decision topic; workers cannot choose them. Parallel overlap is calculated from those same structured scopes rather than free-form labels.

Stale, ungrounded, irrelevant-evidence, over-scoped, secret-bearing, browser/session-controlling, execution, publication, final-status, or authoritative-patch proposals are rejected. Existing review and contribution history is revalidated before append, immutable source hashes are checked again immediately before publication, and one workspace review lock prevents competing publishers. Conflicting interpretations are checked against both the current batch and accepted history, then returned to the blocking question gate rather than decided by worker vote.

Contribution payloads are closed schemas, not arbitrary JSON:

- `requirement_fact_candidate`: `fact`, `sourceText`.
- `blocking_question_candidate`: `question`, `whyItMatters`, `sourceText`.
- `test_case_candidate`: `operation`, `assertion`, `sourceText`; operation is one of the four read-only operations.
- `bug_draft`: `title`, `expected`, `actual`, `sourceText`.
- `ledger_entry_candidate`: `summary`, `sourceText`.
- `retrospective_candidate`: `finding`, `recommendedUpdate`, `sourceText`.

Every contribution names its own evidence reference IDs, and `sourceText` must occur in the linked minimum-data evidence. Per-contribution provenance contains only those cited references plus a proposal fingerprint. Unknown payload keys, opaque credential-like values, or execution/final-judgment aliases are rejected.

## Execution Result Schema

`execution-results.json`

```json
{
  "requirement_id": "REQ-20260710-vip-count",
  "runs": [
    {
      "result_id": "RUN-001",
      "case_id": "TC-001",
      "status": "passed|failed|blocked|not_run|residual_risk",
      "started_at": "ISO-8601",
      "ended_at": "ISO-8601",
      "environment": "UAT",
      "merchant_scope": "Expected merchant or site scope",
      "executor": "main_agent",
      "observed_session": {
        "state": "ready",
        "environment": "UAT",
        "merchant_scope": "Observed merchant or site scope",
        "surface": "management_backend"
      },
      "step_results": [
        {
          "step_id": "STEP-001",
          "status": "passed|failed|blocked|not_run|residual_risk",
          "observed": "What was actually seen",
          "observed_facts": ["Atomic visible facts supporting the judgment"],
          "evidence_ids": ["EV-001"],
          "authorization_ref": "",
          "blocker": ""
        }
      ],
      "judgment": "Short evidence-based conclusion",
      "linked_bug_ids": ["BUG-001"],
      "residual_risks": ["Report delayed, cannot reconcile yet"]
    }
  ]
}
```

## Evidence Manifest Schema

`evidence-manifest.json`

```json
{
  "requirement_id": "REQ-20260710-vip-count",
  "evidence": [
    {
      "evidence_id": "EV-001",
      "type": "screenshot|html|text|export|browser_url",
      "path": "evidence/EV-001.png",
      "captured_at": "ISO-8601",
      "captured_from": "h5_frontend|management_backend|local_artifact",
      "related_case_ids": ["TC-001"],
      "related_bug_ids": ["BUG-001"],
      "description": "What this evidence proves",
      "sensitivity": "public|internal|sensitive",
      "redaction_status": "not_needed|required|complete",
      "hash": "",
      "requirement_id": "REQ-20260710-vip-count",
      "step_id": "STEP-001"
    }
  ]
}
```

Evidence should live close to the result or bug it proves. Screenshots with sensitive data must be marked before broad sharing.

The executor owns the live browser as `main_agent`, verifies the observed environment, merchant scope, and management-backend surface before the first step, and dispatches only `read_only` operations. Login, OTP, CAPTCHA, session recovery, unexpected scope, and evidence-capture failure produce a blocker instead of an inferred pass or failure.

## Bug Ticket Schema

`bugs.json`

```json
{
  "requirement_id": "REQ-20260710-vip-count",
  "bugs": [
    {
      "bug_id": "BUG-001",
      "title": "Concise failure title",
      "severity": "blocker|critical|major|minor|trivial",
      "priority": "P0|P1|P2",
      "impact_scope": "Member wallet/report/activity/etc.",
      "environment": "UAT",
      "preconditions": ["Known setup"],
      "repro_steps": ["Step 1", "Step 2"],
      "expected_result": "Expected behavior",
      "actual_result": "Observed behavior",
      "rule_ids": ["RULE-001"],
      "case_ids": ["TC-001"],
      "evidence_ids": ["EV-001"],
      "status": "open|fixed|cannot_reproduce|accepted_risk|closed",
      "regression_result": ""
    }
  ]
}
```

## HTML Test Report Contract

`test-report.html` must include:

1. Title and metadata: requirement, environment, date, executor, status.
2. Requirement point summary: confirmed rules, assumptions, blocking questions.
3. Strategy summary: surfaces, risk areas, automation priority, scope.
4. Completed observations: concise evidence-backed facts.
5. Discovered issues: bug summary with links to bug sections or `bug-tickets.html`.
6. Test case result table: case ID, rule, priority, action class summary, status, evidence, bug links.
7. Residual risk: blocked checks, delayed reports, missing data, authorization gaps.

The report is operational, table-heavy, and restrained. It should not include process filler or decorative layout.

## Bug Ticket HTML Contract

`bug-tickets.html` exists only when bugs are found. Each bug section must include:

- Title.
- Severity and priority.
- Impact scope.
- Environment.
- Preconditions.
- Reproduction steps.
- Expected result.
- Actual result.
- Evidence screenshot or artifact embedded directly under that bug.
- Related test case and rule IDs.

## QA Ledger Contract

`.scratch/qa-index.html` has one current row per tested requirement:

- Date.
- Requirement.
- Product path.
- Status.
- Issue count.
- Test report link.
- Bug ticket link.
- Regression status.
- Last updated date.

The ledger links only current intended artifacts, not obsolete drafts.

## Feedback Contract

`retrospective.json`

```json
{
  "requirement_id": "REQ-20260710-vip-count",
  "workflow_findings": [
    {
      "type": "prompt_gap|artifact_gap|browser_gap|domain_rule|automation_candidate|low_value_check",
      "finding": "What was learned",
      "reuse_scope": "global|gaming_domain|merchant_specific|requirement_specific",
      "confidence": "confirmed|probable|weak",
      "recommended_update": "What should change next time"
    }
  ],
  "new_heuristics": [
    {
      "text": "Reusable heuristic",
      "allowed_scope": "gaming_domain",
      "evidence": "Why this is safe to reuse"
    }
  ],
  "do_not_generalize": [
    "Project-specific assumption that must not leak into future jobs"
  ]
}
```

Feedback can update future requirement analysis and test design only when its `reuse_scope` is not `requirement_specific` and its `confidence` is `confirmed` or explicitly accepted by the human.

## Generation Order

1. `requirement.json`
2. `questions.json`
3. `strategy.json`
4. `test-cases.json`
5. `execution-results.json`
6. `evidence-manifest.json`
7. `bugs.json`
8. `test-report.html`
9. `bug-tickets.html`
10. `qa-index.html`
11. `retrospective.json`

The loop is intentionally closed: retrospective findings feed the next requirement intake, question gate, strategy, and test design.

import { execFile } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { expect, test } from "@playwright/test";

import { runQuestionGateJob } from "../../src/qa-workstation/question-gate-job.mjs";

const execFileAsync = promisify(execFile);

test.describe("QA job question gate", () => {
  test("answered blocking questions produce a durable ready-for-design job", async ({}, testInfo) => {
    const result = await runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260710-vip-count",
        title: "Member-tier count and member list consistency",
        description: "Verify that a selected member tier opens the matching member list.",
        sourceRefs: [
          {
            type: "axure",
            label: "Member-tier management prototype",
            pathOrUrl: "https://example.test/vip-management",
            capturedAt: "2026-07-10T08:00:00.000Z"
          }
        ],
        environment: {
          name: "UAT",
          managementBackendUrl: "https://uat.example.test/admin",
          merchantScope: "merchant-demo",
          knownSessionState: "user_ready"
        },
        businessSurface: {
          productSurfaces: ["management_backend"],
          modules: ["member"],
          h5Paths: [],
          managementBackendPaths: ["Member tier > View members"]
        },
        actors: {
          member: "",
          agent: "",
          merchant: "merchant-demo",
          managementBackendAccountRole: "qa-read-only"
        },
        confirmedRules: [
          {
            text: "The selected member tier must match the filter and listed member tiers.",
            sourceRef: "Member-tier management prototype",
            riskArea: "display",
            passFailImpact: "high"
          }
        ],
        assumptions: [
          {
            text: "The supplied UAT merchant contains at least one tiered member.",
            riskIfWrong: "The list-consistency case may be blocked by missing data."
          }
        ],
        questions: [
          {
            question: "Is vipGrade zero-based?",
            whyItMatters: "It changes the expected filter value.",
            impacts: ["pass_fail"],
            affectedRules: [1],
            answer: "Yes, the API value is zero-based and the UI label is one-based.",
            answeredBy: "product-owner",
            answeredAt: "2026-07-10T16:10:00+08:00"
          }
        ]
      }
    });

    expect(result.status).toBe("ready_for_design");

    const requirement = JSON.parse(await readFile(result.artifacts.requirement, "utf8"));
    const questions = JSON.parse(await readFile(result.artifacts.questions, "utf8"));

    expect(requirement).toMatchObject({
      requirement_id: "REQ-20260710-vip-count",
      title: "Member-tier count and member list consistency",
      status: "ready_for_design",
      confirmed_rules: [
        {
          rule_id: "RULE-001",
          source_ref: "Member-tier management prototype",
          pass_fail_impact: "high"
        }
      ],
      assumptions: [
        {
          text: "The supplied UAT merchant contains at least one tiered member."
        }
      ],
      business_surface: {
        product_surface: ["management_backend"],
        modules: ["member"],
        h5_paths: [],
        backend_paths: ["Member tier > View members"]
      },
      actors: {
        member: "",
        agent: "",
        merchant: "merchant-demo",
        backend_account_role: "qa-read-only"
      }
    });
    expect(requirement.source_refs[0]).toEqual({
      type: "axure",
      label: "Member-tier management prototype",
      path_or_url: "https://example.test/vip-management",
      captured_at: "2026-07-10T08:00:00.000Z"
    });
    expect(questions).toEqual({
      requirement_id: "REQ-20260710-vip-count",
      questions: [
        {
          question_id: "Q-001",
          classification: "blocking",
          question: "Is vipGrade zero-based?",
          why_it_matters: "It changes the expected filter value.",
          affected_rules: ["RULE-001"],
          default_if_unanswered: "blocked",
          answer: "Yes, the API value is zero-based and the UI label is one-based.",
          answered_by: "product-owner",
          answered_at: "2026-07-10T08:10:00.000Z"
        }
      ]
    });
  });

  test("an unanswered blocking question stops before design", async ({}, testInfo) => {
    const result = await runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260710-member-scope",
        title: "Member-tier count scope",
        description: "Confirm which member states are included in VIP counts.",
        sourceRefs: [],
        environment: { name: "UAT", knownSessionState: "user_ready" },
        confirmedRules: [
          {
            text: "The visible count and list total use the same member scope.",
            sourceRef: "requirement-text",
            riskArea: "display",
            passFailImpact: "high"
          }
        ],
        assumptions: [],
        questions: [
          {
            question: "Are disabled members included in the count?",
            whyItMatters: "It changes the expected count and list total.",
            impacts: ["data_scope"],
            affectedRules: [1]
          }
        ]
      }
    });

    expect(result.status).toBe("waiting_for_confirmation");
    expect(Object.keys(result.artifacts)).toEqual(["requirement", "questions"]);

    const requirement = JSON.parse(await readFile(result.artifacts.requirement, "utf8"));
    const questions = JSON.parse(await readFile(result.artifacts.questions, "utf8"));

    expect(requirement.status).toBe("waiting_for_confirmation");
    expect(questions.questions[0]).toMatchObject({
      question_id: "Q-001",
      classification: "blocking",
      default_if_unanswered: "blocked",
      answer: ""
    });
  });

  test("an unanswered observation question remains non-blocking", async ({}, testInfo) => {
    const result = await runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260710-vip-empty-copy",
        title: "Member-tier empty-state copy observation",
        description: "Observe the current empty-state wording without changing acceptance rules.",
        sourceRefs: [],
        environment: { name: "UAT" },
        confirmedRules: [],
        assumptions: [],
        questions: [
          {
            question: "What empty-state wording is currently visible?",
            whyItMatters: "The wording can be recorded during read-only exploration.",
            impacts: ["read_only_observation"],
            affectedRules: []
          }
        ]
      }
    });

    expect(result.status).toBe("ready_for_design");

    const questions = JSON.parse(await readFile(result.artifacts.questions, "utf8"));
    expect(questions.questions[0]).toMatchObject({
      classification: "non_blocking",
      default_if_unanswered: "test_read_only",
      answer: ""
    });
  });

  test("credential fields are rejected before artifacts are persisted", async ({}, testInfo) => {
    const workspaceRoot = testInfo.outputPath("jobs");
    const job = runQuestionGateJob({
      workspaceRoot,
      rawJob: {
        requirementId: "REQ-20260710-sensitive-input",
        title: "Sensitive input must not persist",
        description: "Reject credentials from the raw job bundle.",
        sourceRefs: [],
        environment: { name: "UAT" },
        confirmedRules: [],
        assumptions: [],
        questions: [],
        credentials: {
          account: "qa-admin",
          password: "must-not-be-written"
        }
      }
    });

    await expect(job).rejects.toThrow(/prohibited sensitive field.*(?:credentials|password)/i);
    await expect(
      access(`${workspaceRoot}\\REQ-20260710-sensitive-input`)
    ).rejects.toThrow();
  });

  test("sensitive URL query values are redacted before persistence", async ({}, testInfo) => {
    const result = await runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260710-redacted-source",
        title: "Redacted source reference",
        description: "Keep source provenance without persisting access tokens.",
        sourceRefs: [
          {
            type: "url",
            label: "Protected product note",
            pathOrUrl: "https://example.test/spec?access_token=secret-value&view=vip",
            capturedAt: "2026-07-10T09:00:00.000Z"
          }
        ],
        environment: {
          name: "UAT",
          managementBackendUrl:
            "https://qa-user:secret-password@example.test/admin?access_token=environment-secret"
        },
        confirmedRules: [],
        assumptions: [],
        questions: []
      }
    });

    const requirement = JSON.parse(await readFile(result.artifacts.requirement, "utf8"));
    expect(requirement.source_refs[0].path_or_url).toBe(
      "https://example.test/spec?access_token=REDACTED&view=vip"
    );
    expect(requirement.environment.backend_url).toBe(
      "https://REDACTED:REDACTED@example.test/admin?access_token=REDACTED"
    );
  });

  test("a minimal raw job defaults optional intake collections", async ({}, testInfo) => {
    const result = await runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260710-minimal-intake",
        title: "Minimal intake",
        description: "Start analysis before optional source material arrives."
      }
    });

    expect(result.status).toBe("ready_for_design");

    const requirement = JSON.parse(await readFile(result.artifacts.requirement, "utf8"));
    const questions = JSON.parse(await readFile(result.artifacts.questions, "utf8"));
    expect(requirement).toMatchObject({
      source_refs: [
        {
          type: "text",
          label: "requirement-text",
          path_or_url: "",
          captured_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        }
      ],
      confirmed_rules: [],
      assumptions: [],
      environment: {
        name: "",
        known_session_state: "unknown"
      }
    });
    expect(questions.questions).toEqual([]);
  });

  test("an invalid requirement identity is rejected before path creation", async ({}, testInfo) => {
    const workspaceRoot = testInfo.outputPath("jobs");
    const job = runQuestionGateJob({
      workspaceRoot,
      rawJob: {
        requirementId: "../outside-workspace",
        title: "Invalid identity",
        description: "A requirement identity cannot escape its workspace."
      }
    });

    await expect(job).rejects.toThrow(/requirementId.*REQ-YYYYMMDD-slug/i);
    await expect(access(path.join(workspaceRoot, "..", "outside-workspace"))).rejects.toThrow();
  });

  test("a user can start the question gate from a JSON job file", async ({}, testInfo) => {
    const inputPath = testInfo.outputPath("raw-job.json");
    const workspaceRoot = testInfo.outputPath("jobs");
    await writeFile(
      inputPath,
      JSON.stringify({
        requirementId: "REQ-20260710-command-intake",
        title: "Command intake",
        description: "Start the question gate from a durable raw job file."
      }),
      "utf8"
    );

    const { stdout } = await execFileAsync(
      process.execPath,
      [
        path.join(process.cwd(), "scripts", "run-question-gate-job.mjs"),
        "--input",
        inputPath,
        "--workspace",
        workspaceRoot
      ],
      { cwd: process.cwd() }
    );
    const summary = JSON.parse(stdout);

    expect(summary.status).toBe("ready_for_design");
    await expect(access(summary.artifacts.requirement)).resolves.toBeUndefined();
    await expect(access(summary.artifacts.questions)).resolves.toBeUndefined();
  });

  test("every business and execution-safety impact blocks when unanswered", async ({}, testInfo) => {
    const blockingImpacts = [
      "pass_fail",
      "data_scope",
      "permission",
      "money",
      "reward",
      "business_risk",
      "safety",
      "execution_safety"
    ];

    for (const [index, impact] of blockingImpacts.entries()) {
      const result = await runQuestionGateJob({
        workspaceRoot: testInfo.outputPath("jobs"),
        rawJob: {
          requirementId: `REQ-20260710-impact-${String(index + 1).padStart(2, "0")}`,
          title: `Unanswered ${impact} question`,
          description: "Every material business or safety ambiguity must stop before design.",
          questions: [
            {
              question: `Does this affect ${impact}?`,
              whyItMatters: "The answer changes whether execution is safe or correct.",
              impacts: [impact]
            }
          ]
        }
      });

      expect(result.status, impact).toBe("waiting_for_confirmation");
    }
  });

  test("a confirmed rule cannot reference unknown source material", async ({}, testInfo) => {
    const job = runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260710-rule-provenance",
        title: "Rule provenance",
        description: "Every confirmed rule must resolve to captured source material.",
        confirmedRules: [
          {
            text: "Member-tier counts use the confirmed product scope.",
            sourceRef: "missing-product-reply",
            riskArea: "display",
            passFailImpact: "high"
          }
        ]
      }
    });

    await expect(job).rejects.toThrow(/confirmed rule.*unknown source.*missing-product-reply/i);
  });

  test("an answered question requires answer provenance", async ({}, testInfo) => {
    const job = runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260710-answer-provenance",
        title: "Answer provenance",
        description: "An answered blocking question must identify who answered and when.",
        questions: [
          {
            question: "Are disabled members included?",
            whyItMatters: "It changes the member-tier count scope.",
            impacts: ["data_scope"],
            answer: "No."
          }
        ]
      }
    });

    await expect(job).rejects.toThrow(/answered question.*answeredBy.*answeredAt/i);
  });

  test("explicit rule and question identities survive reordered input", async ({}, testInfo) => {
    const result = await runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260710-stable-identities",
        title: "Stable identities",
        description: "Preserve identifiers when source items are reordered in a later revision.",
        confirmedRules: [
          {
            ruleId: "RULE-007",
            text: "The selected member tier matches the visible filter.",
            riskArea: "display",
            passFailImpact: "high"
          },
          {
            ruleId: "RULE-002",
            text: "The member count matches the listed total.",
            riskArea: "display",
            passFailImpact: "high"
          }
        ],
        questions: [
          {
            questionId: "Q-009",
            question: "What wording is visible for an empty member tier?",
            whyItMatters: "The current wording can be recorded without changing acceptance.",
            impacts: ["read_only_observation"],
            affectedRules: ["RULE-007"]
          }
        ]
      }
    });

    const requirement = JSON.parse(await readFile(result.artifacts.requirement, "utf8"));
    const questions = JSON.parse(await readFile(result.artifacts.questions, "utf8"));
    expect(requirement.confirmed_rules.map((rule: { rule_id: string }) => rule.rule_id)).toEqual([
      "RULE-007",
      "RULE-002"
    ]);
    expect(questions.questions[0]).toMatchObject({
      question_id: "Q-009",
      affected_rules: ["RULE-007"]
    });
  });

  test("an unknown question impact is rejected instead of becoming non-blocking", async ({}, testInfo) => {
    const job = runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260710-unknown-impact",
        title: "Unknown question impact",
        description: "A misspelled safety policy cannot silently become non-blocking.",
        questions: [
          {
            question: "Does this require a privileged role?",
            whyItMatters: "Permission ambiguity must block execution.",
            impacts: ["permision"]
          }
        ]
      }
    });

    await expect(job).rejects.toThrow(/unknown question impact.*permision/i);
  });

  test("authorization and JWT aliases are rejected as sensitive input", async ({}, testInfo) => {
    const job = runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260710-auth-alias",
        title: "Authorization aliases",
        description: "Authentication secrets cannot enter durable intake artifacts.",
        requestContext: {
          authorization: "Bearer must-not-persist",
          jwt: "header.payload.signature"
        }
      }
    });

    await expect(job).rejects.toThrow(/prohibited sensitive field.*authorization/i);

    const tokenAliasJob = runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260710-token-alias",
        title: "Token aliases",
        description: "Token-like field names cannot enter durable artifacts.",
        requestContext: { apiToken: "must-not-persist" }
      }
    });
    await expect(tokenAliasJob).rejects.toThrow(/prohibited sensitive field.*apiToken/i);
  });

  test("embedded bearer credentials are rejected from ordinary text", async ({}, testInfo) => {
    const job = runQuestionGateJob({
      workspaceRoot: testInfo.outputPath("jobs"),
      rawJob: {
        requirementId: "REQ-20260710-embedded-secret",
        title: "Embedded secret",
        description: "Authorization: Bearer abc.def.ghi"
      }
    });

    await expect(job).rejects.toThrow(/prohibited sensitive value.*description/i);
  });

  test("invalid intake contract fields are rejected before persistence", async ({}, testInfo) => {
    const invalidCases = [
      {
        suffix: "rule-text",
        extra: { confirmedRules: [{ riskArea: "display", passFailImpact: "high" }] },
        error: /confirmedRules\[0\]\.text is required/i
      },
      {
        suffix: "risk-area",
        extra: {
          confirmedRules: [
            { text: "Rule", riskArea: "unknown-area", passFailImpact: "high" }
          ]
        },
        error: /unknown riskArea.*unknown-area/i
      },
      {
        suffix: "source-type",
        extra: { sourceRefs: [{ type: "database", label: "DB dump" }] },
        error: /unknown source type.*database/i
      },
      {
        suffix: "question-text",
        extra: {
          questions: [
            { whyItMatters: "Changes pass or fail", impacts: ["pass_fail"] }
          ]
        },
        error: /questions\[0\]\.question is required/i
      },
      {
        suffix: "assumption-risk",
        extra: { assumptions: [{ text: "A test member exists" }] },
        error: /assumptions\[0\]\.riskIfWrong is required/i
      },
      {
        suffix: "session-state",
        extra: { environment: { knownSessionState: "logged_in_maybe" } },
        error: /unknown knownSessionState.*logged_in_maybe/i
      },
      {
        suffix: "legacy-backend",
        extra: { environment: { backendUrl: "https://legacy.example.test" } },
        error: /environment\.backendUrl.*managementBackendUrl/i
      }
    ];

    for (const { suffix, extra, error } of invalidCases) {
      const workspaceRoot = testInfo.outputPath("jobs");
      const job = runQuestionGateJob({
        workspaceRoot,
        rawJob: {
          requirementId: `REQ-20260710-invalid-${suffix}`,
          title: "Invalid contract field",
          description: "Invalid intake cannot create authoritative artifacts.",
          ...extra
        }
      });

      await expect(job, suffix).rejects.toThrow(error);
      await expect(access(path.join(workspaceRoot, `REQ-20260710-invalid-${suffix}`))).rejects.toThrow();
    }
  });
});

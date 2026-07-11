import { access, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { PHASES, markPhaseDone, markPhaseInProgress } from "./job-phase.mjs";

const ACTION_CLASSES = new Set([
  "read_only",
  "pre_authorized_mutation",
  "confirm_before_action",
  "prohibited_by_default"
]);
const TARGET_SURFACES = new Set(["h5_frontend", "management_backend", "local_artifact"]);
const READ_ONLY_OPERATIONS = new Set(["navigate", "filter", "open_detail", "read_visible"]);
const ASSERTION_OPERATORS = new Set(["equals", "contains", "matches_regex"]);
const PRIORITIES = new Set(["P0", "P1", "P2"]);
const RISK_AREAS = new Set([
  "wallet",
  "recharge",
  "withdrawal",
  "activity",
  "reward",
  "audit",
  "agent",
  "report",
  "permission",
  "display"
]);
const MINIMAL_LOOP_POSITIONS = new Set([
  "config_visibility",
  "member_attribution",
  "recharge",
  "wallet_ledger",
  "game_bet_trace",
  "activity_reward_audit",
  "withdrawal",
  "report_reconciliation"
]);
const SENSITIVITIES = new Set(["public", "internal", "sensitive"]);
const DATA_SOURCES = new Set(["provided", "created", "observed"]);
const RISK_ORDER = { high: 0, medium: 1, low: 2 };
const HIGH_RISK_AREAS = new Set([
  "wallet",
  "recharge",
  "withdrawal",
  "reward",
  "audit",
  "report",
  "permission"
]);

export async function runReadOnlyPlanningJob({ workspace, plan }) {
  const requirementPath = path.join(workspace, "requirement.json");
  const questionsPath = path.join(workspace, "questions.json");
  const requirement = await readJson(requirementPath);
  await readJson(questionsPath);

  if (requirement.status !== "ready_for_design") {
    throw new Error(`Job status ${requirement.status} cannot enter planning`);
  }
  await assertNoPlanningArtifacts(workspace);
  markPhaseInProgress(requirement, PHASES.design);

  const validation = validatePlan(requirement, plan);
  const strategy = buildStrategy(requirement, plan, validation);
  const artifacts = { strategy: path.join(workspace, "strategy.json") };

  if (validation.nonReadOnlySteps.length > 0 || plan.cases.length === 0) {
    if (plan.cases.length === 0) {
      strategy.scope.blocked_scope.push("No executable read-only cases were produced");
    }
    strategy.scope.blocked_scope.push(
      ...validation.nonReadOnlySteps.map(
        (step) => `${step.stepId}: ${step.actionClass} is outside the read-only first slice`
      )
    );
    strategy.rule_disposition.blocked = unique([
      ...strategy.rule_disposition.blocked,
      ...strategy.rule_disposition.covered
    ]);
    strategy.rule_disposition.covered = [];
    requirement.status = "blocked";
    await publishJsonArtifacts([
      [artifacts.strategy, strategy],
      [requirementPath, requirement]
    ]);
    await markPhaseDone(requirement, workspace, PHASES.design);
    await publishJsonArtifacts([[requirementPath, requirement]]);
    return { status: requirement.status, workspace, artifacts };
  }

  artifacts.testCases = path.join(workspace, "test-cases.json");
  const testCases = buildTestCases(requirement, plan);
  requirement.status = "ready_for_execution";
  await publishJsonArtifacts([
    [artifacts.strategy, strategy],
    [artifacts.testCases, testCases],
    [requirementPath, requirement]
  ]);
  await markPhaseDone(requirement, workspace, PHASES.design);
  await publishJsonArtifacts([[requirementPath, requirement]]);

  return { status: requirement.status, workspace, artifacts };
}

function validatePlan(requirement, plan) {
  assertObject(plan, "plan");
  assertObject(plan.strategy, "strategy");
  assertObject(plan.strategy.scope, "strategy.scope");
  for (const field of ["inScope", "outOfScope", "blockedScope"]) {
    assertStringArray(plan.strategy.scope[field], `strategy.scope.${field}`);
  }
  assertArray(plan.strategy.frontendBackendMapping, "strategy.frontendBackendMapping", false);
  for (const [index, mapping] of plan.strategy.frontendBackendMapping.entries()) {
    assertObject(mapping, `strategy.frontendBackendMapping[${index}]`);
    for (const field of [
      "h5Capability",
      "managementBackendModule",
      "sharedBusinessObject",
      "qaFocus"
    ]) {
      assertString(mapping[field], `strategy.frontendBackendMapping[${index}].${field}`);
    }
  }
  assertArray(plan.strategy.riskMatrix, "strategy.riskMatrix", false);
  for (const [index, risk] of plan.strategy.riskMatrix.entries()) {
    assertObject(risk, `strategy.riskMatrix[${index}]`);
    assertEnum(risk.area, RISK_AREAS, `strategy.riskMatrix[${index}].area`);
    assertEnum(risk.risk, new Set(Object.keys(RISK_ORDER)), `strategy.riskMatrix[${index}].risk`);
    assertString(risk.whyItMatters, `strategy.riskMatrix[${index}].whyItMatters`);
    assertEnum(risk.coverage, PRIORITIES, `strategy.riskMatrix[${index}].coverage`);
  }
  assertEnum(plan.strategy.automationPriority, PRIORITIES, "strategy.automationPriority");
  assertArray(plan.strategy.minimalLoopPosition, "strategy.minimalLoopPosition", false);
  for (const position of plan.strategy.minimalLoopPosition) {
    assertEnum(position, MINIMAL_LOOP_POSITIONS, "strategy.minimalLoopPosition");
  }
  assertStringArray(plan.strategy.evidenceExpectations, "strategy.evidenceExpectations", false);

  assertArray(plan.cases, "cases");
  const knownRuleIds = new Set(requirement.confirmed_rules.map((rule) => rule.rule_id));
  const blockedRuleIds = validateRuleDisposition(plan.blockedRuleIds, knownRuleIds, "blockedRuleIds");
  const outOfScopeRuleIds = validateRuleDisposition(
    plan.outOfScopeRuleIds,
    knownRuleIds,
    "outOfScopeRuleIds"
  );
  const caseIds = new Set();
  const stepIds = new Set();
  const coveredRuleIds = new Set();
  const nonReadOnlySteps = [];
  const nonReadOnlyRuleIds = new Set();
  let generatedStepIndex = 0;

  for (const [caseIndex, testCase] of plan.cases.entries()) {
    const label = `cases[${caseIndex}]`;
    assertObject(testCase, label);
    assertString(testCase.title, `${label}.title`);
    assertStringArray(testCase.ruleIds, `${label}.ruleIds`, false);
    for (const ruleId of testCase.ruleIds) {
      if (!knownRuleIds.has(ruleId)) throw new Error(`${label} references unknown rule ${ruleId}`);
      coveredRuleIds.add(ruleId);
    }
    assertEnum(testCase.priority, PRIORITIES, `${label}.priority`);
    assertEnum(testCase.riskArea, RISK_AREAS, `${label}.riskArea`);
    assertStringArray(testCase.preconditions, `${label}.preconditions`, false);
    assertArray(testCase.testData, `${label}.testData`);
    for (const [dataIndex, item] of testCase.testData.entries()) {
      const dataLabel = `${label}.testData[${dataIndex}]`;
      assertObject(item, dataLabel);
      assertString(item.name, `${dataLabel}.name`);
      assertString(item.value, `${dataLabel}.value`);
      assertEnum(item.sensitivity, SENSITIVITIES, `${dataLabel}.sensitivity`);
      assertEnum(item.source, DATA_SOURCES, `${dataLabel}.source`);
    }
    assertArray(testCase.steps, `${label}.steps`, false);
    assertString(testCase.expectedResult, `${label}.expectedResult`);
    assertStringArray(testCase.evidenceRequired, `${label}.evidenceRequired`, false);
    assertStringArray(testCase.evidenceExpectationRefs, `${label}.evidenceExpectationRefs`, false);
    for (const expectation of testCase.evidenceExpectationRefs) {
      if (!plan.strategy.evidenceExpectations.includes(expectation)) {
        throw new Error(`${label} references unknown strategy evidence expectation: ${expectation}`);
      }
    }
    assertString(testCase.residualRiskIfNotRun, `${label}.residualRiskIfNotRun`);

    const caseId = testCase.caseId ?? formatId("TC", caseIndex);
    assertUniqueId(caseId, /^TC-\d{3}$/, caseIds, `${label}.caseId`);
    let hasEvidenceStep = false;
    for (const [stepIndex, step] of testCase.steps.entries()) {
      const stepLabel = `${label}.steps[${stepIndex}]`;
      assertObject(step, stepLabel);
      assertString(step.action, `${stepLabel}.action`);
      assertEnum(step.actionClass, ACTION_CLASSES, `${stepLabel}.actionClass`);
      assertEnum(step.targetSurface, TARGET_SURFACES, `${stepLabel}.targetSurface`);
      assertEnum(step.operation, READ_ONLY_OPERATIONS, `${stepLabel}.operation`);
      assertString(step.operationTarget, `${stepLabel}.operationTarget`);
      if (step.operation === "filter") {
        assertString(step.operationValue, `${stepLabel}.operationValue`);
      } else if (step.operationValue !== undefined && typeof step.operationValue !== "string") {
        throw new Error(`${stepLabel}.operationValue must be a string`);
      }
      assertObject(step.assertion, `${stepLabel}.assertion`);
      assertEnum(
        step.assertion.operator,
        ASSERTION_OPERATORS,
        `${stepLabel}.assertion.operator`
      );
      assertString(step.assertion.expected, `${stepLabel}.assertion.expected`);
      if (step.assertion.operator === "matches_regex") {
        try {
          new RegExp(step.assertion.expected);
        } catch {
          throw new Error(`${stepLabel}.assertion.expected must be a valid regular expression`);
        }
      }
      assertString(step.expectedObservation, `${stepLabel}.expectedObservation`);
      if (typeof step.evidenceRequired !== "boolean") {
        throw new Error(`${stepLabel}.evidenceRequired must be a boolean`);
      }
      hasEvidenceStep ||= step.evidenceRequired;
      const stepId = step.stepId ?? formatId("STEP", generatedStepIndex++);
      assertUniqueId(stepId, /^STEP-\d{3}$/, stepIds, `${stepLabel}.stepId`);
      if (step.actionClass !== "read_only") {
        nonReadOnlySteps.push({ stepId, actionClass: step.actionClass });
        for (const ruleId of testCase.ruleIds) nonReadOnlyRuleIds.add(ruleId);
      }
    }
    if (!hasEvidenceStep) throw new Error(`${label} has no step linked to required evidence`);
  }

  for (const ruleId of knownRuleIds) {
    const dispositions = [
      coveredRuleIds.has(ruleId),
      blockedRuleIds.includes(ruleId),
      outOfScopeRuleIds.includes(ruleId)
    ].filter(Boolean).length;
    if (dispositions === 0) throw new Error(`Confirmed rule ${ruleId} has no case or explicit disposition`);
    if (dispositions > 1) throw new Error(`Confirmed rule ${ruleId} has conflicting dispositions`);
  }

  const coveredRiskAreas = new Set(
    requirement.confirmed_rules
      .filter((rule) => coveredRuleIds.has(rule.rule_id))
      .map((rule) => rule.risk_area)
  );
  const plannedRiskAreas = new Set(plan.strategy.riskMatrix.map((risk) => risk.area));
  for (const riskArea of coveredRiskAreas) {
    if (!plannedRiskAreas.has(riskArea)) {
      throw new Error(`strategy.riskMatrix is missing covered risk area ${riskArea}`);
    }
  }

  return {
    coveredRuleIds: [...coveredRuleIds],
    blockedRuleIds,
    outOfScopeRuleIds,
    nonReadOnlySteps,
    nonReadOnlyRuleIds: [...nonReadOnlyRuleIds]
  };
}

function buildStrategy(requirement, plan, validation) {
  return {
    requirement_id: requirement.requirement_id,
    scope: {
      in_scope: [...plan.strategy.scope.inScope],
      out_of_scope: [...plan.strategy.scope.outOfScope],
      blocked_scope: [...plan.strategy.scope.blockedScope]
    },
    rule_disposition: {
      covered: validation.coveredRuleIds,
      blocked: validation.blockedRuleIds,
      out_of_scope: validation.outOfScopeRuleIds
    },
    frontend_backend_mapping: plan.strategy.frontendBackendMapping.map((entry) => ({
      h5_capability: entry.h5Capability,
      backend_module: entry.managementBackendModule,
      shared_business_object: entry.sharedBusinessObject,
      qa_focus: entry.qaFocus
    })),
    risk_matrix: plan.strategy.riskMatrix
      .map((entry) => ({
        area: entry.area,
        risk: elevateRisk(entry.area, entry.risk),
        why_it_matters: entry.whyItMatters,
        coverage: priorityForRisk(entry.area, entry.coverage)
      }))
      .sort((left, right) => RISK_ORDER[left.risk] - RISK_ORDER[right.risk]),
    automation_priority: plan.strategy.automationPriority,
    minimal_loop_position: plan.strategy.minimalLoopPosition,
    evidence_expectations: plan.strategy.evidenceExpectations
  };
}

function buildTestCases(requirement, plan) {
  let stepIndex = 0;
  return {
    requirement_id: requirement.requirement_id,
    cases: plan.cases.map((testCase, caseIndex) => ({
      case_id: testCase.caseId ?? formatId("TC", caseIndex),
      title: testCase.title,
      rule_ids: testCase.ruleIds,
      priority: priorityForRisk(testCase.riskArea, testCase.priority),
      risk_area: testCase.riskArea,
      preconditions: testCase.preconditions,
      test_data: testCase.testData.map((item) => ({
        name: item.name,
        value: item.value,
        sensitivity: item.sensitivity,
        source: item.source
      })),
      steps: testCase.steps.map((step) => ({
        step_id: step.stepId ?? formatId("STEP", stepIndex++),
        action: step.action,
        action_class: step.actionClass,
        target_surface: step.targetSurface,
        operation: step.operation,
        operation_target: step.operationTarget,
        operation_value: step.operationValue ?? "",
        assertion: {
          operator: step.assertion.operator,
          expected: step.assertion.expected
        },
        expected_observation: step.expectedObservation,
        confirmation_prompt: step.confirmationPrompt ?? "",
        evidence_required: step.evidenceRequired
      })),
      expected_result: testCase.expectedResult,
      evidence_required: testCase.evidenceRequired,
      strategy_evidence_expectations: testCase.evidenceExpectationRefs,
      residual_risk_if_not_run: testCase.residualRiskIfNotRun
    }))
  };
}

function elevateRisk(area, risk) {
  if (HIGH_RISK_AREAS.has(area)) return "high";
  if (area === "agent" && risk === "low") return "medium";
  return risk;
}

function priorityForRisk(area, priority) {
  if (HIGH_RISK_AREAS.has(area)) return "P0";
  if (area === "agent" && priority === "P2") return "P1";
  return priority;
}

function validateRuleDisposition(value = [], knownRuleIds, label) {
  assertStringArray(value, label);
  const uniqueIds = unique(value);
  if (uniqueIds.length !== value.length) throw new Error(`${label} contains duplicate rule IDs`);
  for (const ruleId of uniqueIds) {
    if (!knownRuleIds.has(ruleId)) throw new Error(`${label} references unknown rule ${ruleId}`);
  }
  return uniqueIds;
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertArray(value, label, allowEmpty = true) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? "an array" : "a non-empty array"}`);
  }
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a string`);
}

function assertStringArray(value, label, allowEmpty = true) {
  assertArray(value, label, allowEmpty);
  for (const item of value) assertString(item, label);
}

function assertEnum(value, allowed, label) {
  if (!allowed.has(value)) throw new Error(`${label} has invalid value ${String(value)}`);
}

function assertUniqueId(value, pattern, seen, label) {
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(`${label} is invalid`);
  if (seen.has(value)) throw new Error(`${label} duplicates ${value}`);
  seen.add(value);
}

function unique(values) {
  return [...new Set(values)];
}

function formatId(prefix, zeroBasedIndex) {
  return `${prefix}-${String(zeroBasedIndex + 1).padStart(3, "0")}`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function assertNoPlanningArtifacts(workspace) {
  for (const name of ["strategy.json", "test-cases.json"]) {
    try {
      await access(path.join(workspace, name));
      throw new Error(`Planning artifact ${name} already exists`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

async function publishJsonArtifacts(entries) {
  const temporary = entries.map(([filePath, value]) => ({
    filePath,
    tempPath: `${filePath}.${randomUUID()}.tmp`,
    contents: `${JSON.stringify(value, null, 2)}\n`
  }));
  try {
    await Promise.all(
      temporary.map(({ tempPath, contents }) => writeFile(tempPath, contents, "utf8"))
    );
    for (const { filePath, tempPath } of temporary) await rename(tempPath, filePath);
  } finally {
    await Promise.all(
      temporary.map(({ tempPath }) => rm(tempPath, { force: true }).catch(() => undefined))
    );
  }
}

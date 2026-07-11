import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  PHASES,
  markPhaseDone,
  markPhaseInProgress,
  publishJsonArtifacts
} from "./job-phase.mjs";

const BLOCKING_IMPACTS = new Set([
  "pass_fail",
  "data_scope",
  "permission",
  "money",
  "reward",
  "business_risk",
  "safety",
  "execution_safety"
]);
const NON_BLOCKING_IMPACTS = new Set(["read_only_observation"]);
const KNOWN_IMPACTS = new Set([...BLOCKING_IMPACTS, ...NON_BLOCKING_IMPACTS]);
const SOURCE_TYPES = new Set(["text", "screenshot", "axure", "lark", "url", "browser", "export"]);
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
const PASS_FAIL_IMPACTS = new Set(["high", "medium", "low"]);
const SESSION_STATES = new Set(["unknown", "user_ready", "blocked"]);
const SENSITIVE_KEYS = new Set([
  "password",
  "otp",
  "onetimepassword",
  "captcha",
  "cookie",
  "cookies",
  "auth",
  "authorization",
  "jwt",
  "bearer",
  "bearertoken",
  "token",
  "idtoken",
  "accesstoken",
  "refreshtoken",
  "sessionid",
  "sessionkey",
  "sessiontoken",
  "recoverycode",
  "recoverycodes",
  "apikey",
  "clientsecret"
]);
const QUESTION_CLASSIFICATION = {
  blocking: "blocking",
  nonBlocking: "non_blocking"
};
const JOB_STATUS = {
  waitingForConfirmation: "waiting_for_confirmation",
  readyForDesign: "ready_for_design"
};

export async function runQuestionGateJob({ rawJob, workspaceRoot }) {
  validateJobIdentity({ rawJob, workspaceRoot });
  assertNoSensitiveFields(rawJob);
  validateRawJobContract(rawJob);

  const sourceRefs = normalizeSourceRefs(rawJob);
  const sourceLabels = new Set(sourceRefs.map((source) => source.label));
  validateQuestionAnswers(rawJob.questions ?? []);
  const confirmedRules = (rawJob.confirmedRules ?? []).map((rule, index) => ({
    rule_id: resolveItemId(rule.ruleId, "RULE", index),
    text: rule.text,
    source_ref: resolveRuleSource(rule, sourceLabels),
    risk_area: rule.riskArea,
    pass_fail_impact: rule.passFailImpact
  }));
  const ruleIds = assertUniqueIds(
    confirmedRules.map((rule) => rule.rule_id),
    "rule"
  );
  const questions = (rawJob.questions ?? []).map((question, index) => {
    const classification = hasBlockingImpact(question.impacts, index)
      ? QUESTION_CLASSIFICATION.blocking
      : QUESTION_CLASSIFICATION.nonBlocking;
    return {
      question_id: resolveItemId(question.questionId, "Q", index),
      classification,
      question: question.question,
      why_it_matters: question.whyItMatters,
      affected_rules: (question.affectedRules ?? []).map((ruleRef) =>
        resolveAffectedRuleId(ruleRef, ruleIds)
      ),
      default_if_unanswered:
        classification === QUESTION_CLASSIFICATION.blocking ? "blocked" : "test_read_only",
      answer: question.answer ?? "",
      answered_by: question.answeredBy ?? "",
      answered_at: question.answeredAt ? normalizeTimestamp(question.answeredAt) : ""
    };
  });
  assertUniqueIds(
    questions.map((question) => question.question_id),
    "question"
  );
  const hasUnansweredBlockingQuestion = questions.some(
    (question) =>
      question.classification === QUESTION_CLASSIFICATION.blocking && !question.answer.trim()
  );
  const status = hasUnansweredBlockingQuestion
    ? JOB_STATUS.waitingForConfirmation
    : JOB_STATUS.readyForDesign;
  const requirement = {
    requirement_id: rawJob.requirementId,
    title: rawJob.title,
    description: rawJob.description,
    status,
    source_refs: sourceRefs,
    business_surface: normalizeBusinessSurface(rawJob.businessSurface),
    environment: {
      name: rawJob.environment?.name ?? "",
      h5_url: redactSensitiveUrl(rawJob.environment?.h5Url ?? ""),
      backend_url: redactSensitiveUrl(rawJob.environment?.managementBackendUrl ?? ""),
      merchant_scope: rawJob.environment?.merchantScope ?? "",
      known_session_state: rawJob.environment?.knownSessionState ?? "unknown"
    },
    actors: normalizeActors(rawJob.actors),
    confirmed_rules: confirmedRules,
    assumptions: (rawJob.assumptions ?? []).map((assumption) => ({
      text: assumption.text,
      risk_if_wrong: assumption.riskIfWrong
    }))
  };
  markPhaseInProgress(requirement, PHASES.intake);

  const questionArtifact = {
    requirement_id: rawJob.requirementId,
    questions
  };
  const workspace = path.join(workspaceRoot, rawJob.requirementId);
  const artifacts = {
    requirement: path.join(workspace, "requirement.json"),
    questions: path.join(workspace, "questions.json")
  };

  await mkdir(workspace, { recursive: true });
  await publishJsonArtifacts([
    [artifacts.requirement, requirement],
    [artifacts.questions, questionArtifact]
  ]);
  await markPhaseDone(requirement, workspace, PHASES.intake);
  await publishJsonArtifacts([[artifacts.requirement, requirement]]);

  return { status, workspace, artifacts };
}

function formatId(prefix, zeroBasedIndex) {
  return `${prefix}-${String(zeroBasedIndex + 1).padStart(3, "0")}`;
}

function resolveItemId(value, prefix, zeroBasedIndex) {
  const id = value ?? formatId(prefix, zeroBasedIndex);
  if (!new RegExp(`^${prefix}-\\d{3}$`).test(id)) {
    throw new Error(`${prefix} identity must use the ${prefix}-NNN format`);
  }
  return id;
}

function assertUniqueIds(ids, label) {
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    throw new Error(`${label} identities must be unique`);
  }
  return uniqueIds;
}

function resolveAffectedRuleId(value, ruleIds) {
  const ruleId =
    typeof value === "number" && Number.isInteger(value) && value > 0
      ? formatId("RULE", value - 1)
      : value;
  if (typeof ruleId !== "string" || !ruleIds.has(ruleId)) {
    throw new Error(`Question references unknown rule: ${String(value)}`);
  }
  return ruleId;
}

function hasBlockingImpact(impacts, questionIndex) {
  if (!Array.isArray(impacts) || impacts.length === 0) {
    throw new Error(`Question ${questionIndex + 1} requires at least one impact`);
  }
  for (const impact of impacts) {
    if (!KNOWN_IMPACTS.has(impact)) {
      throw new Error(`Unknown question impact: ${String(impact)}`);
    }
  }
  return impacts.some((impact) => BLOCKING_IMPACTS.has(impact));
}

function validateJobIdentity({ rawJob, workspaceRoot }) {
  if (!rawJob || typeof rawJob !== "object") {
    throw new Error("rawJob is required");
  }
  if (typeof workspaceRoot !== "string" || !workspaceRoot.trim()) {
    throw new Error("workspaceRoot is required");
  }
  if (!/^REQ-\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawJob.requirementId ?? "")) {
    throw new Error("requirementId must use the REQ-YYYYMMDD-slug format");
  }
  if (typeof rawJob.title !== "string" || !rawJob.title.trim()) {
    throw new Error("title is required");
  }
  if (typeof rawJob.description !== "string" || !rawJob.description.trim()) {
    throw new Error("description is required");
  }
}

function validateRawJobContract(rawJob) {
  validateOptionalArray(rawJob.sourceRefs, "sourceRefs").forEach((source, index) => {
    if (!SOURCE_TYPES.has(source?.type)) {
      throw new Error(`Unknown source type: ${String(source?.type)}`);
    }
    requireString(source.label, `sourceRefs[${index}].label`);
    if (source.pathOrUrl !== undefined && typeof source.pathOrUrl !== "string") {
      throw new Error(`sourceRefs[${index}].pathOrUrl must be a string`);
    }
  });

  validateOptionalArray(rawJob.confirmedRules, "confirmedRules").forEach((rule, index) => {
    requireString(rule?.text, `confirmedRules[${index}].text`);
    if (!RISK_AREAS.has(rule.riskArea)) {
      throw new Error(`Unknown riskArea: ${String(rule.riskArea)}`);
    }
    if (!PASS_FAIL_IMPACTS.has(rule.passFailImpact)) {
      throw new Error(`Unknown passFailImpact: ${String(rule.passFailImpact)}`);
    }
    if (rule.sourceRef !== undefined) {
      requireString(rule.sourceRef, `confirmedRules[${index}].sourceRef`);
    }
  });

  validateOptionalArray(rawJob.assumptions, "assumptions").forEach((assumption, index) => {
    requireString(assumption?.text, `assumptions[${index}].text`);
    requireString(assumption?.riskIfWrong, `assumptions[${index}].riskIfWrong`);
  });

  validateOptionalArray(rawJob.questions, "questions").forEach((question, index) => {
    requireString(question?.question, `questions[${index}].question`);
    requireString(question?.whyItMatters, `questions[${index}].whyItMatters`);
    if (!Array.isArray(question.impacts)) {
      throw new Error(`questions[${index}].impacts must be an array`);
    }
    if (question.affectedRules !== undefined && !Array.isArray(question.affectedRules)) {
      throw new Error(`questions[${index}].affectedRules must be an array`);
    }
    if (question.answer !== undefined && typeof question.answer !== "string") {
      throw new Error(`questions[${index}].answer must be a string`);
    }
  });

  if (rawJob.environment !== undefined) {
    if (!rawJob.environment || typeof rawJob.environment !== "object" || Array.isArray(rawJob.environment)) {
      throw new Error("environment must be an object");
    }
    if (Object.hasOwn(rawJob.environment, "backendUrl")) {
      throw new Error("environment.backendUrl is not supported; use managementBackendUrl");
    }
    const environmentStrings = [
      ["name", rawJob.environment.name],
      ["h5Url", rawJob.environment.h5Url],
      ["managementBackendUrl", rawJob.environment.managementBackendUrl],
      ["merchantScope", rawJob.environment.merchantScope]
    ];
    for (const [field, value] of environmentStrings) {
      if (value !== undefined && typeof value !== "string") {
        throw new Error(`environment.${field} must be a string`);
      }
    }
    const sessionState = rawJob.environment.knownSessionState;
    if (sessionState !== undefined && !SESSION_STATES.has(sessionState)) {
      throw new Error(`Unknown knownSessionState: ${String(sessionState)}`);
    }
  }

  validateBusinessSurface(rawJob.businessSurface);
  validateActors(rawJob.actors);
}

function validateOptionalArray(value, label) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
}

function validateBusinessSurface(businessSurface) {
  if (businessSurface === undefined) {
    return;
  }
  if (!businessSurface || typeof businessSurface !== "object" || Array.isArray(businessSurface)) {
    throw new Error("businessSurface must be an object");
  }
  if (Object.hasOwn(businessSurface, "backendPaths")) {
    throw new Error(
      "businessSurface.backendPaths is not supported; use managementBackendPaths"
    );
  }
  const arrayFields = [
    "productSurfaces",
    "modules",
    "h5Paths",
    "managementBackendPaths"
  ];
  for (const field of arrayFields) {
    if (businessSurface[field] !== undefined && !Array.isArray(businessSurface[field])) {
      throw new Error(`businessSurface.${field} must be an array`);
    }
  }
  for (const surface of businessSurface.productSurfaces ?? []) {
    if (!["h5_frontend", "management_backend"].includes(surface)) {
      throw new Error(`Unknown product surface: ${String(surface)}`);
    }
  }
  for (const field of ["modules", "h5Paths", "managementBackendPaths"]) {
    for (const value of businessSurface[field] ?? []) {
      requireString(value, `businessSurface.${field} item`);
    }
  }
}

function validateActors(actors) {
  if (actors === undefined) {
    return;
  }
  if (!actors || typeof actors !== "object" || Array.isArray(actors)) {
    throw new Error("actors must be an object");
  }
  if (Object.hasOwn(actors, "backendAccountRole")) {
    throw new Error(
      "actors.backendAccountRole is not supported; use managementBackendAccountRole"
    );
  }
  for (const field of ["member", "agent", "merchant", "managementBackendAccountRole"]) {
    if (actors[field] !== undefined && typeof actors[field] !== "string") {
      throw new Error(`actors.${field} must be a string`);
    }
  }
}

function normalizeBusinessSurface(businessSurface = {}) {
  return {
    product_surface: businessSurface.productSurfaces ?? [],
    modules: businessSurface.modules ?? [],
    h5_paths: businessSurface.h5Paths ?? [],
    backend_paths: businessSurface.managementBackendPaths ?? []
  };
}

function normalizeActors(actors = {}) {
  return {
    member: actors.member ?? "",
    agent: actors.agent ?? "",
    merchant: actors.merchant ?? "",
    backend_account_role: actors.managementBackendAccountRole ?? ""
  };
}

function normalizeSourceRefs(rawJob) {
  const intakeCapturedAt = normalizeTimestamp(rawJob.capturedAt ?? new Date().toISOString());
  const sources = (rawJob.sourceRefs ?? []).map((source, index) => {
    if (typeof source.label !== "string" || !source.label.trim()) {
      throw new Error(`sourceRefs[${index}].label is required`);
    }
    return {
      type: source.type,
      label: source.label,
      path_or_url: redactSensitiveUrl(source.pathOrUrl ?? ""),
      captured_at: normalizeTimestamp(source.capturedAt ?? intakeCapturedAt)
    };
  });

  if (!sources.some((source) => source.label === "requirement-text")) {
    sources.push({
      type: "text",
      label: "requirement-text",
      path_or_url: "",
      captured_at: intakeCapturedAt
    });
  }

  const labels = sources.map((source) => source.label);
  if (new Set(labels).size !== labels.length) {
    throw new Error("source reference labels must be unique");
  }
  return sources;
}

function resolveRuleSource(rule, sourceLabels) {
  const sourceRef = rule.sourceRef ?? "requirement-text";
  if (!sourceLabels.has(sourceRef)) {
    throw new Error(`Confirmed rule references unknown source: ${sourceRef}`);
  }
  return sourceRef;
}

function normalizeTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid capture timestamp: ${value}`);
  }
  return date.toISOString();
}

function validateQuestionAnswers(questions) {
  for (const [index, question] of questions.entries()) {
    const hasAnswer = typeof question.answer === "string" && question.answer.trim();
    if (!hasAnswer) {
      continue;
    }
    if (
      typeof question.answeredBy !== "string" ||
      !question.answeredBy.trim() ||
      !question.answeredAt
    ) {
      throw new Error(`Answered question ${index + 1} requires answeredBy and answeredAt`);
    }
    normalizeTimestamp(question.answeredAt);
  }
}

function assertNoSensitiveFields(value, parentPath = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveFields(item, [...parentPath, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const fieldPath = [...parentPath, key];
    if (isSensitiveKey(key) && child !== undefined && child !== null && child !== "") {
      throw new Error(`Raw job contains prohibited sensitive field: ${fieldPath.join(".")}`);
    }
    if (typeof child === "string" && !isUrlField(key) && containsSensitiveValue(child)) {
      throw new Error(`Raw job contains prohibited sensitive value: ${fieldPath.join(".")}`);
    }
    assertNoSensitiveFields(child, fieldPath);
  }
}

function isUrlField(key) {
  return ["pathorurl", "h5url", "managementbackendurl"].includes(
    key.toLowerCase().replace(/[^a-z0-9]/g, "")
  );
}

function isSensitiveKey(key) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    SENSITIVE_KEYS.has(normalized) ||
    /(credential|password|otp|captcha|cookie|authorization|jwt|bearer|token|recoverycode|apikey|secret|session(?:id|key|token))/.test(
      normalized
    )
  );
}

function containsSensitiveValue(value) {
  return (
    /\bbearer\s+[a-z0-9._~+/-]{6,}={0,2}\b/i.test(value) ||
    /\b(?:password|otp|token|cookie|recovery[ _-]?code)\s*[:=]\s*\S+/i.test(value) ||
    /\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+\b/i.test(value)
  );
}

function redactSensitiveUrl(value) {
  if (typeof value !== "string" || !/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    return value;
  }

  const url = new URL(value);
  if (url.username) {
    url.username = "REDACTED";
  }
  if (url.password) {
    url.password = "REDACTED";
  }
  for (const key of [...url.searchParams.keys()]) {
    if (isSensitiveKey(key)) {
      url.searchParams.set(key, "REDACTED");
    }
  }
  return url.toString();
}

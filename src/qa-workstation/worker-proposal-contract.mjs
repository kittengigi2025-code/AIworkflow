import { createHash, randomUUID } from "node:crypto";
import { open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const MAIN_AGENT = "main_agent";
const ROLES = new Set([
  "requirement_extractor",
  "question_gatekeeper",
  "test_designer",
  "bug_writer",
  "ledger_keeper",
  "retrospective_writer"
]);
const CONTRIBUTION_TYPES = new Set([
  "requirement_fact_candidate",
  "blocking_question_candidate",
  "test_case_candidate",
  "bug_draft",
  "ledger_entry_candidate",
  "retrospective_candidate"
]);
const CONFIDENCE = new Set(["confirmed", "probable", "weak"]);
const ROLE_INPUTS = {
  requirement_extractor: new Set(["requirement.json", "questions.json"]),
  question_gatekeeper: new Set(["requirement.json", "questions.json"]),
  test_designer: new Set(["requirement.json", "questions.json", "strategy.json"]),
  bug_writer: new Set([
    "requirement.json",
    "test-cases.json",
    "execution-results.json",
    "evidence-manifest.json"
  ]),
  ledger_keeper: new Set(["requirement.json", "execution-results.json", "bugs.json"]),
  retrospective_writer: new Set([
    "requirement.json",
    "execution-results.json",
    "evidence-manifest.json",
    "bugs.json"
  ])
};
const SECRET_KEY = /password|passwd|credential|authorization|access.?token|refresh.?token|cookie|set.?cookie|otp|captcha|recovery.?code|session|jwt|api.?key|client.?secret|private.?key|secret/i;
const SECRET_VALUE = /\b(?:bearer|basic)\s+[a-z0-9._~+\/-]+=*|\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|https?:\/\/[^\s/:]+:[^\s/@]+@/i;
const FORBIDDEN_AUTHORITY_KEY = /browser|session|execute|execution|publish|status|owner|decision|authoritative|artifact.?patch|credential/i;
const FORBIDDEN_AUTHORITY_VALUE = /\b(?:execute|publish|control(?:\s+the)?\s+browser|assign(?:\s+the)?\s+(?:final\s+)?status|final\s+decision|edit\s+authoritative|save|submit|approve|reject|delete|export|upload)\b/i;
const OPAQUE_SECRET_VALUE = /^(?=.{24,}$)(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9+/_=-]+$/;
const PAYLOAD_SCHEMAS = {
  requirement_fact_candidate: ["fact", "sourceText"],
  blocking_question_candidate: ["question", "whyItMatters", "sourceText"],
  test_case_candidate: ["operation", "assertion", "sourceText"],
  bug_draft: ["title", "expected", "actual", "sourceText"],
  ledger_entry_candidate: ["summary", "sourceText"],
  retrospective_candidate: ["finding", "recommendedUpdate", "sourceText"]
};

export async function reviewWorkerProposals({ workspace, assignments, proposals }) {
  assertArray(assignments, "assignments");
  assertArray(proposals, "proposals");
  if (assignments.length === 0 && proposals.length === 0) {
    return { status: "no_workers", accepted: 0, rejected: 0, workspace };
  }
  const lock = await acquireReviewLock(workspace);
  try {
    return await reviewWorkerProposalsLocked({ workspace, assignments, proposals });
  } finally {
    await releaseReviewLock(lock);
  }
}

async function reviewWorkerProposalsLocked({ workspace, assignments, proposals }) {

  const requirementPath = path.join(workspace, "requirement.json");
  const questionsPath = path.join(workspace, "questions.json");
  const requirement = await readJson(requirementPath);
  const questions = await readJson(questionsPath);
  const reviewPath = path.join(workspace, "worker-proposal-review.json");
  const contributionsPath = path.join(workspace, "worker-contributions.json");
  const priorReview = await readJsonIfExists(reviewPath);
  const priorContributions = await readJsonIfExists(contributionsPath);
  const knownRuleIds = new Set(requirement.confirmed_rules.map((rule) => rule.rule_id));
  validatePriorWorkerArtifacts(
    requirement.requirement_id,
    priorReview,
    priorContributions,
    knownRuleIds
  );
  const previousReviews = priorReview?.reviews ?? [];
  const previousContributions = priorContributions?.accepted_contributions ?? [];
  const assignmentMap = new Map();
  const snapshots = new Map();

  for (const assignment of assignments) {
    await validateAssignment({ workspace, assignment, knownRuleIds, snapshots, previousReviews });
    if (assignmentMap.has(assignment.assignmentId)) {
      throw new Error(`Duplicate worker assignment ${assignment.assignmentId}`);
    }
    assignmentMap.set(assignment.assignmentId, assignment);
  }
  validateParallelIsolation(assignments);

  const proposalIds = new Set(previousReviews.map((review) => review.proposal_id));
  const reviews = [];
  const candidates = [];
  for (const proposal of proposals) {
    const proposalId = proposal?.proposalId ?? "unknown";
    if (proposalIds.has(proposalId)) throw new Error(`Duplicate worker proposal ${proposalId}`);
    proposalIds.add(proposalId);
    const assignment = assignmentMap.get(proposal?.assignmentId);
    const reasons = await validateProposal({ assignment, proposal, knownRuleIds, snapshots });
    if (reasons.length > 0) {
      reviews.push(reviewRecord(assignment, proposal, "rejected", reasons));
      continue;
    }
    candidates.push({ assignment, proposal });
  }

  const conflicts = findConflicts(candidates, previousContributions);
  const conflictedProposalIds = new Set(conflicts.flatMap((conflict) => conflict.proposalIds));
  for (const candidate of candidates) {
    if (conflictedProposalIds.has(candidate.proposal.proposalId)) {
      reviews.push(
        reviewRecord(candidate.assignment, candidate.proposal, "waiting_for_confirmation", [
          "Conflicting source interpretations require authoritative clarification"
        ])
      );
    } else {
      reviews.push(reviewRecord(candidate.assignment, candidate.proposal, "accepted", []));
    }
  }

  const acceptedCandidates = candidates.filter(
    (candidate) => !conflictedProposalIds.has(candidate.proposal.proposalId)
  );
  const acceptedContributions = [];
  for (const candidate of acceptedCandidates) {
    for (const contribution of candidate.proposal.contributions) {
      acceptedContributions.push({
        contribution_id: formatId("WC", previousContributions.length + acceptedContributions.length),
        type: contribution.type,
        rule_ids: contribution.ruleIds,
        conflict_key: derivedConflictKey(contribution),
        decision_topic: contribution.decisionTopic,
        summary: contribution.summary,
        payload: contribution.payload,
        merged_by: MAIN_AGENT,
        provenance: {
          assignment_id: candidate.assignment.assignmentId,
          proposal_id: candidate.proposal.proposalId,
          input_revisions: candidate.proposal.inputRevisions,
          evidence_refs: candidate.proposal.evidenceRefs.filter((evidence) =>
            contribution.evidenceRefIds.includes(evidence.evidenceId)
          ),
          proposal_fingerprint: proposalFingerprint(candidate.proposal),
          confidence: candidate.proposal.confidence,
          do_not_generalize: candidate.proposal.doNotGeneralize,
          completed_at: candidate.proposal.completedAt
        }
      });
    }
  }

  const artifacts = { review: reviewPath };
  const reviewArtifact = {
    requirement_id: requirement.requirement_id,
    reviewed_by: MAIN_AGENT,
    reviewed_at: new Date().toISOString(),
    reviews: [...previousReviews, ...reviews]
  };
  const entries = [[artifacts.review, reviewArtifact]];

  if (acceptedContributions.length > 0) {
    artifacts.contributions = contributionsPath;
    entries.push([
      artifacts.contributions,
      {
        requirement_id: requirement.requirement_id,
        authoritative_owner: MAIN_AGENT,
        accepted_contributions: [...previousContributions, ...acceptedContributions]
      }
    ]);
  } else if (priorContributions) {
    artifacts.contributions = contributionsPath;
  }

  if (conflicts.length > 0) {
    appendConflictQuestions(questions, conflicts);
    requirement.status = "waiting_for_confirmation";
    entries.push([questionsPath, questions], [requirementPath, requirement]);
  }
  await revalidateSnapshots(workspace, snapshots);
  await publishJsonArtifacts(entries);

  const accepted = acceptedCandidates.length;
  const rejected = reviews.filter((review) => review.decision === "rejected").length;
  const status = conflicts.length > 0
    ? "waiting_for_confirmation"
    : accepted > 0
      ? "accepted"
      : "rejected";
  return { status, accepted, rejected, workspace, artifacts };
}

async function validateAssignment({ workspace, assignment, knownRuleIds, snapshots, previousReviews }) {
  assertObject(assignment, "assignment");
  assertId(assignment.assignmentId, /^WA-\d{3}$/, "assignmentId");
  assertEnum(assignment.role, ROLES, "assignment.role");
  assertObject(assignment.scope, "assignment.scope");
  assertStringArray(assignment.scope.contributionTypes, "assignment.scope.contributionTypes", false);
  assertStringArray(assignment.scope.ruleIds, "assignment.scope.ruleIds", false);
  assertStringArray(assignment.scope.decisionTopics, "assignment.scope.decisionTopics", false);
  assertString(assignment.scope.outputScope, "assignment.scope.outputScope");
  for (const type of assignment.scope.contributionTypes) {
    assertEnum(type, CONTRIBUTION_TYPES, "assignment.scope.contributionTypes");
  }
  for (const ruleId of assignment.scope.ruleIds) {
    if (!knownRuleIds.has(ruleId)) throw new Error(`Assignment references unknown rule ${ruleId}`);
  }
  assertString(assignment.parallelGroup, "assignment.parallelGroup");
  assertArray(assignment.inputRevisions, "assignment.inputRevisions", false);
  assertArray(assignment.minimumData, "assignment.minimumData", false);
  rejectSecrets(assignment, "assignment");

  const fingerprint = assignmentFingerprint(assignment);
  const historical = previousReviews.find((review) => review.assignment_id === assignment.assignmentId);
  if (historical && historical.assignment_fingerprint !== fingerprint) {
    throw new Error(`Worker assignment ${assignment.assignmentId} was reused with a different immutable definition`);
  }

  const allowedInputs = ROLE_INPUTS[assignment.role];
  const revisions = new Map();
  for (const [index, revision] of assignment.inputRevisions.entries()) {
    assertObject(revision, `assignment.inputRevisions[${index}]`);
    assertArtifactName(revision.artifact);
    if (!allowedInputs.has(revision.artifact)) {
      throw new Error(`${assignment.role} received more than its minimum necessary data: ${revision.artifact}`);
    }
    assertSha(revision.sha256, `assignment.inputRevisions[${index}].sha256`);
    if (revisions.has(revision.artifact)) throw new Error(`Duplicate input revision ${revision.artifact}`);
    const bytes = await readFile(path.join(workspace, revision.artifact));
    const actual = hashBytes(bytes);
    revisions.set(revision.artifact, revision.sha256);
    if (actual !== revision.sha256) throw new Error(`Worker assignment ${assignment.assignmentId} has stale input ${revision.artifact}`);
    const existing = snapshots.get(revision.artifact);
    if (existing && existing.sha256 !== revision.sha256) {
      throw new Error(`Assignments disagree on immutable revision ${revision.artifact}`);
    }
    snapshots.set(revision.artifact, {
      sha256: revision.sha256,
      json: JSON.parse(bytes.toString("utf8"))
    });
  }
  for (const [index, item] of assignment.minimumData.entries()) {
    assertObject(item, `assignment.minimumData[${index}]`);
    assertArtifactName(item.artifact);
    if (!revisions.has(item.artifact)) {
      throw new Error(`Minimum data ${item.artifact} has no immutable input revision`);
    }
    assertStringArray(item.jsonPointers, `assignment.minimumData[${index}].jsonPointers`, false);
    const source = snapshots.get(item.artifact).json;
    for (const pointer of item.jsonPointers) {
      if (resolveJsonPointer(source, pointer) === undefined) {
        throw new Error(`Minimum data pointer ${item.artifact}${pointer} does not exist`);
      }
    }
  }
}

function validateParallelIsolation(assignments) {
  for (let left = 0; left < assignments.length; left += 1) {
    for (let right = left + 1; right < assignments.length; right += 1) {
      if (
        assignments[left].parallelGroup === assignments[right].parallelGroup &&
        intersects(assignments[left].scope.contributionTypes, assignments[right].scope.contributionTypes) &&
        intersects(assignments[left].scope.ruleIds, assignments[right].scope.ruleIds) &&
        intersects(assignments[left].scope.decisionTopics, assignments[right].scope.decisionTopics)
      ) {
        throw new Error("Parallel assignments must declare isolated output scopes");
      }
    }
  }
}

async function validateProposal({ assignment, proposal, knownRuleIds, snapshots }) {
  const reasons = [];
  try {
    assertObject(proposal, "proposal");
    assertId(proposal.proposalId, /^WP-\d{3}$/, "proposalId");
    if (!assignment) throw new Error(`Unknown assignment ${proposal.assignmentId}`);
    rejectSecrets(proposal, "proposal");
    assertArray(proposal.authorityClaims, "proposal.authorityClaims");
    if (proposal.authorityClaims.length > 0) {
      throw new Error("Worker proposal claims execution or final-decision authority");
    }
    assertArray(proposal.inputRevisions, "proposal.inputRevisions", false);
    if (canonical(proposal.inputRevisions) !== canonical(assignment.inputRevisions)) {
      throw new Error("Worker proposal is based on stale or different input revisions");
    }
    for (const revision of proposal.inputRevisions) {
      if (snapshots.get(revision.artifact)?.sha256 !== revision.sha256) {
        throw new Error(`Worker proposal input ${revision.artifact} is stale`);
      }
    }
    assertArray(proposal.contributions, "proposal.contributions", false);
    for (const [index, contribution] of proposal.contributions.entries()) {
      assertObject(contribution, `proposal.contributions[${index}]`);
      if (!assignment.scope.contributionTypes.includes(contribution.type)) {
        throw new Error(`Contribution type ${contribution.type} exceeds assignment scope`);
      }
      if (!assignment.scope.decisionTopics.includes(contribution.decisionTopic)) {
        throw new Error(`Contribution decision topic ${contribution.decisionTopic} exceeds assignment scope`);
      }
      assertStringArray(
        contribution.evidenceRefIds,
        `proposal.contributions[${index}].evidenceRefIds`,
        false
      );
      assertStringArray(contribution.ruleIds, `proposal.contributions[${index}].ruleIds`, false);
      for (const ruleId of contribution.ruleIds) {
        if (!knownRuleIds.has(ruleId) || !assignment.scope.ruleIds.includes(ruleId)) {
          throw new Error(`Contribution rule ${ruleId} exceeds assignment scope`);
        }
      }
      assertString(contribution.summary, `proposal.contributions[${index}].summary`);
      assertObject(contribution.payload, `proposal.contributions[${index}].payload`);
      rejectAuthorityPayload(contribution.payload, `proposal.contributions[${index}].payload`);
      validateContributionPayload(contribution.type, contribution.payload);
    }
    assertArray(proposal.evidenceRefs, "proposal.evidenceRefs", false);
    const evidenceById = new Map();
    for (const [index, evidence] of proposal.evidenceRefs.entries()) {
      assertObject(evidence, `proposal.evidenceRefs[${index}]`);
      assertId(evidence.evidenceId, /^SRC-\d{3}$/, `proposal.evidenceRefs[${index}].evidenceId`);
      if (evidenceById.has(evidence.evidenceId)) throw new Error(`Duplicate evidence reference ${evidence.evidenceId}`);
      assertArtifactName(evidence.artifact);
      const revision = assignment.inputRevisions.find((item) => item.artifact === evidence.artifact);
      if (!revision || revision.sha256 !== evidence.sha256) {
        throw new Error(`Evidence ${evidence.artifact} is not tied to an assigned input revision`);
      }
      const minimum = assignment.minimumData.find((item) => item.artifact === evidence.artifact);
      if (!minimum || !minimum.jsonPointers.some((pointer) => pointerContains(pointer, evidence.jsonPointer))) {
        throw new Error(`Evidence ${evidence.artifact}${evidence.jsonPointer} exceeds assigned minimum data`);
      }
      const source = snapshots.get(evidence.artifact).json;
      const resolved = resolveJsonPointer(source, evidence.jsonPointer);
      if (resolved === undefined) {
        throw new Error(`Evidence pointer ${evidence.artifact}${evidence.jsonPointer} does not exist`);
      }
      evidenceById.set(evidence.evidenceId, { ...evidence, resolved });
    }
    for (const [index, contribution] of proposal.contributions.entries()) {
      const linked = contribution.evidenceRefIds.map((id) => evidenceById.get(id));
      if (linked.some((item) => !item)) {
        throw new Error(`Contribution ${index} references unknown evidence`);
      }
      for (const ruleId of contribution.ruleIds) {
        if (!linked.some((item) => containsRuleId(item.resolved, ruleId))) {
          throw new Error(`Contribution evidence does not support rule ${ruleId}`);
        }
      }
      if (!linked.some((item) => canonical(item.resolved).includes(contribution.payload.sourceText))) {
        throw new Error(`Contribution sourceText is not present in its linked evidence`);
      }
    }
    assertStringArray(proposal.openQuestions, "proposal.openQuestions");
    assertEnum(proposal.confidence, CONFIDENCE, "proposal.confidence");
    assertStringArray(proposal.doNotGeneralize, "proposal.doNotGeneralize");
    assertIsoDate(proposal.completedAt, "proposal.completedAt");
    rejectOpaqueText([
      ...proposal.openQuestions,
      ...proposal.doNotGeneralize,
      ...proposal.contributions.flatMap((item) => [item.summary, ...Object.values(item.payload)])
    ]);
  } catch (error) {
    reasons.push(error.message);
  }
  return reasons;
}

function findConflicts(candidates, previousContributions) {
  const grouped = new Map();
  for (const contribution of previousContributions) {
    const group = grouped.get(contribution.conflict_key) ?? [];
    group.push({ historical: true, contribution });
    grouped.set(contribution.conflict_key, group);
  }
  for (const candidate of candidates) {
    for (const contribution of candidate.proposal.contributions) {
      const conflictKey = derivedConflictKey(contribution);
      const group = grouped.get(conflictKey) ?? [];
      group.push({ candidate, contribution });
      grouped.set(conflictKey, group);
    }
  }
  const conflicts = [];
  for (const [conflictKey, group] of grouped) {
    const meanings = new Set(group.map((item) => canonical({
      summary: item.contribution.summary,
      payload: item.contribution.payload
    })));
    if (meanings.size > 1) {
      conflicts.push({
        conflictKey,
        proposalIds: unique(
          group.filter((item) => !item.historical).map((item) => item.candidate.proposal.proposalId)
        ),
        ruleIds: unique(group.flatMap((item) => item.contribution.ruleIds ?? item.contribution.rule_ids)),
        summaries: group.map((item) => item.contribution.summary)
      });
    }
  }
  return conflicts;
}

function derivedConflictKey(contribution) {
  return `${contribution.type}:${[...contribution.ruleIds].sort().join(",")}:${contribution.decisionTopic}`;
}

function appendConflictQuestions(questions, conflicts) {
  for (const conflict of conflicts) {
    questions.questions.push({
      question_id: formatId("Q", questions.questions.length),
      classification: "blocking",
      question: `Which interpretation is authoritative for ${conflict.conflictKey}: ${conflict.summaries.join(" OR ")}?`,
      why_it_matters: "Conflicting worker proposals would change test design or pass/fail judgment.",
      affected_rules: conflict.ruleIds,
      default_if_unanswered: "blocked",
      answer: "",
      answered_by: "",
      answered_at: ""
    });
  }
}

function reviewRecord(assignment, proposal, decision, reasons) {
  return {
    assignment_id: assignment?.assignmentId ?? proposal?.assignmentId ?? "unknown",
    proposal_id: proposal?.proposalId ?? "unknown",
    decision,
    reasons,
    input_revisions: proposal?.inputRevisions ?? [],
    assignment_role: assignment?.role ?? "unknown",
    assignment_scope: assignment?.scope ?? {},
    assignment_fingerprint: assignment ? assignmentFingerprint(assignment) : "",
    proposal_fingerprint: proposal ? proposalFingerprint(proposal) : "",
    proposal_confidence: proposal?.confidence ?? "",
    proposal_do_not_generalize: proposal?.doNotGeneralize ?? [],
    proposal_completed_at: proposal?.completedAt ?? "",
    reviewed_by: MAIN_AGENT
  };
}

function proposalFingerprint(proposal) {
  return createHash("sha256")
    .update(
      canonical({
        proposalId: proposal.proposalId,
        assignmentId: proposal.assignmentId,
        inputRevisions: proposal.inputRevisions,
        contributions: proposal.contributions,
        evidenceRefs: proposal.evidenceRefs,
        openQuestions: proposal.openQuestions,
        confidence: proposal.confidence,
        doNotGeneralize: proposal.doNotGeneralize,
        completedAt: proposal.completedAt,
        authorityClaims: proposal.authorityClaims
      })
    )
    .digest("hex");
}

function assignmentFingerprint(assignment) {
  return createHash("sha256")
    .update(
      canonical({
        assignmentId: assignment.assignmentId,
        role: assignment.role,
        scope: assignment.scope,
        inputRevisions: assignment.inputRevisions,
        minimumData: assignment.minimumData,
        parallelGroup: assignment.parallelGroup
      })
    )
    .digest("hex");
}

function validatePriorWorkerArtifacts(requirementId, review, contributions, knownRuleIds) {
  if (review && (review.requirement_id !== requirementId || !Array.isArray(review.reviews))) {
    throw new Error("Existing worker review history does not match the current requirement");
  }
  if (
    contributions &&
    (contributions.requirement_id !== requirementId ||
      contributions.authoritative_owner !== MAIN_AGENT ||
      !Array.isArray(contributions.accepted_contributions))
  ) {
    throw new Error("Existing worker contribution history is not authoritative for this requirement");
  }
  const reviews = review?.reviews ?? [];
  const reviewProposalIds = new Set();
  for (const item of reviews) {
    assertObject(item, "existing worker review");
    assertId(item.assignment_id, /^WA-\d{3}$/, "existing assignment_id");
    assertId(item.proposal_id, /^WP-\d{3}$/, "existing proposal_id");
    if (reviewProposalIds.has(item.proposal_id)) {
      throw new Error("Existing worker review history contains duplicate proposals");
    }
    reviewProposalIds.add(item.proposal_id);
    if (item.reviewed_by !== MAIN_AGENT || !["accepted", "rejected", "waiting_for_confirmation"].includes(item.decision)) {
      throw new Error("Existing worker review history has invalid authority or decision");
    }
    assertSha(item.assignment_fingerprint, "existing assignment_fingerprint");
    assertSha(item.proposal_fingerprint, "existing proposal_fingerprint");
  }
  const contributionIds = new Set();
  const historicalMeaning = new Map();
  for (const contribution of contributions?.accepted_contributions ?? []) {
    assertObject(contribution, "existing worker contribution");
    assertId(contribution.contribution_id, /^WC-\d{3}$/, "existing contribution_id");
    if (contributionIds.has(contribution.contribution_id)) {
      throw new Error("Existing worker contribution history contains duplicate IDs");
    }
    contributionIds.add(contribution.contribution_id);
    assertEnum(contribution.type, CONTRIBUTION_TYPES, "existing contribution type");
    assertStringArray(contribution.rule_ids, "existing contribution rule_ids", false);
    for (const ruleId of contribution.rule_ids) {
      if (!knownRuleIds.has(ruleId)) throw new Error("Existing worker contribution references an unknown rule");
    }
    assertString(contribution.decision_topic, "existing contribution decision_topic");
    assertString(contribution.summary, "existing contribution summary");
    assertObject(contribution.payload, "existing contribution payload");
    rejectSecrets(contribution, "existing worker contribution");
    rejectAuthorityPayload(contribution.payload, "existing worker contribution payload");
    validateContributionPayload(contribution.type, contribution.payload);
    if (contribution.merged_by !== MAIN_AGENT) {
      throw new Error("Existing worker contribution was not merged by main_agent");
    }
    assertObject(contribution.provenance, "existing contribution provenance");
    const acceptedReview = reviews.find(
      (item) =>
        item.proposal_id === contribution.provenance.proposal_id &&
        item.assignment_id === contribution.provenance.assignment_id &&
        item.decision === "accepted"
    );
    if (!acceptedReview) throw new Error("Existing worker contribution has no accepted review provenance");
    if (
      contribution.provenance.proposal_fingerprint !== acceptedReview.proposal_fingerprint ||
      canonical(contribution.provenance.input_revisions) !== canonical(acceptedReview.input_revisions) ||
      contribution.provenance.confidence !== acceptedReview.proposal_confidence ||
      canonical(contribution.provenance.do_not_generalize) !==
        canonical(acceptedReview.proposal_do_not_generalize) ||
      contribution.provenance.completed_at !== acceptedReview.proposal_completed_at
    ) {
      throw new Error("Existing worker contribution has forged proposal provenance");
    }
    const expectedKey = derivedConflictKey({
      type: contribution.type,
      ruleIds: contribution.rule_ids,
      decisionTopic: contribution.decision_topic
    });
    if (contribution.conflict_key !== expectedKey) {
      throw new Error("Existing worker contribution has a forged conflict key");
    }
    const meaning = canonical({ summary: contribution.summary, payload: contribution.payload });
    if (historicalMeaning.has(expectedKey) && historicalMeaning.get(expectedKey) !== meaning) {
      throw new Error("Existing worker contribution history contains unresolved conflicts");
    }
    historicalMeaning.set(expectedKey, meaning);
  }
}

function resolveJsonPointer(value, pointer) {
  if (pointer === "") return value;
  if (typeof pointer !== "string" || !pointer.startsWith("/")) return undefined;
  const tokens = pointer
    .slice(1)
    .split("/")
    .map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
  let current = value;
  for (const token of tokens) {
    if (
      current === null ||
      (typeof current !== "object" && !Array.isArray(current)) ||
      !Object.prototype.hasOwnProperty.call(current, token)
    ) {
      return undefined;
    }
    current = current[token];
  }
  return current;
}

function pointerContains(allowedPointer, candidatePointer) {
  return candidatePointer === allowedPointer || candidatePointer.startsWith(`${allowedPointer}/`);
}

function containsRuleId(value, ruleId) {
  if (value === ruleId) return true;
  if (Array.isArray(value)) return value.some((item) => containsRuleId(item, ruleId));
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsRuleId(item, ruleId));
  }
  return false;
}

function rejectSecrets(value, label, key = "") {
  if (SECRET_KEY.test(key)) throw new Error(`${label} contains forbidden secret field ${key}`);
  if (typeof value === "string" && SECRET_VALUE.test(value)) {
    throw new Error(`${label} contains credential-like secret material`);
  }
  if (Array.isArray(value)) {
    value.forEach((item) => rejectSecrets(item, label));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([childKey, child]) => rejectSecrets(child, label, childKey));
  }
}

function rejectAuthorityPayload(value, label, key = "") {
  if (FORBIDDEN_AUTHORITY_KEY.test(key)) {
    throw new Error(`${label} contains forbidden worker authority field ${key}`);
  }
  if (typeof value === "string" && FORBIDDEN_AUTHORITY_VALUE.test(value)) {
    throw new Error(`${label} contains forbidden worker authority value`);
  }
  if (Array.isArray(value)) {
    value.forEach((item) => rejectAuthorityPayload(item, label));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([childKey, child]) =>
      rejectAuthorityPayload(child, label, childKey)
    );
  }
}

function validateContributionPayload(type, payload) {
  const allowed = PAYLOAD_SCHEMAS[type];
  const keys = Object.keys(payload);
  const unexpected = keys.filter((key) => !allowed.includes(key));
  const missing = allowed.filter((key) => !Object.prototype.hasOwnProperty.call(payload, key));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `Contribution payload for ${type} must contain only: ${allowed.join(", ")}`
    );
  }
  for (const key of allowed) assertString(payload[key], `contribution.payload.${key}`);
  if (
    type === "test_case_candidate" &&
    !["navigate", "filter", "open_detail", "read_visible"].includes(payload.operation)
  ) {
    throw new Error(`Test-case candidate operation ${payload.operation} is not read only`);
  }
}

function rejectOpaqueText(values) {
  for (const value of values) {
    if (typeof value === "string" && OPAQUE_SECRET_VALUE.test(value)) {
      throw new Error("Worker proposal contains opaque credential-like material");
    }
  }
}

function assertArtifactName(value) {
  assertString(value, "artifact");
  if (path.basename(value) !== value || !value.endsWith(".json")) {
    throw new Error(`Artifact ${value} must be a workspace JSON filename`);
  }
}

function assertSha(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a SHA-256 digest`);
  }
}

function assertIsoDate(value, label) {
  assertString(value, label);
  if (Number.isNaN(Date.parse(value))) throw new Error(`${label} must be ISO-8601`);
}

function assertId(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(`${label} is invalid`);
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
  value.forEach((item) => assertString(item, label));
}

function assertEnum(value, allowed, label) {
  if (!allowed.has(value)) throw new Error(`${label} has invalid value ${String(value)}`);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function unique(values) {
  return [...new Set(values)];
}

function intersects(left, right) {
  const rightSet = new Set(right);
  return left.some((item) => rightSet.has(item));
}

function formatId(prefix, zeroBasedIndex) {
  return `${prefix}-${String(zeroBasedIndex + 1).padStart(3, "0")}`;
}

async function hashFile(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function revalidateSnapshots(workspace, snapshots) {
  for (const [artifact, snapshot] of snapshots) {
    const current = await hashFile(path.join(workspace, artifact));
    if (current !== snapshot.sha256) {
      throw new Error(`Immutable input ${artifact} changed during worker proposal review`);
    }
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function publishJsonArtifacts(entries) {
  const prepared = entries.map(([filePath, value]) => ({
    filePath,
    tempPath: `${filePath}.${randomUUID()}.tmp`,
    contents: `${JSON.stringify(value, null, 2)}\n`
  }));
  try {
    await Promise.all(prepared.map((item) => writeFile(item.tempPath, item.contents, "utf8")));
    for (const item of prepared) await rename(item.tempPath, item.filePath);
  } finally {
    await Promise.all(prepared.map((item) => rm(item.tempPath, { force: true }).catch(() => undefined)));
  }
}

async function acquireReviewLock(workspace) {
  const lockPath = path.join(workspace, ".worker-proposal-review.lock");
  try {
    const handle = await open(lockPath, "wx");
    const acquiredAt = new Date();
    await handle.writeFile(
      `${JSON.stringify({
        owner: MAIN_AGENT,
        lease_id: randomUUID(),
        acquired_at: acquiredAt.toISOString(),
        expires_at: new Date(acquiredAt.getTime() + 5 * 60_000).toISOString()
      })}\n`,
      "utf8"
    );
    return { handle, lockPath };
  } catch (error) {
    if (error.code === "EEXIST") {
      const existing = await readJsonIfExists(lockPath).catch(() => null);
      if (existing?.expires_at && Date.parse(existing.expires_at) <= Date.now()) {
        await rm(lockPath, { force: true });
        return acquireReviewLock(workspace);
      }
      throw new Error("Worker proposal review is already active for this workspace");
    }
    throw error;
  }
}

async function releaseReviewLock({ handle, lockPath }) {
  await handle.close().catch(() => undefined);
  await rm(lockPath, { force: true });
}

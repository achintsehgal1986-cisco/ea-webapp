import { PLAYBOOK_DOC_SECTIONS } from "./playbook-doc";
import { PLAYBOOK_STEPS } from "./playbook";
import { detailId } from "./progress";
import type { UserRole } from "./session";
import type { PlaybookStep } from "./types";

export type AssistantAction = {
  type: "markStepComplete";
  stepId: string;
};

export type AssistantContext = {
  completedIds: Set<string>;
  lastStepId?: string;
  userRole?: UserRole;
  customerName?: string;
  lastAnswer?: string;
  discussedDetailIds?: string[];
};

export type AssistantResponse = {
  answer: string;
  found: boolean;
  actions?: AssistantAction[];
  lastStepId?: string;
  discussedDetailIds?: string[];
};

type KnowledgeChunk = {
  id: string;
  stepTitle: string;
  text: string;
  keywords: string;
};

const SYNONYMS: Record<string, string[]> = {
  ea: ["enterprise agreement", "playbook"],
  target: ["targets", "identifying", "opportunity", "opportunities", "prospect"],
  presales: ["pre-sales", "presale", "before sale", "selling"],
  postsales: ["post-sales", "postsale", "after sale", "lifecycle"],
  renewal: ["renewals", "renew", "expire", "expiring"],
  install: ["install base", "ib", "cisco ib", "footprint", "architecture"],
  ready: ["cisco ready", "rewarddash"],
  ccw: ["ccw-r", "ccwr", "contracts"],
  impending: ["events", "triggers", "timing", "upcoming"],
  proposal: ["proposals", "pre-work", "prework", "tco", "discount", "quote"],
  partner: ["partners", "reseller", "roles", "responsibilities"],
  onboard: ["onboarding", "provisioning", "provision", "pas"],
  forward: ["true forward", "tf", "billing", "growth", "egtf", "exceptional"],
  budget: ["budgeting", "invoice", "forecast"],
  health: ["health check", "healthcheck", "activation", "deployed"],
  modify: ["modification", "change", "wifi", "technology"],
  milestone: ["milestones", "dates", "timeline", "anniversary"],
  am: ["account manager", "account managers", "account executive", "ae"],
  se: ["sales engineer", "sales engineers", "specialist", "technical"],
  workspace: ["smart account", "smart accounts", "virtual account", "ea workspace"],
  technical: [
    "architecture",
    "architectures",
    "sizing",
    "design",
    "demo",
    "poc",
    "validation",
    "portfolio se",
    "specialist se",
    "environment",
    "deployment",
  ],
};

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "was",
  "one", "our", "how", "what", "when", "where", "which", "with", "would",
  "could", "should", "about", "tell", "explain", "describe", "help", "please",
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function stripConversationalNoise(query: string): string {
  return normalize(query)
    .replace(/\b(as an?|i'?m an?|for|from the perspective of)\s+(se|sales engineer|ae|am|account executive)\b/gi, " ")
    .replace(/\b(can you|could you|please|tell me|help me|i need to know|what is|what are|how do i|how should i)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickVariant(seed: string, options: string[]): string {
  if (options.length === 0) return "";
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash + seed.charCodeAt(index) * (index + 1)) | 0;
  }
  return options[Math.abs(hash) % options.length];
}

function hasTechnicalIntent(query: string): boolean {
  return /\b(technical|architecture|install base|workspace|smart account|provision|health check|portfolio|environment|deploy|sizing|design|demo|poc)\b/i.test(
    query,
  );
}

function expandQuery(query: string): string[] {
  const normalized = normalize(query);
  const terms = new Set<string>([normalized]);
  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);

  for (const word of words) {
    terms.add(word);
    for (const [key, values] of Object.entries(SYNONYMS)) {
      if (word === key || values.some((value) => normalized.includes(value))) {
        terms.add(key);
        values.forEach((value) => terms.add(value));
      }
    }
  }

  for (const [key, values] of Object.entries(SYNONYMS)) {
    if (values.some((value) => normalized.includes(value))) {
      terms.add(key);
    }
  }

  return [...terms];
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function buildKnowledgeBase(): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];

  for (const step of PLAYBOOK_STEPS) {
    const baseKeywords = [
      step.title,
      step.section,
      step.phase,
      step.owner,
      step.summary,
      step.audience ?? "",
      ...step.details,
    ].join(" ");

    chunks.push({
      id: `${step.id}-summary`,
      stepTitle: step.title,
      text: step.summary,
      keywords: baseKeywords,
    });

    if (step.audience) {
      chunks.push({
        id: `${step.id}-audience`,
        stepTitle: step.title,
        text: step.audience,
        keywords: baseKeywords,
      });
    }

    step.details.forEach((detail, index) => {
      chunks.push({
        id: `${step.id}-detail-${index}`,
        stepTitle: step.title,
        text: detail,
        keywords: `${baseKeywords} ${detail}`,
      });
    });
  }

  for (const section of PLAYBOOK_DOC_SECTIONS) {
    if (!section.body) continue;
    chunks.push({
      id: `doc-${section.id}`,
      stepTitle: section.heading,
      text: section.body,
      keywords: `${section.heading} ${section.body}`,
    });
  }

  return chunks;
}

const KNOWLEDGE_BASE = buildKnowledgeBase();

function scoreChunk(
  chunk: KnowledgeChunk,
  query: string,
  queryTerms: string[],
  userRole?: UserRole,
): number {
  const haystack = normalize(`${chunk.stepTitle} ${chunk.text} ${chunk.keywords}`);
  const queryNormalized = normalize(query);
  let score = 0;

  if (haystack.includes(queryNormalized) && queryNormalized.length > 4) {
    score += 20;
  }

  for (const term of queryTerms) {
    if (term.length < 3) continue;
    if (haystack.includes(term)) {
      score += term.includes(" ") ? 8 : 4;
    }
  }

  for (const token of tokenize(query)) {
    if (tokenize(chunk.stepTitle).includes(token)) score += 6;
    if (normalize(chunk.text).includes(token)) score += 2;
  }

  if (userRole === "SE") {
    if (/^se\s*:/i.test(chunk.text.trim())) score += 12;
    if (hasTechnicalIntent(query) && /\b(architecture|install base|workspace|provision|health|portfolio|environment|deploy|pas)\b/i.test(haystack)) {
      score += 6;
    }
  }

  if (userRole === "AM" && /^am\s*:/i.test(chunk.text.trim())) {
    score += 12;
  }

  return score;
}

function firstClause(text: string, maxLen = 100): string {
  const clause = text.split(/(?<=[.;])\s+/)[0]?.trim() ?? text;
  if (clause.length <= maxLen) return clause;
  const trimmed = clause.slice(0, maxLen);
  const lastSpace = trimmed.lastIndexOf(" ");
  return `${trimmed.slice(0, lastSpace > 60 ? lastSpace : maxLen).trim()}…`;
}

function isWhoQuestion(query: string): boolean {
  return /\b(who|whom|with whom|work with|involve)\b/i.test(query);
}

function lowercaseFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function ensurePeriod(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function pickDetailsForRole(
  details: string[],
  role?: UserRole,
): string[] {
  if (!role || role === "Other") {
    return details;
  }

  const prefix = role === "SE" ? /^se\s*:/i : /^am\s*:/i;
  const roleSpecific = details.filter((detail) => prefix.test(detail.trim()));

  if (roleSpecific.length > 0) {
    return roleSpecific.map((detail) => detail.replace(/^[^:]+:\s*/i, ""));
  }

  if (role === "SE") {
    const technical = details.filter((detail) =>
      /\b(architecture|install base|workspace|smart account|provision|health|portfolio|environment|deploy|pas|technical|specialist)\b/i.test(
        detail,
      ),
    );
    if (technical.length > 0) {
      return technical;
    }
  }

  return details.filter((detail) => !/^(am|se)\s*:/i.test(detail.trim()));
}

function roleAnswerLead(query: string, role?: UserRole): string {
  if (role === "SE") {
    return pickVariant(query, [
      "From an SE perspective, ",
      "On the technical side, ",
      "What I'd focus on here: ",
    ]);
  }

  if (role === "AM") {
    return pickVariant(query, [
      "From an AE perspective, ",
      "For account ownership, ",
      "Here's the commercial angle: ",
    ]);
  }

  return pickVariant(query, [
    "Here's what the playbook highlights: ",
    "For this part of the EA journey, ",
    "A good way to think about it: ",
  ]);
}

function softenLowConfidence(answer: string, query: string, stepTitle: string): string {
  const lead = pickVariant(query, [
    `I think you're asking about "${stepTitle}" — `,
    `This may be what you need on "${stepTitle}": `,
    `Closest match I have is "${stepTitle}": `,
  ]);
  return `${lead}${answer.charAt(0).toLowerCase()}${answer.slice(1)}`;
}

function unknownAnswer(query: string, context: AssistantContext): string {
  const seed = `${query}:${context.lastAnswer ?? ""}`;

  if (context.userRole === "SE") {
    return pickVariant(seed, [
      "I don't have a exact line for that — try install base review, EA workspace cleanup, provisioning with PAS, or health checks.",
      "That's a bit outside my playbook match — SEs often ask about Cisco Ready, onboarding, architecture validation, or True Forward. Pick one and I'll dig in.",
      "I'm not confident on that one. Rephrase around a step (e.g. \"How do I clean up the EA workspace?\") or ask for the next step.",
      "I couldn't tie that to a step. Technical topics I handle well: install base, provisioning, modifications, and lifecycle health checks.",
    ]);
  }

  if (context.userRole === "AM") {
    return pickVariant(seed, [
      "I couldn't match that to a step — try targets, proposal prep, partner selection, or renewal timing.",
      "Not sure I follow — ask about a specific phase (pre-sales vs post-sales) or say \"what's next?\"",
      "I don't have a crisp answer for that. Try \"How do I identify EA targets?\" or \"What happens during onboarding?\"",
    ]);
  }

  return pickVariant(seed, [
    "I couldn't find that in the playbook. Try targets, install base, proposals, True Forward, onboarding, or renewal.",
    "I'm not matching that to a step yet — name a topic (e.g. provisioning, milestones, renewal) or ask for the next step.",
    "That's outside what I can answer directly. Ask about a playbook step or say \"mark that complete\" after we discuss one.",
  ]);
}

function unclearFollowUp(context: AssistantContext, step: PlaybookStep): string {
  const seed = `${step.id}:${context.lastAnswer ?? ""}`;
  return pickVariant(seed, [
    `I'm not sure I follow — want me to mark "${shortStepTitle(step)}" complete, or tell you what comes next?`,
    `Did you mean "${shortStepTitle(step)}"? I can mark it done or walk you to the next step.`,
    `We were on "${shortStepTitle(step)}" — should I mark it complete or show the next step?`,
  ]);
}

function composeNaturalAnswer(
  step: PlaybookStep,
  chunks: KnowledgeChunk[],
  query: string,
  userRole?: UserRole,
  lowConfidence = false,
): string {
  const stepChunks = chunks.filter((chunk) => chunk.stepTitle === step.title);

  if (isWhoQuestion(query) && step.audience) {
    const whoLead = pickVariant(query, [
      `For "${shortStepTitle(step)}", work with `,
      `You'll want to loop in `,
      `This step typically involves `,
    ]);
    return ensurePeriod(
      `${whoLead}${lowercaseFirst(step.audience)}`,
    );
  }

  const details = pickDetailsForRole(
    stepChunks
      .filter((chunk) => chunk.id.includes("-detail-"))
      .map((chunk) => chunk.text),
    userRole,
  )
    .slice(0, 2)
    .map((detail) => ensurePeriod(firstClause(detail, 110)));

  const summary = ensurePeriod(firstClause(step.summary, 150));
  const lead = roleAnswerLead(query, userRole);

  let body: string;
  if (details.length === 0) {
    body = summary;
  } else if (details.length === 1) {
    body = `${summary} ${details[0]}`;
  } else {
    body = `${summary}\n\n${details[0]} ${details[1]}`;
  }

  const framed = `${lead}${body.charAt(0).toLowerCase()}${body.slice(1)}`;
  if (lowConfidence) {
    return softenLowConfidence(framed, query, shortStepTitle(step));
  }

  return framed;
}

function helpMessage(context: AssistantContext): string {
  const roleHint =
    context.userRole === "SE"
      ? ' Ask about install base, provisioning, workspace cleanup, health checks, or say "next step".'
      : context.userRole === "AM"
        ? ' Ask about targets, proposals, partners, renewals, or say "mark that complete".'
        : ' Ask about any EA step, say "mark that complete", or ask for the next step.';

  if (context.customerName) {
    return `Working on ${context.customerName}.${roleHint}`;
  }

  return `Hi — I answer from the EA playbook, not the open web.${roleHint}`;
}

function isGreeting(query: string): boolean {
  return /^(hi|hello|hey)\b/i.test(query);
}

function isHelpQuery(query: string): boolean {
  return /^(help|what can you|what do you|how can you)\b/i.test(query);
}

function wantsMarkComplete(query: string): boolean {
  return (
    /\b(mark|check|set|update|track).*\b(complete|done|finished)\b/i.test(query) ||
    /\b(complete|done).*\b(progress|tracker|step|playbook|bar)\b/i.test(query) ||
    /\bmark (that|this|it)\b/i.test(query) ||
    /\b(that|this|it)\s+(is\s+)?(also|too)\s+(done|complete)\b/i.test(query) ||
    /\b(also|too)\s+(done|complete)\b/i.test(query)
  );
}

function wantsNextSteps(query: string): boolean {
  return (
    /\bnext step/i.test(query) ||
    /\bwhat('s| is| are) next\b/i.test(query) ||
    /\bgive me next\b/i.test(query) ||
    /\bwhat should i do (next|now)\b/i.test(query) ||
    /\bwhat comes after\b/i.test(query)
  );
}

function isAffirmative(query: string): boolean {
  const normalized = query.trim().replace(/[!?.]+$/g, "").trim();
  return /^(ya|yeah|yep|yes|yup|ok|okay|sure|do it|please|go ahead|sounds good|perfect|great|correct|right|uh huh|mhm)$/i.test(
    normalized,
  );
}

function refersToPreviousTopic(query: string): boolean {
  return /\b(that|this|it|what we (just )?discussed|the step|you (just )?said|same topic)\b/i.test(
    query,
  );
}

function isFollowUpQuery(query: string): boolean {
  if (refersToPreviousTopic(query)) {
    return true;
  }

  return /\b(specifically|tell me more|more detail|elaborate|break (it )?down|what am i looking for|what should i look|what do i look|go deeper|drill down|explain more|what about|what if|how about|like what|such as|for example|can you clarify|be more specific|what counts as|what would meet)\b/i.test(
    query,
  );
}

function splitSubQuestions(query: string): string[] {
  const parts = query
    .split(/\?+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);

  if (parts.length <= 1) {
    return [query.trim()];
  }

  return parts.map((part, index) =>
    index < parts.length - 1 ? `${part}?` : part.endsWith("?") ? part : `${part}?`,
  );
}

function scoreDetailMatch(detail: string, query: string): number {
  const detailNorm = normalize(detail);
  const queryNorm = stripConversationalNoise(query);
  let score = 0;

  if (detailNorm.includes(queryNorm) && queryNorm.length > 8) {
    score += 24;
  }

  for (const token of tokenize(queryNorm)) {
    if (token.length < 3) continue;
    if (detailNorm.includes(token)) {
      score += 5;
    }
  }

  for (const term of expandQuery(queryNorm)) {
    if (term.length < 3) continue;
    if (detailNorm.includes(term)) {
      score += term.includes(" ") ? 7 : 3;
    }
  }

  return score;
}

type DetailCandidate = {
  step: PlaybookStep;
  detail: string;
  detailKey: string;
  score: number;
};

function collectDetailCandidates(
  query: string,
  context: AssistantContext,
  preferSection?: string,
): DetailCandidate[] {
  const discussed = new Set(context.discussedDetailIds ?? []);
  const candidates: DetailCandidate[] = [];

  for (const step of PLAYBOOK_STEPS) {
    const details = pickDetailsForRole(step.details, context.userRole);
    details.forEach((detail, index) => {
      const detailKey = detailId(step.id, index);
      let score = scoreDetailMatch(detail, query);

      if (preferSection && step.section === preferSection) {
        score += 4;
      }

      if (context.lastStepId && step.id === context.lastStepId) {
        score += 3;
      }

      if (discussed.has(detailKey)) {
        score -= /\bwhat if\b/i.test(query) ? 4 : 12;
      }

      if (score > 0) {
        candidates.push({ step, detail, detailKey, score });
      }
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function formatDetailAnswer(
  query: string,
  matches: DetailCandidate[],
  context: AssistantContext,
): { answer: string; discussedDetailIds: string[]; lastStepId: string } {
  const discussed = new Set(context.discussedDetailIds ?? []);
  const usedKeys: string[] = [];
  const parts: string[] = [];

  const lead = pickVariant(query, [
    "Good follow-up — here's the playbook detail:",
    "Drilling into that:",
    "Specifically for your question:",
    "Here's what to look at:",
  ]);

  parts.push(lead);

  for (const match of matches.slice(0, 3)) {
    if (usedKeys.includes(match.detailKey)) continue;
    usedKeys.push(match.detailKey);
    discussed.add(match.detailKey);
    parts.push(`• ${ensurePeriod(firstClause(match.detail, 220))}`);
  }

  if (usedKeys.length === 0) {
    const anchorStep = context.lastStepId
      ? stepById(context.lastStepId)
      : undefined;

    if (anchorStep) {
      const freshDetails = pickDetailsForRole(anchorStep.details, context.userRole)
        .map((detail, index) => ({
          detail,
          detailKey: detailId(anchorStep.id, index),
        }))
        .filter((entry) => !discussed.has(entry.detailKey))
        .slice(0, 2);

      if (freshDetails.length > 0) {
        parts.push(
          pickVariant(query, [
            `Still on "${shortStepTitle(anchorStep)}" — a few specifics:`,
            `For "${shortStepTitle(anchorStep)}", also check:`,
            `More from "${shortStepTitle(anchorStep)}":`,
          ]),
        );
        for (const entry of freshDetails) {
          usedKeys.push(entry.detailKey);
          discussed.add(entry.detailKey);
          parts.push(`• ${ensurePeriod(firstClause(entry.detail, 220))}`);
        }
      }
    }
  }

  const focusStepId = matches[0]?.step.id ?? context.lastStepId ?? PLAYBOOK_STEPS[0].id;

  return {
    answer: parts.join("\n\n"),
    discussedDetailIds: [...discussed],
    lastStepId: focusStepId,
  };
}

function handleDrillDown(
  query: string,
  context: AssistantContext,
): AssistantResponse | null {
  if (!context.lastStepId && !isFollowUpQuery(query)) {
    return null;
  }

  const anchorStep = context.lastStepId ? stepById(context.lastStepId) : undefined;
  const subQuestions = splitSubQuestions(query);
  const allMatches: DetailCandidate[] = [];

  for (const subQuestion of subQuestions) {
    const matches = collectDetailCandidates(
      subQuestion,
      context,
      anchorStep?.section,
    );
    if (matches[0]) {
      allMatches.push(matches[0]);
    }
  }

  const uniqueMatches = allMatches.filter(
    (match, index, array) =>
      array.findIndex((item) => item.detailKey === match.detailKey) === index,
  );

  if (uniqueMatches.length === 0 && !isFollowUpQuery(query)) {
    return null;
  }

  if (uniqueMatches.length === 0 && anchorStep) {
    const fallbackMatches = pickDetailsForRole(anchorStep.details, context.userRole)
      .map((detail, index) => ({
        step: anchorStep,
        detail,
        detailKey: detailId(anchorStep.id, index),
        score: 1,
      }))
      .filter(
        (entry) => !(context.discussedDetailIds ?? []).includes(entry.detailKey),
      )
      .slice(0, 2);

    if (fallbackMatches.length === 0) {
      return {
        answer: pickVariant(query, [
          `We've covered the main points on "${shortStepTitle(anchorStep)}". Want the next step, or should I mark this complete?`,
          `That's everything I have on "${shortStepTitle(anchorStep)}" for now — say "next step" to keep going.`,
        ]),
        found: true,
        lastStepId: anchorStep.id,
        discussedDetailIds: context.discussedDetailIds,
      };
    }

    const formatted = formatDetailAnswer(query, fallbackMatches, context);
    return {
      answer: formatted.answer,
      found: true,
      lastStepId: formatted.lastStepId,
      discussedDetailIds: formatted.discussedDetailIds,
    };
  }

  const formatted = formatDetailAnswer(query, uniqueMatches, context);
  return {
    answer: formatted.answer,
    found: true,
    lastStepId: formatted.lastStepId,
    discussedDetailIds: formatted.discussedDetailIds,
  };
}

function markDiscussedFromAnswer(
  step: PlaybookStep,
  userRole: UserRole | undefined,
  existing: string[] = [],
): string[] {
  const discussed = new Set(existing);
  pickDetailsForRole(step.details, userRole)
    .slice(0, 2)
    .forEach((_, index) => discussed.add(detailId(step.id, index)));
  return [...discussed];
}

function isStepComplete(step: PlaybookStep, completedIds: Set<string>): boolean {
  return completedIds.has(step.id);
}

function stepById(stepId: string): PlaybookStep | undefined {
  return PLAYBOOK_STEPS.find((step) => step.id === stepId);
}

function shortStepTitle(step: PlaybookStep): string {
  return step.title.includes(" — ")
    ? step.title.split(" — ").pop() ?? step.title
    : step.title;
}

function roleScoreBoost(step: PlaybookStep, role?: UserRole, query?: string): number {
  if (!role || role === "Other") {
    return 0;
  }

  const technical = query ? hasTechnicalIntent(query) : false;

  if (role === "AM") {
    if (step.owner === "AM") return 10;
    if (step.owner === "AM & SE") return 4;
    return -10;
  }

  if (step.owner === "SE") return 12;
  if (step.owner === "AM & SE") return technical ? 8 : 5;
  return technical ? -4 : -12;
}

function rankChunks(query: string, role?: UserRole) {
  const cleanedQuery = stripConversationalNoise(query);
  const queryTerms = expandQuery(cleanedQuery.length > 2 ? cleanedQuery : query);

  return KNOWLEDGE_BASE.map((chunk) => ({
    chunk,
    score: scoreChunk(chunk, cleanedQuery.length > 2 ? cleanedQuery : query, queryTerms, role),
  }))
    .map((entry) => {
      const step = PLAYBOOK_STEPS.find((item) => item.title === entry.chunk.stepTitle);
      return {
        ...entry,
        step,
        score:
          entry.score +
          (step ? roleScoreBoost(step, role, query) : 0),
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

function pickBestStepFromRanked(
  ranked: ReturnType<typeof rankChunks>,
  role?: UserRole,
): PlaybookStep | undefined {
  if (ranked.length === 0) return undefined;

  const top = ranked[0];
  const runnerUp = ranked[1];

  if (role === "SE" && top?.step && runnerUp?.step && top.step.owner === "AM" && runnerUp.step.owner !== "AM") {
    if (runnerUp.score >= top.score * 0.72) {
      return runnerUp.step;
    }
  }

  return top?.step ?? PLAYBOOK_STEPS.find((item) => item.title === top?.chunk.stepTitle);
}

function findBestStep(query: string, role?: UserRole): PlaybookStep | undefined {
  return pickBestStepFromRanked(rankChunks(query, role), role);
}

function resolveTargetStep(
  query: string,
  context: AssistantContext,
): PlaybookStep | undefined {
  if (refersToPreviousTopic(query) && context.lastStepId) {
    return stepById(context.lastStepId);
  }

  const stripped = query
    .replace(
      /\b(mark|check|set|update|track|complete|done|finished|progress|tracker|next steps?|give me|what('s| is| are) next|and|on the|as|bar|that|this|it)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (stripped.length > 2) {
    const fromQuery = findBestStep(stripped, context.userRole);
    if (fromQuery) return fromQuery;
  }

  if (context.lastStepId) {
    return stepById(context.lastStepId);
  }

  return undefined;
}

function findNextIncompleteStep(
  afterStepId: string | undefined,
  completedIds: Set<string>,
): PlaybookStep | undefined {
  const startIndex =
    afterStepId == null
      ? 0
      : PLAYBOOK_STEPS.findIndex((step) => step.id === afterStepId) + 1;

  for (let index = Math.max(0, startIndex); index < PLAYBOOK_STEPS.length; index++) {
    const step = PLAYBOOK_STEPS[index];
    if (!isStepComplete(step, completedIds)) {
      return step;
    }
  }

  return undefined;
}

function phaseLabel(step: PlaybookStep): string {
  return step.phase === "post-sales" ? "Post-Sales" : "Pre-Sales";
}

function describeNextStep(step: PlaybookStep): string {
  return ensurePeriod(
    `Up next (${phaseLabel(step)}): ${shortStepTitle(step)} — ${firstClause(step.summary, 120)}`,
  );
}

function wantsStartFromBeginning(query: string): boolean {
  return /\b(where (do|should) i start|first step|from the (start|beginning)|start over)\b/i.test(
    query,
  );
}

function isNextStepComplaint(query: string): boolean {
  return (
    /\b(why|how did you|how do you).*(pre-?sales|post-?sales|go from|went to|jump)\b/i.test(
      query,
    ) || /\bpost-?sales.*pre-?sales\b/i.test(query)
  );
}

function resolveNextStepAnchor(
  query: string,
  context: AssistantContext,
  markedStepId: string | undefined,
  mark: boolean,
): string | undefined {
  if (wantsStartFromBeginning(query)) {
    return undefined;
  }

  if (/\bafter (that|this|it)\b/i.test(query)) {
    return context.lastStepId;
  }

  if (mark && markedStepId) {
    return markedStepId;
  }

  return context.lastStepId;
}

function handleNextStepComplaint(
  context: AssistantContext,
): AssistantResponse | null {
  if (!context.lastStepId) {
    return null;
  }

  const currentStep = stepById(context.lastStepId);
  if (!currentStep) {
    return null;
  }

  const nextStep = findNextIncompleteStep(context.lastStepId, context.completedIds);
  if (!nextStep) {
    return {
      answer: `You're on ${phaseLabel(currentStep)} (${shortStepTitle(currentStep)}) and everything after it is already complete.`,
      found: true,
      lastStepId: context.lastStepId,
    };
  }

  return {
    answer: `Good catch — you were working through ${phaseLabel(currentStep)}, so the next step should stay in that flow. ${describeNextStep(nextStep)}`,
    found: true,
    lastStepId: nextStep.id,
  };
}

function handleAffirmative(context: AssistantContext): AssistantResponse | null {
  if (!context.lastStepId) {
    return null;
  }

  const step = stepById(context.lastStepId);
  if (!step) {
    return null;
  }

  if (!isStepComplete(step, context.completedIds)) {
    return {
      answer: `Got it — I've marked "${shortStepTitle(step)}" complete.`,
      found: true,
      actions: [{ type: "markStepComplete", stepId: step.id }],
      lastStepId: step.id,
    };
  }

  const nextStep = findNextIncompleteStep(step.id, context.completedIds);
  if (nextStep) {
    return {
      answer: `"${shortStepTitle(step)}" was already done. ${describeNextStep(nextStep)}`,
      found: true,
      lastStepId: nextStep.id,
    };
  }

  return {
    answer: "You're all caught up — every playbook step is complete.",
    found: true,
    lastStepId: step.id,
  };
}

function handleProgressActions(
  query: string,
  context: AssistantContext,
): AssistantResponse | null {
  const mark = wantsMarkComplete(query);
  const next = wantsNextSteps(query);

  if (!mark && !next) {
    return null;
  }

  const targetStep = resolveTargetStep(query, context);
  const actions: AssistantAction[] = [];
  let markedStepId: string | undefined;

  if (mark) {
    if (!targetStep) {
      return {
        answer:
          "Which step should I mark complete? Ask about a topic first — for example, \"How do I identify EA targets?\" — then say \"mark that complete.\"",
        found: false,
      };
    }

    markedStepId = targetStep.id;

    if (!isStepComplete(targetStep, context.completedIds)) {
      actions.push({ type: "markStepComplete", stepId: targetStep.id });
    }
  }

  const completedAfter = new Set(context.completedIds);
  if (actions.length > 0 && markedStepId) {
    const step = stepById(markedStepId);
    if (step) {
      completedAfter.add(step.id);
      step.details.forEach((_, index) =>
        completedAfter.add(detailId(step.id, index)),
      );
    }
  }

  const anchorForNext = resolveNextStepAnchor(
    query,
    context,
    markedStepId,
    mark,
  );

  const nextStep = findNextIncompleteStep(anchorForNext, completedAfter);

  const parts: string[] = [];

  if (mark && targetStep) {
    if (actions.length > 0) {
      parts.push(
        `Done — I've marked "${shortStepTitle(targetStep)}" complete.`,
      );
    } else {
      parts.push(
        `"${shortStepTitle(targetStep)}" is already marked complete.`,
      );
    }
  }

  if (next) {
    if (nextStep) {
      parts.push(describeNextStep(nextStep));
    } else {
      parts.push("You're all caught up — every playbook step is complete.");
    }
  }

  if (parts.length === 0) {
    return null;
  }

  let focusStepId = context.lastStepId;
  if (next && nextStep) {
    focusStepId = nextStep.id;
  } else if (mark && targetStep) {
    focusStepId = targetStep.id;
  }

  return {
    answer: parts.join("\n\n"),
    found: true,
    actions: actions.length > 0 ? actions : undefined,
    lastStepId: focusStepId,
  };
}

export function answerPlaybookQuestion(
  question: string,
  context: AssistantContext = { completedIds: new Set() },
): AssistantResponse {
  const trimmed = question.trim();
  if (!trimmed) {
    return { answer: "What would you like to know about the EA playbook?", found: false };
  }

  if (isGreeting(trimmed) || isHelpQuery(trimmed)) {
    return { answer: helpMessage(context), found: true };
  }

  if (isAffirmative(trimmed)) {
    const affirmativeResponse = handleAffirmative(context);
    if (affirmativeResponse) {
      return affirmativeResponse;
    }
  }

  if (isNextStepComplaint(trimmed)) {
    const complaintResponse = handleNextStepComplaint(context);
    if (complaintResponse) {
      return complaintResponse;
    }
  }

  const actionResponse = handleProgressActions(trimmed, context);
  if (actionResponse) {
    return actionResponse;
  }

  if (context.lastStepId && isFollowUpQuery(trimmed)) {
    const drillDown = handleDrillDown(trimmed, context);
    if (drillDown) {
      return drillDown;
    }
  }

  const ranked = rankChunks(trimmed, context.userRole);

  if (ranked.length === 0) {
    if (context.lastStepId) {
      const step = stepById(context.lastStepId);
      if (step) {
        return {
          answer: unclearFollowUp(context, step),
          found: false,
          lastStepId: context.lastStepId,
        };
      }
    }

    return {
      answer: unknownAnswer(trimmed, context),
      found: false,
    };
  }

  const topScore = ranked[0]?.score ?? 0;
  const lowConfidence = topScore < 14;
  const topChunks = ranked
    .filter((entry) => entry.score >= Math.max(3, topScore * 0.55))
    .slice(0, 3)
    .map((entry) => entry.chunk);

  const step = pickBestStepFromRanked(ranked, context.userRole);

  if (!step) {
    const fallback = ensurePeriod(firstClause(topChunks[0]?.text ?? "", 180));
    return { answer: fallback, found: true };
  }

  if (step.id === context.lastStepId) {
    const drillDown = handleDrillDown(trimmed, context);
    if (drillDown) {
      return drillDown;
    }
  }

  let answer = composeNaturalAnswer(
    step,
    topChunks,
    trimmed,
    context.userRole,
    lowConfidence,
  );

  if (answer === context.lastAnswer) {
    answer = `${answer}\n\n${pickVariant(trimmed, [
      "Want the next step, or should I mark this one complete?",
      "Say \"next step\" if you want to keep moving.",
      "I can mark this complete if you're done with it.",
    ])}`;
  }

  return {
    answer,
    found: true,
    lastStepId: step.id,
    discussedDetailIds: markDiscussedFromAnswer(
      step,
      context.userRole,
      context.discussedDetailIds,
    ),
  };
}

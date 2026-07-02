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
};

export type AssistantResponse = {
  answer: string;
  found: boolean;
  actions?: AssistantAction[];
  lastStepId?: string;
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
  am: ["account manager", "account managers"],
  se: ["sales engineer", "sales engineers", "specialist"],
};

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "was",
  "one", "our", "how", "what", "when", "where", "which", "with", "would",
  "could", "should", "about", "tell", "explain", "describe", "help", "please",
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
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

function scoreChunk(chunk: KnowledgeChunk, query: string, queryTerms: string[]): number {
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

  return details.filter((detail) => !/^(am|se)\s*:/i.test(detail.trim()));
}

function composeNaturalAnswer(
  step: PlaybookStep,
  chunks: KnowledgeChunk[],
  query: string,
  userRole?: UserRole,
): string {
  const stepChunks = chunks.filter((chunk) => chunk.stepTitle === step.title);

  if (isWhoQuestion(query) && step.audience) {
    return ensurePeriod(
      `For this step, work with ${lowercaseFirst(step.audience)}`,
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

  if (details.length === 0) {
    return summary;
  }

  if (details.length === 1) {
    return `${summary} ${details[0]}`;
  }

  return `${summary}\n\n${details[0]} ${details[1]}`;
}

function helpMessage(context: AssistantContext): string {
  const base =
    'Ask me about any EA step, say "mark that complete", or ask for the next step.';

  if (context.customerName) {
    return `Working on ${context.customerName}. ${base}`;
  }

  return base;
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
  return /\b(that|this|it|what we (just )?discussed|the step)\b/i.test(query);
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

function roleScoreBoost(step: PlaybookStep, role?: UserRole): number {
  if (!role || role === "Other") {
    return 0;
  }

  if (role === "AM") {
    if (step.owner === "AM") return 10;
    if (step.owner === "AM & SE") return 4;
    return -8;
  }

  if (step.owner === "SE") return 10;
  if (step.owner === "AM & SE") return 4;
  return -8;
}

function findBestStep(query: string, role?: UserRole): PlaybookStep | undefined {
  const queryTerms = expandQuery(query);
  const ranked = KNOWLEDGE_BASE.map((chunk) => ({
    chunk,
    score: scoreChunk(chunk, query, queryTerms),
  }))
    .filter((entry) => entry.score > 0)
    .map((entry) => {
      const step = PLAYBOOK_STEPS.find((item) => item.title === entry.chunk.stepTitle);
      return {
        ...entry,
        score: entry.score + (step ? roleScoreBoost(step, role) : 0),
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return undefined;

  const bestTitle = ranked[0]?.chunk.stepTitle;
  return (
    PLAYBOOK_STEPS.find((item) => item.title === bestTitle) ??
    PLAYBOOK_STEPS.find((item) =>
      ranked.some((entry) => entry.chunk.stepTitle === item.title),
    )
  );
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

  const queryTerms = expandQuery(trimmed);
  const ranked = KNOWLEDGE_BASE.map((chunk) => ({
    chunk,
    score: scoreChunk(chunk, trimmed, queryTerms),
  }))
    .map((entry) => {
      const step = PLAYBOOK_STEPS.find(
        (item) => item.title === entry.chunk.stepTitle,
      );
      return {
        ...entry,
        score: entry.score + (step ? roleScoreBoost(step, context.userRole) : 0),
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    if (context.lastStepId) {
      const step = stepById(context.lastStepId);
      if (step) {
        return {
          answer: `I'm not sure I follow — want me to mark "${shortStepTitle(step)}" complete, or tell you what comes next?`,
          found: false,
          lastStepId: context.lastStepId,
        };
      }
    }

    return {
      answer:
        "I couldn't find that in the playbook. Try asking about targets, install base, proposals, True Forward, onboarding, or renewal.",
      found: false,
    };
  }

  const topScore = ranked[0]?.score ?? 0;
  const topChunks = ranked
    .filter((entry) => entry.score >= Math.max(3, topScore * 0.55))
    .slice(0, 3)
    .map((entry) => entry.chunk);

  const bestTitle = topChunks[0]?.stepTitle;
  const step =
    PLAYBOOK_STEPS.find((item) => item.title === bestTitle) ??
    PLAYBOOK_STEPS.find((item) =>
      topChunks.some((chunk) => chunk.stepTitle === item.title),
    );

  if (!step) {
    const fallback = ensurePeriod(firstClause(topChunks[0]?.text ?? "", 180));
    return { answer: fallback, found: true };
  }

  return {
    answer: composeNaturalAnswer(step, topChunks, trimmed, context.userRole),
    found: true,
    lastStepId: step.id,
  };
}

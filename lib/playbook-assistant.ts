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
  lastUserQuery?: string;
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

function playbookExcerpt(text: string, maxLen = 480): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) {
    return trimmed;
  }

  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
  let result = "";

  for (const sentence of sentences) {
    const next = result ? `${result} ${sentence}` : sentence;
    if (next.length <= maxLen) {
      result = next;
    } else {
      break;
    }
  }

  if (result.length > 0) {
    return result;
  }

  const cut = trimmed.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > maxLen * 0.5 ? cut.slice(0, lastSpace).trim() : cut.trim();
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

function topicOpener(step: PlaybookStep, query: string): string {
  return pickVariant(query, [
    `On ${shortStepTitle(step)} —`,
    `For ${shortStepTitle(step)}, here's what the playbook says:`,
    `When it comes to ${shortStepTitle(step)},`,
  ]);
}

function conversationalCloser(query: string): string {
  return pickVariant(query, [
    "\n\nWant me to go deeper on any of that?",
    "\n\nHappy to unpack a follow-up — or say \"next step\" when you're ready to move on.",
    "\n\nLet me know if you want more detail on any piece of this.",
  ]);
}

function greetingReply(context: AssistantContext): string {
  const seed = context.customerName ?? "default";
  if (context.customerName) {
    return pickVariant(seed, [
      `Hey! I'm here for ${context.customerName}'s EA. What are you working through right now?`,
      `Hi — ready to help on ${context.customerName}. Ask me about any playbook step, or say "what's next?"`,
      `Hello! What part of the EA journey do you want to tackle for ${context.customerName}?`,
    ]);
  }

  return pickVariant(seed, [
    "Hey! What part of the EA playbook can I help with today?",
    "Hi — ask me about any step, follow up with more questions, or say \"next step\" when you're ready.",
    "Hello! Tell me what you're working on and I'll pull the right guidance from the playbook.",
  ]);
}

function thanksReply(query: string): string {
  return pickVariant(query, [
    "You're welcome — anything else on this EA?",
    "Happy to help. What do you want to look at next?",
    "Anytime. Want to keep going on this step or move to the next one?",
  ]);
}

function isThanks(query: string): boolean {
  return /\b(thanks|thank you|thx|appreciate it|helpful)\b/i.test(query);
}

function softenLowConfidence(answer: string, query: string, stepTitle: string): string {
  const lead = pickVariant(query, [
    `I think you're asking about ${stepTitle}. `,
    `This might be what you need on ${stepTitle}: `,
    `Closest thing I have in the playbook is ${stepTitle}. `,
  ]);
  return `${lead}\n\n${answer}${conversationalCloser(query)}`;
}

function unknownAnswer(query: string, context: AssistantContext): string {
  const seed = `${query}:${context.lastAnswer ?? ""}`;

  if (context.userRole === "SE") {
    return pickVariant(seed, [
      "Hmm — I'm not finding that exact topic. Try install base, EA workspace cleanup, provisioning with PAS, or health checks.",
      "I'm not sure on that one. SEs often ask about Cisco Ready, onboarding, architecture validation, or True Forward — want to try one of those?",
      "I don't have a clean match yet. Rephrase around a step (like \"How do I clean up the EA workspace?\") and I'll pull the details.",
    ]);
  }

  if (context.userRole === "AM") {
    return pickVariant(seed, [
      "I'm not matching that to a step yet — try targets, proposal prep, partner selection, or renewal timing.",
      "Not totally sure what you mean. Name a phase (pre-sales or post-sales) or ask \"what's next?\"",
      "I don't have a crisp answer for that. Something like \"How do I identify EA targets?\" usually works well.",
    ]);
  }

  return pickVariant(seed, [
    "I'm not finding that in the playbook yet. Try targets, install base, proposals, True Forward, onboarding, or renewal.",
    "Hmm — can you phrase that around a playbook step? Or say \"next step\" and we'll keep moving.",
    "That's a bit outside what I can answer directly. Ask about a specific step and we can go from there.",
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

  const details = dedupeDetailsAgainstSummary(
    step.summary,
    pickDetailsForRole(
      stepChunks
        .filter((chunk) => chunk.id.includes("-detail-"))
        .map((chunk) => chunk.text),
      userRole,
    ),
  )
    .slice(0, 3)
    .map((detail) => ensurePeriod(detail));

  const summary = ensurePeriod(step.summary);
  const opener = topicOpener(step, query);

  if (details.length === 0) {
    const body = `${opener}\n\n${summary}${conversationalCloser(query)}`;
    if (lowConfidence) {
      return softenLowConfidence(`${summary}${conversationalCloser(query)}`, query, shortStepTitle(step));
    }
    return body;
  }

  const detailIntro = detailsLookLikePrompts(details)
    ? pickVariant(query, [
        "Before you move on, get clear on:",
        "The playbook expects you to nail down:",
        "Key questions to answer:",
      ])
    : pickVariant(query, [
        "In practice, focus on:",
        "A few things the playbook calls out:",
        "Here's what to look at:",
      ]);
  const bullets = details.map((detail) => `• ${detail}`).join("\n");
  const body = `${opener}\n\n${summary}\n\n${detailIntro}\n${bullets}${conversationalCloser(query)}`;

  if (lowConfidence) {
    return softenLowConfidence(
      `${summary}\n\n${detailIntro}\n${bullets}${conversationalCloser(query)}`,
      query,
      shortStepTitle(step),
    );
  }

  return body;
}

function formatStepLine(step: PlaybookStep): string {
  return `• ${shortStepTitle(step)} — ${ensurePeriod(step.summary)}`;
}

function handleRoleOverview(
  query: string,
  context: AssistantContext,
): AssistantResponse {
  const role = effectiveRole(context, query) ?? "AM";
  const label = roleDisplayName(role);
  const nextStep = findNextIncompleteStep(undefined, context.completedIds);
  const lines: string[] = [];

  if (role === "SE") {
    lines.push(
      pickVariant(query, [
        `Here's where I'd focus as an ${label} across the EA playbook:`,
        `As an ${label}, these are the steps where you're most involved:`,
      ]),
      "",
      "Pre-Sales (with your AE)",
      ...PLAYBOOK_STEPS.filter((step) => step.phase === "pre-sales" && step.owner === "AM & SE").map(
        formatStepLine,
      ),
      "",
      "Post-Sales",
      ...PLAYBOOK_STEPS.filter(
        (step) => step.phase === "post-sales" && step.owner === "AM & SE",
      ).map(formatStepLine),
      "",
      "Your deepest ownership is usually install base review, EA workspace cleanup, provisioning with PAS, architecture validation, modifications, and health checks. Pair with the AE on True Forward and renewal.",
    );
  } else if (role === "AM") {
    const amOwned = PLAYBOOK_STEPS.filter((step) => step.owner === "AM");
    const jointPre = PLAYBOOK_STEPS.filter(
      (step) => step.phase === "pre-sales" && step.owner === "AM & SE",
    );
    const jointPost = PLAYBOOK_STEPS.filter(
      (step) => step.phase === "post-sales" && step.owner === "AM & SE",
    );

    lines.push(
      pickVariant(query, [
        `Here's how I'd think about the EA playbook as an ${label}:`,
        `As an ${label}, this is the journey the playbook lays out:`,
      ]),
      "",
      "Pre-Sales — identify and close",
      "With your SE, qualify the opportunity:",
      ...jointPre.map(formatStepLine),
      "You lead commercial execution:",
      ...amOwned.filter((step) => step.phase === "pre-sales").map(formatStepLine),
      "",
      "Post-Sales — run the lifecycle",
      ...amOwned.filter((step) => step.phase === "post-sales").map(formatStepLine),
      "Partner with SE on:",
      ...jointPost.map(formatStepLine),
    );
  } else {
    lines.push(
      "Here's the full EA playbook journey:",
      "",
      "Pre-Sales",
      ...PLAYBOOK_STEPS.filter((step) => step.phase === "pre-sales").map(formatStepLine),
      "",
      "Post-Sales",
      ...PLAYBOOK_STEPS.filter((step) => step.phase === "post-sales").map(formatStepLine),
    );
  }

  if (nextStep) {
    lines.push(
      "",
      pickVariant(query, [
        `Practical starting point: ${shortStepTitle(nextStep)} — ${ensurePeriod(nextStep.summary)}`,
        `If you want one place to start today: ${shortStepTitle(nextStep)}. ${ensurePeriod(nextStep.summary)}`,
      ]),
    );
  }

  lines.push(conversationalCloser(query));

  return {
    answer: lines.join("\n"),
    found: true,
    lastStepId: nextStep?.id ?? PLAYBOOK_STEPS[0]?.id,
  };
}

function handleClarification(
  query: string,
  context: AssistantContext,
): AssistantResponse | null {
  if (!isClarificationRewind(query)) {
    return null;
  }

  const prior = context.lastUserQuery ?? "";
  if (
    wantsRoleOverview(prior) ||
    wantsRoleOverview(query) ||
    /\b(focus|ae|am|se|role|steps|playbook|priorit)\b/i.test(prior)
  ) {
    const overview = handleRoleOverview(prior || query, context);
    if (prior) {
      const lead = pickVariant(query, [
        "Got it — here's the EA playbook laid out for you:\n\n",
        "Sure — walking through the steps:\n\n",
      ]);
      overview.answer = `${lead}${overview.answer}`;
    }
    return overview;
  }

  if (context.lastStepId) {
    const step = stepById(context.lastStepId);
    if (step) {
      return {
        answer: composeNaturalAnswer(
          step,
          KNOWLEDGE_BASE.filter((chunk) => chunk.stepTitle === step.title),
          prior || query,
          context.userRole,
        ),
        found: true,
        lastStepId: step.id,
        discussedDetailIds: markDiscussedFromAnswer(
          step,
          context.userRole,
          context.discussedDetailIds,
        ),
      };
    }
  }

  return handleRoleOverview(query, context);
}

function isMetaPlaybookQuery(query: string): boolean {
  return (
    isClarificationRewind(query) ||
    wantsRoleOverview(query) ||
    /\b(all (the )?steps|whole playbook|entire playbook|playbook overview|ea journey)\b/i.test(
      query,
    )
  );
}
function helpMessage(context: AssistantContext): string {
  if (context.customerName) {
    return pickVariant(context.customerName, [
      `I pull answers straight from the EA playbook for ${context.customerName}. Ask a question, follow up for more detail, say "mark that complete", or "what's next?"`,
      `Think of me as a playbook guide for ${context.customerName} — ask anything about a step and I'll walk you through it.`,
    ]);
  }

  return pickVariant("help", [
    "I pull answers from the EA playbook — not the open web. Ask about any step, follow up for more detail, or say \"next step\" to keep moving.",
    "I'm your playbook guide. Ask a question about any EA step and I'll break it down — follow-ups welcome.",
  ]);
}

function stripLeadingGreeting(query: string): string {
  return query.replace(/^(hi|hello|hey|good (morning|afternoon|evening))[,!.]?\s+/i, "").trim();
}

function isGreetingOnly(query: string): boolean {
  const remainder = normalize(query)
    .replace(/^(hi|hello|hey|good (morning|afternoon|evening))[,!.]?\s*/i, "")
    .replace(/[!?.]+$/g, "")
    .trim();

  if (remainder.length === 0) {
    return true;
  }

  return /^(how are you|how are ya|how's it going|what's up|sup)$/i.test(remainder);
}

function roleFromQuery(query: string): UserRole | undefined {
  if (/\b(ae|account executive|account manager|\bam\b)\b/i.test(query)) {
    return "AM";
  }
  if (/\b(se|sales engineer)\b/i.test(query)) {
    return "SE";
  }
  return undefined;
}

function effectiveRole(context: AssistantContext, query: string): UserRole | undefined {
  return roleFromQuery(query) ?? context.userRole;
}

function roleDisplayName(role: UserRole): string {
  if (role === "AM") return "AE";
  if (role === "SE") return "SE";
  return "account team";
}

function wantsRoleOverview(query: string): boolean {
  return (
    /\b(what should i focus|what (do|should) i (focus|prioriti)|my (role|responsibilit)|what do i own|where (do|should) i focus)\b/i.test(
      query,
    ) ||
    /\b(as an?|for an?|i am an?|i'?m an?)\s+(ae|am|se|account executive|account manager|sales engineer)\b/i.test(
      query,
    ) ||
    /\bwhat should (an? )?(ae|am|se)\b/i.test(query) ||
    /\b(ae|am|se) (focus|priorities|responsibilit)/i.test(query)
  );
}

function isClarificationRewind(query: string): boolean {
  return (
    /\b(i mean|i meant|no,? i mean|not that|that's not what)\b/i.test(query) ||
    /\b(from|in|across) the (ea )?(playbook|steps)\b/i.test(query) ||
    /\b(the )?(ea )?steps\b/i.test(query) && /\b(i mean|overall|big picture|whole journey|walk me through)\b/i.test(query)
  );
}

function detailsLookLikePrompts(details: string[]): boolean {
  if (details.length === 0) return false;
  const prompts = details.filter((detail) => detail.trim().endsWith("?"));
  return prompts.length >= Math.ceil(details.length / 2);
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
    step.details.forEach((detail, index) => {
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
    "Sure — here's more on that:",
    "Good question. From the playbook:",
    "Yep, let me break that down:",
    "Happy to go deeper here:",
  ]);

  parts.push(lead);

  for (const match of matches.slice(0, 3)) {
    if (usedKeys.includes(match.detailKey)) continue;
    usedKeys.push(match.detailKey);
    discussed.add(match.detailKey);
    parts.push(`• ${ensurePeriod(match.detail)}`);
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
          parts.push(`• ${ensurePeriod(entry.detail)}`);
        }
      }
    }
  }

  const focusStepId = matches[0]?.step.id ?? context.lastStepId ?? PLAYBOOK_STEPS[0].id;
  const answer = `${parts.join("\n\n")}${conversationalCloser(query)}`;

  return {
    answer,
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

function dedupeDetailsAgainstSummary(summary: string, details: string[]): string[] {
  const summaryNorm = normalize(summary);

  return details.filter((detail) => {
    const detailNorm = normalize(detail);

    if (
      detailNorm.length > 20 &&
      (summaryNorm.includes(detailNorm) ||
        detailNorm.includes(summaryNorm.replace(/\.$/, "")))
    ) {
      return false;
    }

    const summaryTokens = new Set(tokenize(summary));
    const detailTokens = tokenize(detail);
    if (detailTokens.length === 0) {
      return true;
    }

    const overlap = detailTokens.filter((token) => summaryTokens.has(token)).length;
    return overlap / detailTokens.length < 0.5;
  });
}

function allStepsComplete(completedIds: Set<string>): boolean {
  return PLAYBOOK_STEPS.every((step) => isStepComplete(step, completedIds));
}

function findFirstIncompleteStep(
  completedIds: Set<string>,
): PlaybookStep | undefined {
  return PLAYBOOK_STEPS.find((step) => !isStepComplete(step, completedIds));
}

function isLastPlaybookStep(stepId: string): boolean {
  return PLAYBOOK_STEPS[PLAYBOOK_STEPS.length - 1]?.id === stepId;
}

function describeAtEndOfPlaybook(
  context: AssistantContext,
  step: PlaybookStep,
  query: string,
): string {
  const lines: string[] = [];
  const firstOpen = findFirstIncompleteStep(context.completedIds);
  const trackerFull = allStepsComplete(context.completedIds);

  if (trackerFull) {
    lines.push(
      pickVariant(query, [
        "You've checked off every step in the tracker.",
        "The full playbook is marked complete in your progress tracker.",
      ]),
    );
    lines.push(
      pickVariant(query, [
        "In practice: keep milestone dates visible, stay ahead of True Forward budgeting with the customer, and loop your SE in on health checks well before renewal crunch time.",
        "On a live EA: run renewal talks 6–9 months before term end, validate install base vs entitlement, and coordinate partner + SE on any modifications early.",
      ]),
    );
    return lines.join("\n\n");
  }

  if (isLastPlaybookStep(step.id)) {
    lines.push(
      `"${shortStepTitle(step)}" is the last step in the EA playbook — there's nothing after it in the journey.`,
    );

    if (step.id === "post-6") {
      lines.push(
        "Put it into practice: start the renewal conversation 6–9 months before the EA end date, include Cisco, your partner, and the customer, and right-size the agreement to future needs.",
      );
    }

    if (firstOpen) {
      lines.push(
        `You still have open items earlier in your tracker. A good next focus: ${shortStepTitle(firstOpen)} — ${ensurePeriod(firstOpen.summary)}`,
      );
    } else {
      lines.push(
        'Say "mark that complete" to update your tracker, or ask about any topic you want to revisit.',
      );
    }

    return lines.join("\n\n");
  }

  if (firstOpen) {
    return pickVariant(query, [
      `No more steps after "${shortStepTitle(step)}" in playbook order. Your next open tracker item is ${shortStepTitle(firstOpen)} — ${ensurePeriod(firstOpen.summary)}`,
      `That's the end of this thread in the playbook. Pick up ${shortStepTitle(firstOpen)} next — ${ensurePeriod(firstOpen.summary)}`,
    ]);
  }

  return pickVariant(query, [
    `Nothing else follows "${shortStepTitle(step)}" in the playbook order.`,
    `You're at a natural pause after "${shortStepTitle(step)}". Ask about another topic or say "mark that complete".`,
  ]);
}

function isVagueContinuityQuery(query: string): boolean {
  return (
    /\b(so )?what (do|should) i do( now| next)?\b/i.test(query) ||
    /\bwhat now\b/i.test(query) ||
    /\b(and )?then what\b/i.test(query) ||
    /\bwhat('s| is) after (that|this)\b/i.test(query) ||
    /\bwhere do i go from here\b/i.test(query)
  );
}

function handleContinuityGuidance(
  query: string,
  context: AssistantContext,
): AssistantResponse | null {
  if (!isVagueContinuityQuery(query)) {
    return null;
  }

  if (!context.lastStepId) {
    return {
      answer: pickVariant(query, [
        "Tell me what you're working on — targets, a proposal, onboarding, True Forward, or renewal — and I'll point you to the right step.",
        "What part of the EA are you on? Name a topic and I'll pull the playbook guidance.",
      ]),
      found: false,
    };
  }

  const current = stepById(context.lastStepId);
  if (!current) {
    return null;
  }

  const nextInSequence = findNextIncompleteStep(
    current.id,
    context.completedIds,
  );

  if (nextInSequence) {
    return {
      answer: `Good checkpoint on "${shortStepTitle(current)}". Next in playbook order:\n\n${describeNextStep(nextInSequence, query)}`,
      found: true,
      lastStepId: nextInSequence.id,
    };
  }

  return {
    answer: describeAtEndOfPlaybook(context, current, query),
    found: true,
    lastStepId: current.id,
  };
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

function describeNextStep(step: PlaybookStep, query?: string): string {
  const seed = query ?? step.id;
  const lead = pickVariant(seed, [
    `Next up in ${phaseLabel(step)}: ${shortStepTitle(step)}.`,
    `When you're ready, move to ${shortStepTitle(step)} (${phaseLabel(step)}).`,
    `The next step is ${shortStepTitle(step)} in ${phaseLabel(step)}.`,
  ]);
  return `${lead}\n\n${ensurePeriod(step.summary)}`;
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
      answer: `Got it — I've marked "${shortStepTitle(step)}" complete for you.`,
      found: true,
      actions: [{ type: "markStepComplete", stepId: step.id }],
      lastStepId: step.id,
    };
  }

  const nextStep = findNextIncompleteStep(step.id, context.completedIds);
  if (nextStep) {
    return {
      answer: pickVariant(step.id, [
        `That one's already checked off. ${describeNextStep(nextStep, step.id)}`,
        `"${shortStepTitle(step)}" is done — here's what's next.\n\n${describeNextStep(nextStep, step.id)}`,
      ]),
      found: true,
      lastStepId: nextStep.id,
    };
  }

  return {
    answer: describeAtEndOfPlaybook(context, step, step.id),
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
        `Got it — I've marked "${shortStepTitle(targetStep)}" complete for you.`,
      );
    } else {
      parts.push(
        `"${shortStepTitle(targetStep)}" is already marked complete.`,
      );
    }
  }

  if (next) {
    if (nextStep) {
      parts.push(describeNextStep(nextStep, query));
    } else {
      const anchorStep = anchorForNext
        ? stepById(anchorForNext)
        : context.lastStepId
          ? stepById(context.lastStepId)
          : undefined;

      if (anchorStep) {
        parts.push(describeAtEndOfPlaybook(context, anchorStep, query));
      } else if (allStepsComplete(completedAfter)) {
        parts.push(
          pickVariant(query, [
            "You've checked off every step in the tracker — the playbook is complete.",
            "All playbook steps are marked complete in your progress tracker.",
          ]),
        );
      } else {
        const firstOpen = findFirstIncompleteStep(completedAfter);
        if (firstOpen) {
          parts.push(
            `Next open item in your tracker:\n\n${describeNextStep(firstOpen, query)}`,
          );
        } else {
          parts.push(describeAtEndOfPlaybook(context, PLAYBOOK_STEPS[0], query));
        }
      }
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

  if (isGreetingOnly(trimmed)) {
    return { answer: greetingReply(context), found: true };
  }

  if (isThanks(trimmed)) {
    return { answer: thanksReply(trimmed), found: true };
  }

  const query = stripLeadingGreeting(trimmed);

  if (isHelpQuery(query) || isHelpQuery(trimmed)) {
    return { answer: helpMessage(context), found: true };
  }

  const clarification = handleClarification(trimmed, context);
  if (clarification) {
    return clarification;
  }

  if (wantsRoleOverview(query) || wantsRoleOverview(trimmed)) {
    return handleRoleOverview(query || trimmed, context);
  }

  if (isMetaPlaybookQuery(query) || isMetaPlaybookQuery(trimmed)) {
    return handleRoleOverview(query || trimmed, context);
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

  const continuityResponse = handleContinuityGuidance(trimmed, context);
  if (continuityResponse) {
    return continuityResponse;
  }

  if (context.lastStepId && isFollowUpQuery(trimmed)) {
    const drillDown = handleDrillDown(trimmed, context);
    if (drillDown) {
      return drillDown;
    }
  }

  const ranked = rankChunks(query || trimmed, context.userRole);

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
    const fallback = ensurePeriod(playbookExcerpt(topChunks[0]?.text ?? "", 400));
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

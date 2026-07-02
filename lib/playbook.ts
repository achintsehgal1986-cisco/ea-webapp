import type { PlaybookPhaseGroup, PlaybookStep } from "./types";
import { detailId } from "./progress";

export const PLAYBOOK_STEPS: PlaybookStep[] = [
  {
    id: "pre-1a",
    title: "Identifying EA Targets — Impending Events",
    owner: "AM & SE",
    phase: "pre-sales",
    section: "I. Identifying EA Targets",
    audience:
      "Work with your renewals manager and combination seller. For lifecycle events and customer initiatives, work with the main point of contact at your customer.",
    summary:
      "Review upcoming renewals and major projects to identify EA opportunities.",
    details: [
      "Renewals: upcoming subscription renewals (next 6–12 months), upcoming services renewals (next 6–12 months)",
      "Upcoming lifecycle events: large projects, refreshes, EOS/EOL pressure, user growth",
      "True Forward: for existing EA customers where there is an opportunity to add additional architectures and grow the agreement",
      "Customer initiatives: contract consolidation, budget planning, cost savings, vendor standardization (competitive displacement), M&A",
      "Large True Forward events — work with your combo seller",
      "Major projects that may create a timely opening for an EA discussion",
    ],
  },
  {
    id: "pre-1b",
    title: "Identifying EA Targets — Account Research",
    owner: "AM & SE",
    phase: "pre-sales",
    section: "I. Identifying EA Targets",
    audience:
      "Work with your renewals manager and relevant extended team members (combo seller, architecture specialists).",
    summary:
      "Pull customer Cisco IB, review contracts, and identify consolidation opportunities.",
    details: [
      "Review your customer's Cisco install base to understand what architectures they own today, identify which meet EA minimum qualifications, and identify if they already own an EA today.",
      "Customers with a multi-architecture footprint and multiple contracts are strong EA candidates.",
      "Pull customer Cisco IB. Review with renewals manager and combo seller.",
      "Are there multiple contracts with disparate end dates? What would meet EA minimum qualifications? Do they have a lot of LDOS gear and it's time to position a refresh?",
      "Show value of consolidating all architectures that qualify. Treat EAs wholistically.",
      "Opportunity for competitive displacement — ask what vendor does not fit within the customer's long-term strategy.",
    ],
  },
  {
    id: "pre-1c",
    title: "Identifying EA Targets — What You Will Need",
    owner: "AM & SE",
    phase: "pre-sales",
    section: "I. Identifying EA Targets",
    summary:
      "Gather key customer information before proceeding with proposal work.",
    details: [
      "Budget cycle?",
      "Customer's spend limit?",
      "What's important to customer — simplicity / expansion opportunity?",
      "Next steps and ownerships?",
    ],
  },
  {
    id: "pre-1d",
    title: "Identifying EA Targets — Install Base Report",
    owner: "AM & SE",
    phase: "pre-sales",
    section: "I. Identifying EA Targets",
    audience:
      "Work with your renewals manager and software/services seller to download and review install base reports.",
    summary:
      "Use Cisco Ready / CCW-R reports to review current customer install base.",
    details: [
      "Work with your renewals manager and software/services seller to download and review your customer's install base via Cisco Ready (customer's entire Cisco IB) and CCW-R (customer's contracts).",
      "If an EA opportunity is identified, involve an Architecture Specialist.",
      "If you're not familiar with Cisco Ready, work with your Renewals Manager.",
      "Access to subscriptions in CCW-R — request access if you don't currently have it. Renewals Manager or Combo Seller can assist.",
      "For identifying renewals, EOS/EOL, or True Forward opportunities, work with your renewals manager and services/software seller via Cisco Ready, CCW-R, or a Cisco IQ walkthrough.",
    ],
    resources: [
      {
        label: "Cisco Ready",
        url: "https://rewarddash.cloudapps.cisco.com/#/welcome",
      },
      {
        label: "CCW-R",
        url: "https://ccrc.cisco.com/ccwr/",
      },
    ],
  },
  {
    id: "pre-2",
    title: "Proposal Pre-Work",
    owner: "AM & SE",
    phase: "pre-sales",
    section: "II. Proposal Pre-Work",
    summary: "Prepare supporting data before building the proposal.",
    details: [
      "Refresh lifecycle",
      "Active & impending projects",
      "Existing discounts",
      "Customer discussion",
    ],
  },
  {
    id: "pre-3",
    title: "Building the Proposal",
    owner: "AM",
    phase: "pre-sales",
    section: "III. Building the Proposal",
    summary:
      "Build the EA proposal with discounts, TCO comparison, and start date considerations.",
    details: [
      "Discounting: think through what are standard discounts for the customer.",
      "TCO: BAU vs EA — build basic comparison examples.",
      "Discuss impending purchases (massive projects, ramp credits).",
      "Talk to extended team PSS's about existing promos. Think through existing SPIFFs.",
      "Pre-paid vs annual: some products have uptick.",
      "Start date: 90 day maximum — beyond 90 days it can get less accurate.",
    ],
  },
  {
    id: "pre-4",
    title: "Partner Selection / Roles & Responsibilities",
    owner: "AM",
    phase: "pre-sales",
    section: "IV. Partner Selection",
    summary:
      "Select and validate a qualified partner for selling and managing the EA.",
    details: [
      "Identify a partner qualified to sell and manage the EA.",
      "Validate partner roles and responsibilities with the customer and extended team.",
      "Confirm the partner can support provisioning, lifecycle management, and renewal preparation.",
    ],
  },
  {
    id: "post-1",
    title: "Provisioning — Onboarding Process",
    owner: "AM & SE",
    phase: "post-sales",
    section: "I. Provisioning",
    summary:
      "Onboard the customer after the EA sale with provisioning calls and workspace cleanup.",
    details: [
      "Pre-call with PAS (virtual account validation)",
      "SE: EA workspace — opportunity to clean up customer smart accounts",
    ],
  },
  {
    id: "post-2",
    title: "Milestone Dates to Keep in Mind",
    owner: "AM",
    phase: "post-sales",
    section: "II. Milestone Dates",
    summary:
      "Track key lifecycle events to reinforce EA value and maintain alignment.",
    details: [
      "Throughout the EA 3.0 lifecycle, key events are important to reinforcing value and maintaining alignment with team, partner, and customer.",
      "Being proactive about milestones helps you avoid being reactive, be a strategic and trusted partner, and position for seamless renewal.",
    ],
  },
  {
    id: "post-2b",
    title: "True Forward Process",
    owner: "AM & SE",
    phase: "post-sales",
    section: "II. Milestone Dates",
    summary:
      "Manage the annual True Forward billing process for growth during the EA term.",
    details: [
      "The True Forward (TF) is Cisco's annual billing process for growth during the EA term.",
      "Unlike many other agreements that charge retroactively for past use, Cisco's EA allows customers to grow without a retroactive bill. Growth is included in the next TF invoice on a going-forward basis.",
      "The TF invoice is scheduled annually on the anniversary of the EA start date.",
    ],
  },
  {
    id: "post-2c",
    title: "Exceptional Growth True Forwards (EGTF)",
    owner: "AM",
    phase: "post-sales",
    section: "II. Milestone Dates",
    summary:
      "Handle off-cycle True Forwards triggered when consumption exceeds growth caps.",
    details: [
      "An EGTF occurs when a customer consumes above their allotted growth cap. Growth caps vary suite by suite.",
      "Initial growth cap: 105% of initial entitlement in the first 6 months.",
      "Standard growth cap (after 6 months): 115% of then-current entitlement.",
    ],
  },
  {
    id: "post-3",
    title: "Budgeting the True Forward",
    owner: "AM",
    phase: "post-sales",
    section: "III. Budgeting",
    summary: "Plan and budget for the True Forward invoice with the customer.",
    details: [
      "Work with the customer and partner to budget for the upcoming True Forward invoice based on consumption data.",
    ],
  },
  {
    id: "post-4",
    title: "Change Modification Process",
    owner: "AM & SE",
    phase: "post-sales",
    section: "IV. Change Modifications",
    summary: "Handle EA modifications like adding new technologies (e.g., WiFi 7).",
    details: [
      "Before getting to the EA, have a conversation with the customer. Have they had a health check? Do we know the environment?",
      "Clean up the environment — by the time we get to the EA team, we know the info. Normal discounts are documented.",
      "Health check can be done by partner or specialist SE.",
      "Before starting, determine what needs to be done (e.g., 'How many DUO users do you have, how many will you have next year?').",
    ],
  },
  {
    id: "post-5",
    title: "Ensuring Success Throughout Lifecycle — Health Checks",
    owner: "AM & SE",
    phase: "post-sales",
    section: "V. Ensuring Success",
    summary:
      "Conduct health checks to ensure EA products are activated, deployed, and meeting customer needs.",
    details: [
      "The Portfolio Activation team will reach out when a health check is needed. Is it activated? Is it being used?",
      "Usually Cisco-led. Some partners have a practice to do this too.",
      "Bring in Portfolio SE for the technical side. Is it still meeting your needs?",
      "Many products have 2 weeks grace periods before shutdown. Get products turned on within a week of EA activation.",
      "Ensure things are deployed throughout lifecycle, protecting the renewal.",
      "If you have a tier 2 service, they will likely own this. Otherwise, up to account team + extended team and partner.",
    ],
  },
  {
    id: "post-6",
    title: "Prepping for EA Renewal",
    owner: "AM & SE",
    phase: "post-sales",
    section: "VI. Renewal Prep",
    summary:
      "Start renewal preparation early to position value and avoid last-minute scrambles.",
    details: [
      "Start thinking about the customer's EA renewal early to position value, right-size to future needs, and avoid a dive and catch.",
      "6–9 months prior to EA end date: start EA renewal conversation with customer.",
      "Include both Cisco/partner and customer in discussions.",
    ],
  },
];

export const PLAYBOOK_PHASES: PlaybookPhaseGroup[] = [
  {
    id: "pre-sales",
    title: "Pre-Sales",
    description:
      "Steps for pursuing and closing an EA — identifying targets, building proposals, and selecting partners.",
    steps: PLAYBOOK_STEPS.filter((step) => step.phase === "pre-sales"),
  },
  {
    id: "post-sales",
    title: "Post-Sales",
    description:
      "Steps after the EA is sold — onboarding, True Forward, lifecycle management, and renewal.",
    steps: PLAYBOOK_STEPS.filter((step) => step.phase === "post-sales"),
  },
];

export function stepMatchesOwner(
  step: PlaybookStep,
  selectedOwners: Set<string>,
): boolean {
  if (selectedOwners.size === 0) {
    return true;
  }

  return selectedOwners.has(step.owner);
}

export function stepMatchesSearch(step: PlaybookStep, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const haystack = [
    step.title,
    step.summary,
    step.section,
    step.audience ?? "",
    ...step.details,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export function countCheckableItems(steps: PlaybookStep[]): number {
  return steps.reduce((total, step) => total + 1 + step.details.length, 0);
}

export function countCompletedItems(
  steps: PlaybookStep[],
  completedIds: Set<string>,
): number {
  return steps.reduce((total, step) => {
    const stepDone = completedIds.has(step.id) ? 1 : 0;
    const detailsDone = step.details.filter((_, index) =>
      completedIds.has(detailId(step.id, index)),
    ).length;
    return total + stepDone + detailsDone;
  }, 0);
}

/**
 * Source: LC EA Playbook (Cleaned Up).docx
 * The AI assistant is restricted to this content only.
 */
export const PLAYBOOK_DOC_TITLE = "LC EA Playbook (Cleaned Up)";

export const PLAYBOOK_DOC_SECTIONS = [
  {
    id: "pre-sales-intro",
    heading: "Pre-Sales",
    body: "",
  },
  {
    id: "identifying-targets",
    heading: "Identifying EA Targets",
    body: "Looking to sell an EA? Below are good starting points in identifying EA Targets within your accounts.",
  },
  {
    id: "customer-install-base",
    heading: "Customer Install Base",
    body: "Review your customer's Cisco Install Base to understand what architectures they own today, identify which meet EA minimum qualifications, and identify if they already own an EA today. Customers with a multi-architecture footprint in Cisco that currently have multiple contracts and renewal dates are strong EA candidates.",
  },
  {
    id: "install-base-process",
    heading: "Process, Audience & Resources — Install Base",
    body: "Work with your renewals manager and software/services seller to download and review your customer's install base. This can be done via Cisco Ready (customer's entire Cisco IB) and CCW-R (customer's contracts). If EA Opportunity is identified, involve Architecture Specialist. All AM's and SE's have access to Cisco Ready: https://rewarddash.cloudapps.cisco.com/#/welcome. Renewals Manager and Software/Services Sellers have access to CCW-R. AM's and SE's can request access via CCW: https://ccrc.cisco.com/ccwr/",
  },
  {
    id: "impending-events",
    heading: "Impending Events",
    body: "Understand the customer's upcoming events and commercial triggers that may create a timely opening for an EA discussion. These events include: Renewals — upcoming subscription renewals (next 6-12 months), upcoming services renewals (next 6-12 months). Upcoming Lifecycle Events — large projects, refreshes, EOS/EOL pressure, user growth. True Forward — for existing EA customers where there is an opportunity to add additional architectures and grow the agreement. Customer Initiatives — Contract Consolidation Efforts, Budget Planning, Cost Savings Initiatives, Vendor Standardization (competitive displacement), M&A.",
  },
  {
    id: "impending-events-process",
    heading: "Process, Audience & Resources — Impending Events",
    body: "For identifying renewals, EOS/EOL, or True Forward opportunities, work with your renewals manager and services/software seller. These can be identified via Cisco Ready, CCW-R, or even a Cisco IQ walkthrough with your customer. For lifecycle events and customer initiatives, work with the main point of contact at your customer to uncover these.",
  },
  {
    id: "proposal-pre-work",
    heading: "Proposal Pre-Work",
    body: "Proposal Pre-Work section — prepare supporting data before building the proposal.",
  },
] as const;

export const PLAYBOOK_DOC_FULL_TEXT = PLAYBOOK_DOC_SECTIONS.map(
  (section) => `${section.heading}\n${section.body}`.trim(),
)
  .filter(Boolean)
  .join("\n\n");

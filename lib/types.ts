export type PlaybookPhase = "pre-sales" | "post-sales";

export type PlaybookOwner = "AM" | "SE" | "AM & SE";

export type PlaybookResource = {
  label: string;
  url: string;
};

export type PlaybookStep = {
  id: string;
  title: string;
  owner: PlaybookOwner;
  phase: PlaybookPhase;
  section: string;
  summary: string;
  details: string[];
  audience?: string;
  resources?: PlaybookResource[];
};

export type PlaybookPhaseGroup = {
  id: PlaybookPhase;
  title: string;
  description: string;
  steps: PlaybookStep[];
};

type PlaybookHeaderProps = {
  completedCount: number;
  totalCount: number;
  customerName?: string;
  roleLabel?: string;
  onSwitchCustomer: () => void;
  onReset: () => void;
  onExportPdf: () => void;
  phaseTitle?: string;
  onBack?: () => void;
};

export function PlaybookHeader({
  completedCount,
  totalCount,
  customerName,
  roleLabel,
  onSwitchCustomer,
  onReset,
  onExportPdf,
  phaseTitle,
  onBack,
}: PlaybookHeaderProps) {
  const progress =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/cisco-logo.svg"
            alt="Cisco"
            className="h-6 w-auto shrink-0"
            width={216}
            height={114}
          />

          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Back to playbook overview"
            >
              <BackIcon className="size-4" />
            </button>
          ) : null}

          <div className="min-w-0">
            <h1 className="truncate text-base font-medium text-foreground">
              {phaseTitle ?? "EA Playbook"}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {customerName ? (
                <>
                  <span className="truncate">
                    {customerName}
                    {roleLabel ? ` · ${roleLabel}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={onSwitchCustomer}
                    className="ml-2 shrink-0 text-primary transition hover:underline"
                  >
                    Change customer
                  </button>
                </>
              ) : phaseTitle ? (
                "Leadership Council"
              ) : (
                "Cisco's EA playbook and Tracker"
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden min-w-[7rem] text-right sm:block">
            <p className="text-xs text-muted-foreground">{progress}%</p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onExportPdf}
            className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-foreground transition hover:bg-muted"
          >
            Export PDF
          </button>

          <button
            type="button"
            onClick={onReset}
            className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-muted"
          >
            Reset
          </button>
        </div>
      </div>
    </header>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

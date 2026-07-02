import { ProgressBar } from "@/components/progress-bar";
import {
  countCheckableItems,
  countCompletedItems,
} from "@/lib/playbook";
import type { PlaybookPhaseGroup } from "@/lib/types";

type PhaseHomeProps = {
  phases: PlaybookPhaseGroup[];
  completedIds: Set<string>;
  customerName?: string;
  onSelectPhase: (phaseId: PlaybookPhaseGroup["id"]) => void;
  onProvideCustomer?: () => void;
};

export function PhaseHome({
  phases,
  completedIds,
  customerName,
  onSelectPhase,
  onProvideCustomer,
}: PhaseHomeProps) {
  const allSteps = phases.flatMap((phase) => phase.steps);
  const overallTotal = countCheckableItems(allSteps);
  const overallCompleted = countCompletedItems(allSteps, completedIds);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-medium text-foreground">
          EA Playbook
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your step-by-step guide through the full EA lifecycle. Jump in
          wherever you and your customer are today.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-border bg-card p-5">
        <ProgressBar
          completed={overallCompleted}
          total={overallTotal}
          label={
            customerName
              ? `Progress on ${customerName}'s EA`
              : "Progress on your EA"
          }
          size="lg"
          headerAction={
            !customerName && onProvideCustomer ? (
              <button
                type="button"
                onClick={onProvideCustomer}
                className="text-sm text-primary transition hover:underline"
              >
                Add customer name
              </button>
            ) : undefined
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {phases.map((phase) => {
          const total = countCheckableItems(phase.steps);
          const completed = countCompletedItems(phase.steps, completedIds);

          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => onSelectPhase(phase.id)}
              className="group rounded-xl border border-border bg-card p-6 text-left transition hover:border-primary/40 hover:shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div
                  className={`flex size-10 items-center justify-center rounded-lg ${
                    phase.id === "pre-sales"
                      ? "bg-sky-100 text-sky-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {phase.id === "pre-sales" ? (
                    <PreSalesIcon className="size-5" />
                  ) : (
                    <PostSalesIcon className="size-5" />
                  )}
                </div>
                <ChevronRightIcon className="size-5 text-muted-foreground transition group-hover:text-primary" />
              </div>

              <h3 className="text-lg font-medium text-foreground">
                {phase.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {phase.description}
              </p>

              <div className="mt-5">
                <ProgressBar
                  completed={completed}
                  total={total}
                  label="Section progress"
                  size="sm"
                />
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function PreSalesIcon({ className }: { className?: string }) {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PostSalesIcon({ className }: { className?: string }) {
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
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

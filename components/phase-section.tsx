import { StepCard } from "@/components/step-card";
import { detailId } from "@/lib/progress";
import type { PlaybookPhaseGroup } from "@/lib/types";

type PhaseSectionProps = {
  phase: PlaybookPhaseGroup;
  completedIds: Set<string>;
  showHeader?: boolean;
  onToggleStepComplete: (step: PlaybookPhaseGroup["steps"][number]) => void;
  onToggleDetailComplete: (
    step: PlaybookPhaseGroup["steps"][number],
    index: number,
  ) => void;
};

export function PhaseSection({
  phase,
  completedIds,
  showHeader = true,
  onToggleStepComplete,
  onToggleDetailComplete,
}: PhaseSectionProps) {
  const completedInPhase = phase.steps.reduce((count, step) => {
    const stepDone = completedIds.has(step.id) ? 1 : 0;
    const detailsDone = step.details.filter((_, index) =>
      completedIds.has(detailId(step.id, index)),
    ).length;
    return count + stepDone + detailsDone;
  }, 0);

  const totalInPhase = phase.steps.reduce(
    (count, step) => count + 1 + step.details.length,
    0,
  );
  const phasePercent =
    totalInPhase === 0
      ? 0
      : Math.round((completedInPhase / totalInPhase) * 100);

  return (
    <section>
      {showHeader ? (
        <div className="mb-4 flex items-center gap-2.5">
          <h2 className="text-lg font-medium text-foreground">{phase.title}</h2>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {phasePercent}%
          </span>
        </div>
      ) : null}

      <div className="relative ml-1.5">
        <div className="absolute top-0 bottom-0 left-[11px] w-px bg-border" />
        <div className="space-y-3">
          {phase.steps.map((step, index) => (
            <StepCard
              key={step.id}
              step={step}
              index={index + 1}
              completedIds={completedIds}
              onToggleStepComplete={onToggleStepComplete}
              onToggleDetailComplete={onToggleDetailComplete}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

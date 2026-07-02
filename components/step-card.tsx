"use client";

import { useState } from "react";

import { CheckboxButton } from "@/components/checkbox-button";
import { detailId } from "@/lib/progress";
import type { PlaybookStep } from "@/lib/types";

type StepCardProps = {
  step: PlaybookStep;
  index: number;
  completedIds: Set<string>;
  onToggleStepComplete: (step: PlaybookStep) => void;
  onToggleDetailComplete: (step: PlaybookStep, index: number) => void;
};

export function StepCard({
  step,
  index,
  completedIds,
  onToggleStepComplete,
  onToggleDetailComplete,
}: StepCardProps) {
  const [expanded, setExpanded] = useState(false);
  const stepComplete = completedIds.has(step.id);

  return (
    <div className="relative flex gap-3">
      <div className="relative z-10 mt-3 shrink-0">
        <CheckboxButton
          checked={stepComplete}
          label={`Mark ${step.title} as ${stepComplete ? "incomplete" : "complete"}`}
          onToggle={() => onToggleStepComplete(step)}
        />
      </div>

      <div
        className={`flex-1 rounded-xl border transition-colors ${
          stepComplete
            ? "border-primary/25 bg-primary/[0.04]"
            : "border-border bg-card"
        }`}
      >
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-start gap-2 p-4 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {String(index).padStart(2, "0")}
              </span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground/80">
                {step.owner}
              </span>
            </div>
            <h3
              className={`text-sm leading-snug font-medium text-foreground ${
                stepComplete ? "text-muted-foreground line-through" : ""
              }`}
            >
              {step.title}
            </h3>
            {!expanded ? (
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {step.summary}
              </p>
            ) : null}
          </div>

          <ChevronIcon
            className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {expanded ? (
          <div className="space-y-4 border-t border-border px-4 pt-3 pb-4">
            <p className="text-sm leading-relaxed text-foreground/90">
              {step.summary}
            </p>

            {step.audience ? (
              <section>
                <h4 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Audience &amp; process
                </h4>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {step.audience}
                </p>
              </section>
            ) : null}

            {step.details.length > 0 ? (
              <section>
                <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Key points
                </h4>
                <ul className="space-y-2.5">
                  {step.details.map((detail, detailIndex) => {
                    const id = detailId(step.id, detailIndex);
                    const detailComplete = completedIds.has(id);

                    return (
                      <li key={id} className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          <CheckboxButton
                            size="sm"
                            checked={detailComplete}
                            label={`Mark key point as ${detailComplete ? "incomplete" : "complete"}`}
                            onToggle={() =>
                              onToggleDetailComplete(step, detailIndex)
                            }
                          />
                        </div>
                        <span
                          className={`text-sm leading-relaxed ${
                            detailComplete
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          }`}
                        >
                          {detail}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {step.resources && step.resources.length > 0 ? (
              <section>
                <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Resources
                </h4>
                <ul className="space-y-1.5">
                  {step.resources.map((resource) => (
                    <li key={resource.url}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {resource.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

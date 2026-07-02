type ProgressBarProps = {
  completed: number;
  total: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  headerAction?: React.ReactNode;
};

export function ProgressBar({
  completed,
  total,
  label = "Overall progress",
  size = "md",
  headerAction,
}: ProgressBarProps) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const barHeight =
    size === "lg" ? "h-3" : size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {headerAction}
        </div>
        <p className="shrink-0 text-sm text-muted-foreground">{percent}%</p>
      </div>
      <div
        className={`${barHeight} w-full overflow-hidden rounded-full bg-muted`}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

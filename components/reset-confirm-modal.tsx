"use client";

type ResetConfirmModalProps = {
  customerName?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ResetConfirmModal({
  customerName,
  onConfirm,
  onCancel,
}: ResetConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-lg font-medium text-foreground">Reset everything?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This will remove all saved data for this browser, including:
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>Playbook progress and checkboxes</li>
          {customerName ? <li>Customer name ({customerName})</li> : null}
          <li>Your email and role</li>
          <li>EA Assistant context</li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          You&apos;ll see the get started screen again. This cannot be undone.
        </p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90"
          >
            Reset everything
          </button>
        </div>
      </div>
    </div>
  );
}

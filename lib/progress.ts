const STORAGE_KEY = "lc-ea-playbook-completed";

export function detailId(stepId: string, index: number): string {
  return `${stepId}--${index}`;
}

export function readCompletedIds(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return new Set();
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(
      parsed.filter((value): value is string => typeof value === "string"),
    );
  } catch {
    return new Set();
  }
}

export function writeCompletedIds(ids: Set<string>): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

// Backward-compatible aliases
export const readCompletedStepIds = readCompletedIds;
export const writeCompletedStepIds = writeCompletedIds;

export type UsageEventType = "setup" | "visit";

export type UsagePayload = {
  eventType: UsageEventType;
  email?: string;
  customerName?: string;
  userRole?: string;
  otherRoleLabel?: string;
  skippedSetup?: boolean;
};

export async function trackUsage(payload: UsagePayload): Promise<void> {
  try {
    await fetch("/api/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Usage tracking should never block the app.
  }
}

const VISIT_TRACKED_KEY = "lc-ea-visit-tracked";

export function clearVisitTracked(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(VISIT_TRACKED_KEY);
}

export function trackVisitOnce(
  payload: Omit<UsagePayload, "eventType"> = {},
): void {
  if (typeof window === "undefined") {
    return;
  }

  if (window.sessionStorage.getItem(VISIT_TRACKED_KEY) === "true") {
    return;
  }

  window.sessionStorage.setItem(VISIT_TRACKED_KEY, "true");
  void trackUsage({ eventType: "visit", ...payload });
}

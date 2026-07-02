export type UserRole = "AM" | "SE" | "Other";

export type CustomerSession = {
  customerName: string;
  userRole: UserRole;
  email: string;
  otherRoleLabel?: string;
};

const SESSION_KEY = "lc-ea-active-session";
const SETUP_SKIPPED_KEY = "lc-ea-setup-skipped";
const LEGACY_PROGRESS_KEY = "lc-ea-playbook-completed";

function progressKey(customerName: string): string {
  const slug = customerName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `lc-ea-progress:${slug || "default"}`;
}

export function readActiveSession(): CustomerSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("customerName" in parsed) ||
      !("userRole" in parsed) ||
      !("email" in parsed) ||
      typeof parsed.customerName !== "string" ||
      typeof parsed.userRole !== "string" ||
      typeof parsed.email !== "string"
    ) {
      return null;
    }

    const session = parsed as CustomerSession;
    if (!session.customerName.trim() || !session.email.trim()) {
      return null;
    }

    if (!["AM", "SE", "Other"].includes(session.userRole)) {
      return null;
    }

    return {
      customerName: session.customerName.trim(),
      userRole: session.userRole,
      email: session.email.trim().toLowerCase(),
      otherRoleLabel:
        typeof session.otherRoleLabel === "string"
          ? session.otherRoleLabel.trim()
          : undefined,
    };
  } catch {
    return null;
  }
}

export function writeActiveSession(session: CustomerSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      customerName: session.customerName.trim(),
      userRole: session.userRole,
      email: session.email.trim().toLowerCase(),
      otherRoleLabel: session.otherRoleLabel?.trim() || undefined,
    }),
  );
}

export function clearActiveSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
}

export function readSetupSkipped(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(SETUP_SKIPPED_KEY) === "true";
}

export function writeSetupSkipped(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SETUP_SKIPPED_KEY, "true");
}

export function clearSetupSkipped(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SETUP_SKIPPED_KEY);
}

export function roleDisplayLabel(session: CustomerSession): string {
  if (session.userRole === "Other" && session.otherRoleLabel) {
    return session.otherRoleLabel;
  }

  if (session.userRole === "AM") {
    return "AE";
  }

  return session.userRole;
}

export function readCustomerProgress(customerName: string): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  const key = progressKey(customerName);

  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(
          parsed.filter((value): value is string => typeof value === "string"),
        );
      }
    }

    const legacy = window.localStorage.getItem(LEGACY_PROGRESS_KEY);
    if (legacy) {
      const parsed: unknown = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        const ids = new Set(
          parsed.filter((value): value is string => typeof value === "string"),
        );
        writeCustomerProgress(customerName, ids);
        window.localStorage.removeItem(LEGACY_PROGRESS_KEY);
        return ids;
      }
    }
  } catch {
    return new Set();
  }

  return new Set();
}

export function writeCustomerProgress(
  customerName: string,
  ids: Set<string>,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    progressKey(customerName),
    JSON.stringify([...ids]),
  );
}

export function clearCustomerProgress(customerName: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(progressKey(customerName));
}

export function clearLegacyProgress(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LEGACY_PROGRESS_KEY);
}

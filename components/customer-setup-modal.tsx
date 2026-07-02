"use client";

import { useState } from "react";

import { isValidEmail, normalizeEmail } from "@/lib/email";
import type { CustomerSession, UserRole } from "@/lib/session";

type CustomerSetupModalProps = {
  initialSession?: CustomerSession | null;
  onSubmit: (session: CustomerSession) => void;
  onSkip?: (partial: Partial<CustomerSession>) => void;
  onCancel?: () => void;
};

const ROLES: { id: UserRole; label: string; hint: string }[] = [
  { id: "AM", label: "AE", hint: "Account Executive" },
  { id: "SE", label: "SE", hint: "Sales Engineer" },
  { id: "Other", label: "Other", hint: "Renewals, partner, specialist, etc." },
];

export function CustomerSetupModal({
  initialSession,
  onSubmit,
  onSkip,
  onCancel,
}: CustomerSetupModalProps) {
  const [customerName, setCustomerName] = useState(
    initialSession?.customerName ?? "",
  );
  const [email, setEmail] = useState(initialSession?.email ?? "");
  const [userRole, setUserRole] = useState<UserRole>(
    initialSession?.userRole ?? "AM",
  );
  const [otherRoleLabel, setOtherRoleLabel] = useState(
    initialSession?.otherRoleLabel ?? "",
  );
  const [emailError, setEmailError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedName = customerName.trim();
    const trimmedEmail = normalizeEmail(email);

    if (!trimmedEmail) {
      setEmailError("Email is required.");
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setEmailError("Enter a valid email address (e.g. you@cisco.com).");
      return;
    }

    setEmailError(null);

    if (!trimmedName) {
      return;
    }

    if (userRole === "Other" && !otherRoleLabel.trim()) {
      return;
    }

    onSubmit({
      customerName: trimmedName,
      email: trimmedEmail,
      userRole,
      otherRoleLabel:
        userRole === "Other" ? otherRoleLabel.trim() : undefined,
    });
  }

  function handleSkip() {
    if (!onSkip) {
      return;
    }

    const partial: Partial<CustomerSession> = {};
    const trimmedEmail = normalizeEmail(email);

    if (trimmedEmail && isValidEmail(trimmedEmail)) {
      partial.email = trimmedEmail;
    }

    const trimmedName = customerName.trim();
    if (trimmedName) {
      partial.customerName = trimmedName;
    }

    const hasPartialInfo = Boolean(partial.email || partial.customerName);

    if (hasPartialInfo) {
      partial.userRole = userRole;
      if (userRole === "Other" && otherRoleLabel.trim()) {
        partial.otherRoleLabel = otherRoleLabel.trim();
      }
    }

    setEmailError(null);
    onSkip(partial);
  }

  const isEditing = Boolean(initialSession);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-lg font-medium text-foreground">
          {isEditing ? "Change customer" : "Get started"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {isEditing
            ? "Update the customer account and your role. Progress is saved per customer."
            : "Tell us which customer EA you're working on and your role so we can tailor the playbook and track progress."}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              Your email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (emailError) {
                  setEmailError(null);
                }
              }}
              placeholder="you@cisco.com"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "setup-email-error" : undefined}
              className={`h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 ${
                emailError
                  ? "border-destructive focus:border-destructive/50 focus:ring-destructive/15"
                  : "border-border focus:border-primary/50 focus:ring-primary/15"
              }`}
              autoFocus
            />
            {emailError ? (
              <span
                id="setup-email-error"
                className="mt-1 block text-xs text-destructive"
              >
                {emailError}
              </span>
            ) : (
              <span className="mt-1 block text-xs text-muted-foreground">
                Used only for LC adoption reporting — not shared outside the program.
              </span>
            )}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              Customer name
            </span>
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="e.g. Acme Corp"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">
              Your role
            </legend>
            <div className="space-y-2">
              {ROLES.map((role) => {
                const selected = userRole === role.id;
                return (
                  <label
                    key={role.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="userRole"
                      value={role.id}
                      checked={selected}
                      onChange={() => setUserRole(role.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-foreground">
                        {role.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {role.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {userRole === "Other" ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">
                Role title
              </span>
              <input
                value={otherRoleLabel}
                onChange={(event) => setOtherRoleLabel(event.target.value)}
                placeholder="e.g. Renewals Manager"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </label>
          ) : null}

          <div className="flex gap-2 pt-1">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              {isEditing ? "Save" : "Continue"}
            </button>
          </div>
        </form>

        {!isEditing && onSkip ? (
          <button
            type="button"
            onClick={handleSkip}
            className="mt-2 w-full rounded-lg px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            Skip for now
          </button>
        ) : null}
      </div>
    </div>
  );
}

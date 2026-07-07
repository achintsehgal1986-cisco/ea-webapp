"use client";

import { useEffect, useMemo, useState } from "react";

import { CustomerSetupModal } from "@/components/customer-setup-modal";
import { ResetConfirmModal } from "@/components/reset-confirm-modal";
import { PhaseHome } from "@/components/phase-home";
import { PhaseSection } from "@/components/phase-section";
import { PlaybookAssistant } from "@/components/playbook-assistant";
import { PlaybookHeader } from "@/components/playbook-header";
import { ProgressBar } from "@/components/progress-bar";
import { exportPlaybookPdf } from "@/lib/export-pdf";
import {
  PLAYBOOK_PHASES,
  PLAYBOOK_STEPS,
  countCheckableItems,
  countCompletedItems,
  stepMatchesOwner,
  stepMatchesSearch,
} from "@/lib/playbook";
import { detailId, readCompletedIds, writeCompletedIds } from "@/lib/progress";
import {
  type CustomerSession,
  clearActiveSession,
  clearCustomerProgress,
  clearLegacyProgress,
  clearSetupSkipped,
  readActiveSession,
  readCustomerProgress,
  readSetupSkipped,
  roleDisplayLabel,
  writeActiveSession,
  writeCustomerProgress,
  writeSetupSkipped,
} from "@/lib/session";
import { trackUsage, trackVisitOnce, clearVisitTracked } from "@/lib/usage-tracking";
import type { PlaybookOwner, PlaybookPhase, PlaybookStep } from "@/lib/types";

const OWNER_FILTERS: PlaybookOwner[] = ["AM", "SE", "AM & SE"];

function defaultOwnerFilters(session: CustomerSession): Set<string> {
  if (session.userRole === "AM") {
    return new Set(["AM", "AM & SE"]);
  }

  if (session.userRole === "SE") {
    return new Set(["SE", "AM & SE"]);
  }

  return new Set();
}

export function PlaybookApp() {
  const [session, setSession] = useState<CustomerSession | null>(() =>
    readActiveSession(),
  );
  const [showSetup, setShowSetup] = useState(() => {
    if (readActiveSession()) {
      return false;
    }
    return !readSetupSkipped();
  });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    const active = readActiveSession();
    return active ? readCustomerProgress(active.customerName) : readCompletedIds();
  });
  const [activePhaseId, setActivePhaseId] = useState<PlaybookPhase | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOwners, setSelectedOwners] = useState<Set<string>>(() => {
    const active = readActiveSession();
    return active ? defaultOwnerFilters(active) : new Set();
  });

  const activePhase = useMemo(
    () => PLAYBOOK_PHASES.find((phase) => phase.id === activePhaseId) ?? null,
    [activePhaseId],
  );

  const filteredSteps = useMemo(() => {
    if (!activePhase) {
      return [];
    }

    return activePhase.steps.filter(
      (step) =>
        stepMatchesSearch(step, searchQuery) &&
        stepMatchesOwner(step, selectedOwners),
    );
  }, [activePhase, searchQuery, selectedOwners]);

  const scopeSteps = activePhase ? activePhase.steps : PLAYBOOK_STEPS;
  const totalCount = countCheckableItems(
    activePhase ? filteredSteps : scopeSteps,
  );
  const completedCount = countCompletedItems(
    activePhase ? filteredSteps : scopeSteps,
    completedIds,
  );

  useEffect(() => {
    const active = readActiveSession();
    if (active) {
      trackVisitOnce({
        email: active.email,
        customerName: active.customerName,
        userRole: active.userRole,
        otherRoleLabel: active.otherRoleLabel,
      });
      return;
    }

    trackVisitOnce({ skippedSetup: readSetupSkipped() });
  }, []);

  function persist(next: Set<string>) {
    if (session) {
      writeCustomerProgress(session.customerName, next);
    } else {
      writeCompletedIds(next);
    }
    return next;
  }

  function goHome() {
    setActivePhaseId(null);
    setSearchQuery("");
    if (session) {
      setSelectedOwners(defaultOwnerFilters(session));
    } else {
      setSelectedOwners(new Set());
    }
  }

  function handleExportPdf() {
    exportPlaybookPdf(completedIds, activePhase?.id, session?.customerName);
  }

  function handleSessionSubmit(nextSession: CustomerSession) {
    clearSetupSkipped();
    writeActiveSession(nextSession);
    setSession(nextSession);
    setShowSetup(false);
    setCompletedIds(readCustomerProgress(nextSession.customerName));
    setSelectedOwners(defaultOwnerFilters(nextSession));
    goHome();

    void trackUsage({
      eventType: "setup",
      email: nextSession.email,
      customerName: nextSession.customerName,
      userRole: nextSession.userRole,
      otherRoleLabel: nextSession.otherRoleLabel,
    });
  }

  function handleSetupSkip(partial: Partial<CustomerSession> = {}) {
    writeSetupSkipped();
    setShowSetup(false);

    void trackUsage({
      eventType: "visit",
      skippedSetup: true,
      email: partial.email,
      customerName: partial.customerName,
      userRole: partial.userRole,
      otherRoleLabel: partial.otherRoleLabel,
    });
  }

  function toggleOwner(owner: string) {
    setSelectedOwners((current) => {
      const next = new Set(current);
      if (next.has(owner)) {
        next.delete(owner);
      } else {
        next.add(owner);
      }
      return next;
    });
  }

  function toggleStepComplete(step: PlaybookStep) {
    setCompletedIds((current) => {
      const next = new Set(current);
      const isComplete = next.has(step.id);

      if (isComplete) {
        next.delete(step.id);
        step.details.forEach((_, index) => next.delete(detailId(step.id, index)));
      } else {
        next.add(step.id);
        step.details.forEach((_, index) => next.add(detailId(step.id, index)));
      }

      return persist(next);
    });
  }

  function toggleDetailComplete(step: PlaybookStep, index: number) {
    setCompletedIds((current) => {
      const next = new Set(current);
      const id = detailId(step.id, index);

      if (next.has(id)) {
        next.delete(id);
        next.delete(step.id);
      } else {
        next.add(id);
        const allDetailsDone = step.details.every((_, detailIndex) =>
          next.has(detailId(step.id, detailIndex)),
        );
        if (allDetailsDone) {
          next.add(step.id);
        }
      }

      return persist(next);
    });
  }

  function markStepComplete(step: PlaybookStep) {
    setCompletedIds((current) => {
      const next = new Set(current);
      next.add(step.id);
      step.details.forEach((_, index) => next.add(detailId(step.id, index)));
      return persist(next);
    });
  }

  function requestReset() {
    setShowResetConfirm(true);
  }

  function confirmReset() {
    if (session) {
      clearCustomerProgress(session.customerName);
    }

    clearActiveSession();
    clearSetupSkipped();
    clearLegacyProgress();
    clearVisitTracked();
    writeCompletedIds(new Set());

    setSession(null);
    setCompletedIds(new Set());
    setSelectedOwners(new Set());
    setShowResetConfirm(false);
    setShowSetup(true);
    goHome();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {showResetConfirm ? (
        <ResetConfirmModal
          customerName={session?.customerName}
          onConfirm={confirmReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      ) : null}

      {showSetup ? (
        <CustomerSetupModal
          initialSession={session}
          onSubmit={handleSessionSubmit}
          onSkip={session ? undefined : handleSetupSkip}
          onCancel={session ? () => setShowSetup(false) : undefined}
        />
      ) : null}

      <PlaybookHeader
        completedCount={completedCount}
        totalCount={totalCount}
        customerName={session?.customerName}
        roleLabel={session ? roleDisplayLabel(session) : undefined}
        onSwitchCustomer={() => setShowSetup(true)}
        onReset={requestReset}
        onExportPdf={handleExportPdf}
        phaseTitle={activePhase?.title}
        onBack={activePhase ? goHome : undefined}
      />

      {activePhase ? (
        <>
          <div className="mx-auto max-w-4xl px-4 pt-5 pb-2">
            <div className="mb-5 rounded-xl border border-border bg-card p-4">
              <ProgressBar
                completed={completedCount}
                total={totalCount}
                label={`${activePhase.title} progress`}
                size="md"
              />
            </div>

            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              {activePhase.description}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search steps..."
                  className="h-10 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <FilterIcon className="size-4 shrink-0 text-muted-foreground" />
                {OWNER_FILTERS.map((owner) => {
                  const isActive = selectedOwners.has(owner);
                  return (
                    <button
                      key={owner}
                      type="button"
                      onClick={() => toggleOwner(owner)}
                      className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {owner}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <main className="mx-auto max-w-4xl px-4 py-6">
            {filteredSteps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No steps match your search or filters.
                </p>
              </div>
            ) : (
              <PhaseSection
                phase={{ ...activePhase, steps: filteredSteps }}
                completedIds={completedIds}
                showHeader={false}
                onToggleStepComplete={toggleStepComplete}
                onToggleDetailComplete={toggleDetailComplete}
              />
            )}
          </main>
        </>
      ) : (
        <PhaseHome
          phases={PLAYBOOK_PHASES}
          completedIds={completedIds}
          customerName={session?.customerName}
          onSelectPhase={setActivePhaseId}
          onProvideCustomer={session ? undefined : () => setShowSetup(true)}
        />
      )}

      <PlaybookAssistant
        session={session}
        completedIds={completedIds}
        onMarkStepComplete={markStepComplete}
      />
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.34-4.34" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
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
      <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />
    </svg>
  );
}

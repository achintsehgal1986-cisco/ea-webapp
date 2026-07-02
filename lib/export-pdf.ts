import { jsPDF } from "jspdf";

import {
  PLAYBOOK_PHASES,
  countCheckableItems,
  countCompletedItems,
} from "@/lib/playbook";
import { detailId } from "@/lib/progress";
import type { PlaybookPhase, PlaybookStep } from "@/lib/types";

const MARGIN = 18;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = PAGE_HEIGHT - 10;

const BODY = 5;
const BODY_TIGHT = 4.6;

const COLORS = {
  text: [30, 30, 30] as [number, number, number],
  muted: [110, 110, 110] as [number, number, number],
  faint: [170, 170, 170] as [number, number, number],
  rule: [220, 220, 220] as [number, number, number],
  phaseBg: [245, 247, 250] as [number, number, number],
};

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function shortStepTitle(title: string): string {
  if (!title.includes(" — ")) return title;
  return title.split(" — ").slice(1).join(" — ");
}

function setColor(doc: jsPDF, color: [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setDrawColor(doc: jsPDF, color: [number, number, number]) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function addPageFooter(doc: jsPDF, pageNumber: number) {
  setDrawColor(doc, COLORS.rule);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, FOOTER_Y - 4, PAGE_WIDTH - MARGIN, FOOTER_Y - 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor(doc, COLORS.faint);
  doc.text("EA Playbook · Cisco", MARGIN, FOOTER_Y);
  doc.text(String(pageNumber), PAGE_WIDTH - MARGIN, FOOTER_Y, { align: "right" });
  setColor(doc, COLORS.text);
}

function ensureSpace(doc: jsPDF, y: number, needed: number, pageNumber: number): {
  y: number;
  pageNumber: number;
} {
  if (y + needed <= FOOTER_Y - 6) {
    return { y, pageNumber };
  }

  addPageFooter(doc, pageNumber);
  doc.addPage();
  return { y: MARGIN, pageNumber: pageNumber + 1 };
}

function drawCheckbox(
  doc: jsPDF,
  x: number,
  y: number,
  checked: boolean,
  size = 3.2,
) {
  setDrawColor(doc, checked ? COLORS.muted : COLORS.faint);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y - size + 0.6, size, size, 0.4, 0.4);

  if (checked) {
    setDrawColor(doc, COLORS.text);
    doc.setLineWidth(0.45);
    doc.line(x + 0.7, y - size / 2 + 0.2, x + 1.35, y - 0.55);
    doc.line(x + 1.35, y - 0.55, x + size - 0.55, y - size + 0.95);
  }
}

function writeLines(
  doc: jsPDF,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  pageNumber: number,
): { y: number; pageNumber: number } {
  let currentY = y;
  let currentPage = pageNumber;

  for (const line of lines) {
    ({ y: currentY, pageNumber: currentPage } = ensureSpace(
      doc,
      currentY,
      lineHeight,
      currentPage,
    ));
    doc.text(line, x, currentY);
    currentY += lineHeight;
  }

  return { y: currentY, pageNumber: currentPage };
}

function writeCheckedText(
  doc: jsPDF,
  text: string,
  checked: boolean,
  x: number,
  y: number,
  maxWidth: number,
  pageNumber: number,
  fontSize = 9,
): { y: number; pageNumber: number } {
  doc.setFontSize(fontSize);
  const checkboxGap = 5;
  const lines = wrapText(doc, text, maxWidth - checkboxGap);
  let currentY = y;
  let currentPage = pageNumber;

  lines.forEach((line, index) => {
    ({ y: currentY, pageNumber: currentPage } = ensureSpace(
      doc,
      currentY,
      BODY,
      currentPage,
    ));

    if (index === 0) {
      drawCheckbox(doc, x, currentY, checked);
      doc.text(line, x + checkboxGap, currentY);
    } else {
      doc.text(line, x + checkboxGap, currentY);
    }

    currentY += BODY;
  });

  return { y: currentY, pageNumber: currentPage };
}

function writeStep(
  doc: jsPDF,
  step: PlaybookStep,
  completedIds: Set<string>,
  y: number,
  pageNumber: number,
): { y: number; pageNumber: number } {
  const stepDone = completedIds.has(step.id);
  let currentY = y;
  let currentPage = pageNumber;
  const title = shortStepTitle(step.title);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setColor(doc, COLORS.text);

  const ownerWidth = doc.getTextWidth(step.owner) + 2;
  const titleLines = wrapText(doc, title, CONTENT_WIDTH - ownerWidth - 8);
  const firstLineY = currentY;

  titleLines.forEach((line, index) => {
    ({ y: currentY, pageNumber: currentPage } = ensureSpace(
      doc,
      currentY,
      BODY + 0.5,
      currentPage,
    ));

    if (index === 0) {
      drawCheckbox(doc, MARGIN, currentY, stepDone);
      doc.text(line, MARGIN + 5, currentY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setColor(doc, COLORS.muted);
      doc.text(step.owner, PAGE_WIDTH - MARGIN, firstLineY, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      setColor(doc, COLORS.text);
    } else {
      doc.text(line, MARGIN + 5, currentY);
    }

    currentY += BODY + 0.5;
  });

  currentY += 1;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(doc, COLORS.muted);
  ({ y: currentY, pageNumber: currentPage } = writeLines(
    doc,
    wrapText(doc, step.summary, CONTENT_WIDTH - 5),
    MARGIN + 5,
    currentY,
    BODY_TIGHT,
    currentPage,
  ));
  setColor(doc, COLORS.text);

  if (step.audience) {
    currentY += 0.5;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    setColor(doc, COLORS.muted);
    ({ y: currentY, pageNumber: currentPage } = writeLines(
      doc,
      wrapText(doc, step.audience, CONTENT_WIDTH - 5),
      MARGIN + 5,
      currentY,
      BODY_TIGHT,
      currentPage,
    ));
    doc.setFont("helvetica", "normal");
    setColor(doc, COLORS.text);
  }

  if (step.details.length > 0) {
    currentY += 1.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    for (const [detailIndex, detail] of step.details.entries()) {
      const detailDone = completedIds.has(detailId(step.id, detailIndex));
      ({ y: currentY, pageNumber: currentPage } = writeCheckedText(
        doc,
        detail,
        detailDone,
        MARGIN + 5,
        currentY,
        CONTENT_WIDTH - 5,
        currentPage,
        8.5,
      ));
      currentY += 0.8;
    }
  }

  currentY += 3;
  setDrawColor(doc, COLORS.rule);
  doc.setLineWidth(0.15);
  doc.line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY);
  currentY += 5;

  return { y: currentY, pageNumber: currentPage };
}

export function exportPlaybookPdf(
  completedIds: Set<string>,
  phaseFilter?: PlaybookPhase,
  customerName?: string,
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const phases = phaseFilter
    ? PLAYBOOK_PHASES.filter((phase) => phase.id === phaseFilter)
    : PLAYBOOK_PHASES;

  const allSteps = phases.flatMap((phase) => phase.steps);
  const totalItems = countCheckableItems(allSteps);
  const completedItems = countCompletedItems(allSteps, completedIds);
  const progressLabel =
    totalItems === 0
      ? "0%"
      : `${Math.round((completedItems / totalItems) * 100)}%`;

  let y = MARGIN;
  let pageNumber = 1;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  setColor(doc, COLORS.text);
  doc.text("EA Playbook", MARGIN, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(doc, COLORS.muted);
  doc.text("Cisco", MARGIN, y + 6);

  const exportDate = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const headerRight = customerName
    ? `${customerName} · ${exportDate}`
    : exportDate;
  doc.text(headerRight, PAGE_WIDTH - MARGIN, y, { align: "right" });
  doc.text(
    `${progressLabel} complete`,
    PAGE_WIDTH - MARGIN,
    y + 6,
    { align: "right" },
  );

  y += 14;
  setDrawColor(doc, COLORS.rule);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;
  setColor(doc, COLORS.text);

  for (const phase of phases) {
    ({ y, pageNumber } = ensureSpace(doc, y, 18, pageNumber));

    doc.setFillColor(COLORS.phaseBg[0], COLORS.phaseBg[1], COLORS.phaseBg[2]);
    doc.roundedRect(MARGIN, y - 5, CONTENT_WIDTH, 10, 1.5, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    setColor(doc, COLORS.text);
    doc.text(phase.title.toUpperCase(), MARGIN + 3, y + 1.5);

    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(doc, COLORS.muted);
    ({ y, pageNumber } = writeLines(
      doc,
      wrapText(doc, phase.description, CONTENT_WIDTH),
      MARGIN,
      y,
      BODY,
      pageNumber,
    ));
    y += 4;
    setColor(doc, COLORS.text);

    let currentSection = "";

    for (const step of phase.steps) {
      if (step.section !== currentSection) {
        currentSection = step.section;
        ({ y, pageNumber } = ensureSpace(doc, y, 10, pageNumber));

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        setColor(doc, COLORS.text);
        doc.text(currentSection, MARGIN, y);
        y += 6;
      }

      ({ y, pageNumber } = writeStep(doc, step, completedIds, y, pageNumber));
    }

    y += 2;
  }

  addPageFooter(doc, pageNumber);

  const suffix = phaseFilter ? `-${phaseFilter}` : "";
  doc.save(`ea-playbook${suffix}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

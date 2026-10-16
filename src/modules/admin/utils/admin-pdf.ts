import type { jsPDF } from "jspdf";

import type { AdminMetrics } from "../types/admin-metrics.types";
import { type AdminReport, buildAdminReport, reportFileName } from "./admin-report.utils";

const MARGIN = 15;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const ROW_HEIGHT = 6.5;
const BOTTOM = PAGE_HEIGHT - 20;

/** Helvetica base solo dibuja Latin-1: normaliza U+00A0 y descarta el resto. */
export function toLatin1(text: string): string {
  return text.replace(/ /g, " ").replace(/[^\x20-\x7e\xa1-\xff]/g, "");
}

export async function buildAdminPdf(report: AdminReport): Promise<jsPDF> {
  const { jsPDF: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const text = (value: string, x: number, y: number, align: "left" | "right" | "center" = "left") =>
    doc.text(toLatin1(value), x, y, { align });
  const right = PAGE_WIDTH - MARGIN;

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold").setFontSize(18);
  text("Ticketera", MARGIN, 22);
  doc.setFontSize(13);
  text(report.title, MARGIN, 30);
  doc.setFont("helvetica", "normal").setFontSize(10);
  text(report.generatedLabel, MARGIN, 36);

  let y = 48;
  const ensure = (height: number) => {
    if (y + height > BOTTOM) {
      doc.addPage();
      y = MARGIN + 5;
    }
  };

  for (const section of report.sections) {
    ensure(ROW_HEIGHT * 2);
    doc.setFont("helvetica", "bold").setFontSize(12);
    text(section.title, MARGIN, y);
    y += 3;
    doc.setDrawColor(200, 200, 200).line(MARGIN, y, right, y);
    y += ROW_HEIGHT - 1;
    doc.setFont("helvetica", "normal").setFontSize(10);
    for (const [label, value] of section.rows) {
      ensure(ROW_HEIGHT);
      text(label, MARGIN, y);
      text(value, right, y, "right");
      y += ROW_HEIGHT;
    }
    y += 5;
  }

  const total = doc.getNumberOfPages();
  doc.setFontSize(9);
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    text(`Pagina ${page} de ${total}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 10, "center");
  }
  return doc;
}

export async function downloadAdminReport(metrics: AdminMetrics): Promise<void> {
  const now = new Date();
  const doc = await buildAdminPdf(buildAdminReport(metrics, now));
  doc.save(reportFileName(now));
}

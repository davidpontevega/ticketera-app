// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildAdminPdf, toLatin1 } from "./admin-pdf";
import type { AdminReport } from "./admin-report.utils";

const report = (rows: number, title = "Resumen global"): AdminReport => ({
  title,
  generatedLabel: "Generado el 2026-10-12",
  sections: [
    {
      title: "Indicadores",
      rows: Array.from({ length: rows }, (_, i): [string, string] => [`Fila ${i}`, String(i)]),
    },
  ],
});

describe("buildAdminPdf", () => {
  it("genera titulo y pie", async () => {
    const doc = await buildAdminPdf(report(5));
    const out = doc.output();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(out).toContain("Resumen global");
    expect(out).toContain("Pagina 1 de 1");
  });

  it("pagina con muchas filas y numera con el total real", async () => {
    const doc = await buildAdminPdf(report(200));
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThan(1);
    expect(doc.output()).toContain(`Pagina ${pages} de ${pages}`);
  });

  it("no falla con texto fuera de Latin-1 y sin filas", async () => {
    await expect(buildAdminPdf(report(1, "Titulo … \u{1F389}"))).resolves.toBeDefined();
    await expect(buildAdminPdf(report(0))).resolves.toBeDefined();
  });
});

describe("toLatin1", () => {
  it("elimina caracteres no Latin-1 y normaliza U+00A0", () => {
    expect(toLatin1("a…b\u{1F389}c d ñ")).toBe("abc d ñ");
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminMetrics } from "../types/admin-metrics.types";
import { downloadAdminReport } from "../utils/admin-pdf";
import { AdminExportButton } from "./admin-export-button";

vi.mock("../utils/admin-pdf", () => ({ downloadAdminReport: vi.fn() }));

const metrics = {} as AdminMetrics;
const mockDownload = vi.mocked(downloadAdminReport);

describe("AdminExportButton", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("deshabilita durante la descarga y rehabilita sin alerta", async () => {
    let resolve!: () => void;
    mockDownload.mockReturnValue(new Promise<void>((r) => (resolve = r)));
    render(<AdminExportButton metrics={metrics} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.textContent).toContain("Generando...");
    resolve();
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("muestra alerta si falla y rehabilita", async () => {
    mockDownload.mockRejectedValue(new Error("x"));
    render(<AdminExportButton metrics={metrics} />);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
  });
});

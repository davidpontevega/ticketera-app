import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const action = vi.fn();
vi.mock("../actions/platform-settings.actions", () => ({
  updatePlatformFeeAction: (...args: unknown[]) => action(...args),
}));

const { PlatformFeeForm } = await import("./platform-fee-form");

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("PlatformFeeForm", () => {
  it("muestra el porcentaje vigente y la fecha", () => {
    render(<PlatformFeeForm feePercent={12.5} updatedAt={new Date("2026-10-14T10:00:00Z")} />);
    expect((screen.getByLabelText(/Porcentaje/) as HTMLInputElement).value).toBe("12.5");
    expect(screen.getByText(/Ultima actualizacion/)).toBeTruthy();
  });

  it("sin fila indica valor por defecto", () => {
    render(<PlatformFeeForm feePercent={10} updatedAt={null} />);
    expect(screen.getByText(/Valor por defecto/)).toBeTruthy();
  });

  it("muestra error de validacion", async () => {
    action.mockResolvedValue({ error: "Maximo 50" });
    render(<PlatformFeeForm feePercent={10} updatedAt={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Maximo 50");
  });

  it("muestra confirmacion al guardar", async () => {
    action.mockResolvedValue({ success: true });
    render(<PlatformFeeForm feePercent={10} updatedAt={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect((await screen.findByRole("status")).textContent).toContain("Comision actualizada");
  });
});

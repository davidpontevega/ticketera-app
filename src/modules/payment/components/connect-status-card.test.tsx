import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const action = vi.fn();
vi.mock("../actions/connect.actions", () => ({
  startConnectOnboardingAction: (...args: unknown[]) => action(...args),
}));

const { ConnectStatusCard } = await import("./connect-status-card");

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("ConnectStatusCard", () => {
  it("not_started muestra el boton para conectar", () => {
    render(<ConnectStatusCard status="not_started" enabled />);
    expect(screen.getByText("No iniciado")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Conectar con Stripe" })).toBeTruthy();
  });

  it("pending muestra continuar onboarding", () => {
    render(<ConnectStatusCard status="pending" enabled />);
    expect(screen.getByRole("button", { name: "Continuar onboarding" })).toBeTruthy();
  });

  it("complete no muestra boton", () => {
    render(<ConnectStatusCard status="complete" enabled />);
    expect(screen.getByText("Listo")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("flag apagado muestra el mensaje y no el boton", () => {
    render(<ConnectStatusCard status="not_started" enabled={false} />);
    expect(screen.getByText("Stripe Connect desactivado")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("muestra el error devuelto por la action", async () => {
    action.mockResolvedValue({ error: "Fallo Stripe" });
    render(<ConnectStatusCard status="not_started" enabled />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar con Stripe" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Fallo Stripe");
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const retryEventRefundsAction = vi.fn();
vi.mock("../actions/refund.actions", () => ({
  retryEventRefundsAction: (...args: unknown[]) => retryEventRefundsAction(...args),
}));

import { RetryRefundsButton } from "./retry-refunds-button";

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

function click() {
  fireEvent.click(screen.getByRole("button", { name: "Reintentar reembolsos" }));
}

describe("RetryRefundsButton", () => {
  it("envia el eventId y no muestra mensaje al inicio", async () => {
    retryEventRefundsAction.mockResolvedValue({ status: "done", refunds: { total: 1, refunded: 1, failed: 0 } });
    render(<RetryRefundsButton eventId="event-1" />);
    expect(screen.queryByRole("status")).toBeNull();

    click();

    await waitFor(() => expect(retryEventRefundsAction).toHaveBeenCalled());
    const formData = retryEventRefundsAction.mock.calls[0][1] as FormData;
    expect(formData.get("eventId")).toBe("event-1");
  });

  it("se deshabilita mientras esta pendiente", async () => {
    let resolve!: (v: unknown) => void;
    retryEventRefundsAction.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<RetryRefundsButton eventId="event-1" />);

    click();

    await waitFor(() => expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true));
    resolve({ status: "error", message: "x" });
    await waitFor(() => expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false));
  });

  it.each([
    [{ status: "done", refunds: { total: 3, refunded: 3, failed: 0 } }, "Reembolsadas 3 de 3 ordenes."],
    [{ status: "done", refunds: { total: 3, refunded: 2, failed: 1 } }, "1 fallaron"],
    [{ status: "done", refunds: { total: 0, refunded: 0, failed: 0 } }, "No hay ordenes pendientes"],
    [{ status: "error", message: "No se encontro el evento cancelado" }, "No se encontro el evento cancelado"],
  ])("muestra el resultado %j", async (state, text) => {
    retryEventRefundsAction.mockResolvedValue(state);
    render(<RetryRefundsButton eventId="event-1" />);

    click();

    expect((await screen.findByRole("status")).textContent).toContain(text);
  });
});

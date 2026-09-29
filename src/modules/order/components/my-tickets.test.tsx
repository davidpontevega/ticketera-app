import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/modules/auth";

import { useOrderStore } from "../store/order.store";
import { MyTickets } from "./my-tickets";

const replace = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/my-tickets",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

beforeEach(() => {
  replace.mockClear();
  currentSearch = "";
  useAuthStore.setState({ user: null });
  useOrderStore.setState({ orders: [], lastOrderNumber: null });
});

afterEach(cleanup);

describe("MyTickets", () => {
  it("redirects to the login when there is no session", () => {
    render(<MyTickets />);
    expect(replace).toHaveBeenCalledWith("/login?redirect=%2Fmy-tickets");
  });

  it("shows the tabs with counters and the first ticket", () => {
    useAuthStore.setState({ user: { fullName: "Maria Perez", email: "maria@example.com" } });
    render(<MyTickets />);
    expect(screen.getByRole("tab", { name: "Proximas (2)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Pasadas (1)" })).toBeTruthy();
    expect(screen.getByText("Entrada 1 de 2")).toBeTruthy();
  });

  it("moves between the tickets of an order", () => {
    useAuthStore.setState({ user: { fullName: "Maria Perez", email: "maria@example.com" } });
    render(<MyTickets />);
    const next = screen.getByRole("button", { name: "Entrada siguiente" });
    fireEvent.click(next);
    expect(screen.getByText("Entrada 2 de 2")).toBeTruthy();
    expect(next.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Entrada anterior" }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("preselects the order from the url and shows the past tab when needed", () => {
    useAuthStore.setState({ user: { fullName: "Maria Perez", email: "maria@example.com" } });
    currentSearch = "order=TK-23105";
    render(<MyTickets />);
    expect(screen.getByRole("tab", { name: "Pasadas (1)" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByText("Finalizado")).toBeTruthy();
  });
});

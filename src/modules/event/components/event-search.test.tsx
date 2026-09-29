import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EVENTS_MOCK } from "../mocks/event.mock";
import { EventSearch } from "./event-search";

const replace = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

beforeEach(() => {
  replace.mockClear();
  currentSearch = "";
});

afterEach(cleanup);

describe("EventSearch", () => {
  it("shows every event without filters", () => {
    render(<EventSearch events={EVENTS_MOCK} />);
    expect(screen.getByText(`${EVENTS_MOCK.length} eventos`)).toBeTruthy();
  });

  it("reads the filters from the url", () => {
    currentSearch = "categories=theater";
    render(<EventSearch events={EVENTS_MOCK} />);
    expect(screen.getByText("2 eventos")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Quitar filtro Teatro" })).toBeTruthy();
  });

  it("writes the selected category to the url", () => {
    render(<EventSearch events={EVENTS_MOCK} />);
    fireEvent.click(screen.getByRole("button", { name: "Conciertos", pressed: false }));
    expect(replace).toHaveBeenCalledWith("/events?categories=concerts", { scroll: false });
  });

  it("submits the text search", () => {
    render(<EventSearch events={EVENTS_MOCK} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar eventos" }), {
      target: { value: "opera" },
    });
    fireEvent.submit(screen.getByRole("search"));
    expect(replace).toHaveBeenCalledWith("/events?q=opera", { scroll: false });
  });

  it("shows the empty state and clears filters", () => {
    currentSearch = "categories=theater&price=over-300&sort=price";
    render(<EventSearch events={EVENTS_MOCK} />);
    expect(screen.getByText("No encontramos eventos con esos filtros")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(replace).toHaveBeenCalledWith("/events?sort=price", { scroll: false });
  });
});

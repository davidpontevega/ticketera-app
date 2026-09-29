import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EVENTS_MOCK } from "../mocks/event.mock";
import { formatEventDateBadge, getEventCategoryOption, getEventHref } from "../utils/event.utils";
import { EventCard } from "./event-card";

const soldOutEvent = EVENTS_MOCK.find((event) => event.availability === "sold-out")!;
const availableEvent = EVENTS_MOCK.find((event) => event.availability === "available")!;

afterEach(cleanup);

describe("EventCard", () => {
  it("renders 'Agotado' for a sold-out event", () => {
    render(<EventCard event={soldOutEvent} />);

    expect(screen.getByText("Agotado")).toBeTruthy();
  });

  it("renders 'Disponible' and a favorite button for an available event", () => {
    render(<EventCard event={availableEvent} />);

    expect(screen.getByText("Disponible")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Agregar a favoritos" })).toBeTruthy();
  });

  it("renders the category label and the date badge day", () => {
    render(<EventCard event={availableEvent} />);

    const categoryLabel = getEventCategoryOption(availableEvent.category).label;
    const { day } = formatEventDateBadge(availableEvent.date);

    expect(screen.getByText(categoryLabel)).toBeTruthy();
    expect(screen.getByText(day)).toBeTruthy();
  });

  it("links to the event detail page", () => {
    render(<EventCard event={availableEvent} />);

    const link = screen.getByRole("link", { name: availableEvent.title });
    expect(link.getAttribute("href")).toBe(getEventHref(availableEvent.slug));
  });
});

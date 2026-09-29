import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { EVENTS_MOCK } from "@/modules/event/mocks/event.mock";

import { getVenueLayout } from "../utils/ticket.utils";
import { VenueMap, type VenueMapProps } from "./venue-map";

// jsdom no soporta las transformaciones de la libreria de zoom: se reemplaza por un contenedor simple.
vi.mock("react-zoom-pan-pinch", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    TransformWrapper: forwardRef(function TransformWrapper(
      { children }: { children: ReactNode },
      ref,
    ) {
      useImperativeHandle(ref, () => ({
        zoomToElement: vi.fn(),
        resetTransform: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
      }));
      return <div>{children}</div>;
    }),
    TransformComponent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query })) as never;
});

afterEach(cleanup);

const layout = getVenueLayout(EVENTS_MOCK[0]); // Bad Bunny, estadio
const occidente = layout.zones.find((zone) => zone.id === "occidente")!;
const available = occidente.seats.filter((seat) => seat.status === "available");
const occupied = occidente.seats.find((seat) => seat.status === "occupied")!;

function renderMap(props: Partial<VenueMapProps> = {}) {
  const handlers = {
    onSelectZone: vi.fn(),
    onToggleSeat: vi.fn(),
    onBack: vi.fn(),
  };
  render(
    <VenueMap
      layout={layout}
      activeZoneId={null}
      selectedSeatIds={[]}
      maxReached={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("VenueMap", () => {
  it("selects a zone with click and Enter, but not a sold out one", () => {
    const { onSelectZone } = renderMap();
    fireEvent.click(screen.getByRole("button", { name: /^Tribuna Occidente,/ }));
    fireEvent.keyDown(screen.getByRole("button", { name: /^Campo General,/ }), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: /^Campo VIP,/ }));
    expect(onSelectZone.mock.calls).toEqual([["occidente"], ["general"]]);
  });

  it("shows the seats of the active zone and toggles them", () => {
    const { onToggleSeat } = renderMap({ activeZoneId: "occidente" });
    const seat = available[0];
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: new RegExp(`^Fila ${seat.row}, asiento ${seat.number},`),
      }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: new RegExp(`^Fila ${occupied.row}, asiento ${occupied.number},`),
      }),
    );
    expect(onToggleSeat).toHaveBeenCalledTimes(1);
    expect(onToggleSeat).toHaveBeenCalledWith("occidente", seat.id);
    expect(screen.getByRole("button", { name: "Volver al mapa" })).toBeTruthy();
  });

  it("uses a single tab stop and moves with the arrow keys", () => {
    renderMap({ activeZoneId: "occidente" });
    const seats = screen.getAllByRole("checkbox");
    expect(seats.filter((seat) => seat.getAttribute("tabindex") === "0")).toHaveLength(1);
    const first = seats.find((seat) => seat.getAttribute("tabindex") === "0")!;
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).not.toBe(first);
    expect(document.activeElement?.getAttribute("role")).toBe("checkbox");
  });

  it("disables unselected seats when the max is reached", () => {
    const { onToggleSeat } = renderMap({
      activeZoneId: "occidente",
      selectedSeatIds: [available[0].id],
      maxReached: true,
    });
    const other = available[1];
    const seat = screen.getByRole("checkbox", {
      name: new RegExp(`^Fila ${other.row}, asiento ${other.number},`),
    });
    expect(seat.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(seat);
    expect(onToggleSeat).not.toHaveBeenCalled();
  });
});

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { VenueForEdit, VenueZoneDto } from "../types/venue.types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("../actions/venue.actions", () => ({
  createZoneAction: vi.fn(),
  updateZoneAction: vi.fn(),
  deleteZoneAction: vi.fn(),
}));
// jsdom no soporta las transformaciones de la libreria de zoom del mapa.
vi.mock("react-zoom-pan-pinch", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    TransformWrapper: forwardRef(function TransformWrapper({ children }: { children: ReactNode }, ref) {
      useImperativeHandle(ref, () => ({ zoomToElement: vi.fn(), resetTransform: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn() }));
      return <div>{children}</div>;
    }),
    TransformComponent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

const { VenueZoneEditor } = await import("./venue-zone-editor");

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query })) as never;
});
afterEach(cleanup);

const zone = (overrides: Partial<VenueZoneDto>): VenueZoneDto => ({
  id: "22222222-2222-4222-8222-222222222222",
  name: "Platea",
  kind: "numbered",
  capacity: 6,
  rows: 2,
  seatsPerRow: 3,
  inUse: false,
  usedByEvents: 0,
  ...overrides,
});

const venue = (zones: VenueZoneDto[]): VenueForEdit => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Teatro",
  address: "Av. 1",
  city: "Lima",
  latitude: null,
  longitude: null,
  zoneCount: zones.length,
  capacity: 0,
  eventCount: 0,
  isOwn: true,
  zones,
});

describe("VenueZoneEditor", () => {
  it("sin zonas muestra el estado vacio y no dibuja el mapa", () => {
    render(<VenueZoneEditor venue={venue([])} />);
    expect(screen.getByText("Sin zonas")).toBeTruthy();
    expect(screen.queryByLabelText("Mapa del recinto")).toBeNull();
  });

  it("zona en uso: sin boton eliminar y edicion solo de nombre", () => {
    const used = zone({ inUse: true, usedByEvents: 1 });
    const free = zone({ id: "33333333-3333-4333-8333-333333333333", name: "General", kind: "general", capacity: 300, rows: 0, seatsPerRow: 0 });
    render(<VenueZoneEditor venue={venue([used, free])} />);

    expect(screen.queryByRole("button", { name: "Eliminar Platea" })).toBeNull();
    expect(screen.getByRole("button", { name: "Eliminar General" })).toBeTruthy();
    expect(screen.getByLabelText("Mapa del recinto")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Editar Platea" }));
    expect(screen.getByText(/solo se puede cambiar el nombre/)).toBeTruthy();
    expect(screen.queryByLabelText("Tipo de zona")).toBeNull();
  });
});

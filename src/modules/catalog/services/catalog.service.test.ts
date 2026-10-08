import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EventEntity } from "@/modules/event";
import { buildVenueLayoutFromTiers } from "@/modules/ticket/utils/tier-layout.utils";

import { getCatalogEvent, listCatalogEvents } from "./catalog.service";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

const listPublishedEvents = vi.fn();
const getPublishedEvent = vi.fn();
const getTakenInventoryBySlugs = vi.fn();

vi.mock("@/modules/event/services/event.service", () => ({
  listPublishedEvents: () => listPublishedEvents(),
  getPublishedEvent: (slug: string) => getPublishedEvent(slug),
}));
vi.mock("@/modules/order/services/availability.service", () => ({
  getTakenInventoryBySlugs: (...args: unknown[]) => getTakenInventoryBySlugs(...args),
}));

function makePublished(slug: string) {
  const event = { id: slug, slug, category: "concerts", availability: "available" } as EventEntity;
  // Tier unico de 10 entradas (no coincide con plantilla -> admision general).
  const layout = buildVenueLayoutFromTiers(event, [
    { id: `${slug}-t`, name: "Unico", price: 50, totalStock: 10 },
  ]);
  return { event, layout, tierId: `${slug}-t` };
}

const sold = (zoneId: string, quantity: number) => ({ seats: {}, sold: { [zoneId]: quantity } });

beforeEach(() => vi.clearAllMocks());

describe("listCatalogEvents", () => {
  it("deriva sold-out / few-left / available con una sola consulta a orders", async () => {
    const a = makePublished("a");
    const b = makePublished("b");
    const c = makePublished("c");
    listPublishedEvents.mockResolvedValue([a, b, c]);
    getTakenInventoryBySlugs.mockResolvedValue({
      a: sold(a.tierId, 10),
      b: sold(b.tierId, 8),
    });

    const list = await listCatalogEvents();

    expect(list.map((item) => item.event.availability)).toEqual(["sold-out", "few-left", "available"]);
    expect(getTakenInventoryBySlugs).toHaveBeenCalledTimes(1);
    expect(getTakenInventoryBySlugs.mock.calls[0][1]).toEqual(["a", "b", "c"]);
  });

  it("sin eventos no consulta orders", async () => {
    listPublishedEvents.mockResolvedValue([]);
    expect(await listCatalogEvents()).toEqual([]);
    expect(getTakenInventoryBySlugs).not.toHaveBeenCalled();
  });
});

describe("getCatalogEvent", () => {
  it("null si no esta publicado", async () => {
    getPublishedEvent.mockResolvedValue(null);
    expect(await getCatalogEvent("x")).toBeNull();
    expect(getTakenInventoryBySlugs).not.toHaveBeenCalled();
  });

  it("aplica el inventario tomado al layout y a la disponibilidad", async () => {
    const a = makePublished("a");
    getPublishedEvent.mockResolvedValue(a);
    getTakenInventoryBySlugs.mockResolvedValue({ a: sold(a.tierId, 10) });

    const result = await getCatalogEvent("a");

    expect(result?.event.availability).toBe("sold-out");
    expect(result?.layout.zones[0].remaining).toBe(0);
  });
});

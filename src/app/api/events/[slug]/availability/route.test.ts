import { beforeEach, describe, expect, it, vi } from "vitest";

const { getEventAvailability } = vi.hoisted(() => ({ getEventAvailability: vi.fn() }));

vi.mock("@/modules/order/services/availability.service", () => ({ getEventAvailability }));

import { GET } from "./route";

const call = (slug: string) =>
  GET(new Request(`http://localhost/api/events/${slug}/availability`), {
    params: Promise.resolve({ slug }),
  });

describe("GET /api/events/[slug]/availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 200 with the snapshot and resolves the slug from params", async () => {
    const snapshot = { tiers: [{ id: "t1", remaining: 5 }] };
    getEventAvailability.mockResolvedValue(snapshot);

    const response = await call("rock-fest");

    expect(getEventAvailability).toHaveBeenCalledWith("rock-fest");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(snapshot);
  });

  it("returns 404 when the event does not exist", async () => {
    getEventAvailability.mockResolvedValue(null);

    const response = await call("nope");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Evento no encontrado" });
  });

  it("returns 500 when the service throws", async () => {
    getEventAvailability.mockRejectedValue(new Error("db down"));

    const response = await call("rock-fest");

    expect(response.status).toBe(500);
  });
});

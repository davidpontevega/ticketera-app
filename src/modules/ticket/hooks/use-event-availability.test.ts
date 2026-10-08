import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchEventAvailability } from "../services/availability.service";
import { EVENTS_MOCK } from "@/modules/event/mocks/event.mock";

import { getVenueLayout } from "../utils/ticket.utils";
import { useEventAvailability } from "./use-event-availability";

vi.mock("../services/availability.service", () => ({ fetchEventAvailability: vi.fn() }));

const mockedFetch = vi.mocked(fetchEventAvailability);
const layout = getVenueLayout(EVENTS_MOCK.find((e) => e.slug === "bad-bunny-world-tour")!);
const general = layout.zones.find((zone) => zone.seating === "general")!;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useEventAvailability", () => {
  it("returns the base layout before the snapshot resolves", () => {
    mockedFetch.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEventAvailability("evt", layout));
    expect(result.current).toBe(layout);
  });

  it("applies the snapshot once resolved", async () => {
    mockedFetch.mockResolvedValue({ seats: {}, sold: { [general.id]: 100 } });
    const { result } = renderHook(() => useEventAvailability("evt", layout));
    await waitFor(() => expect(result.current).not.toBe(layout));
    const zone = result.current.zones.find((z) => z.id === general.id);
    expect(zone?.remaining).toBe(400);
  });

  it("does not throw on network error and keeps the base layout", async () => {
    mockedFetch.mockRejectedValue(new Error("Network Error"));
    const { result } = renderHook(() => useEventAvailability("evt", layout));
    await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
    expect(result.current).toBe(layout);
  });

  it("refetches on window focus", async () => {
    mockedFetch.mockResolvedValue({ seats: {}, sold: {} });
    renderHook(() => useEventAvailability("evt", layout));
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(2));
  });
});

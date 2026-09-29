import { beforeEach, describe, expect, it } from "vitest";

import { TICKET_MAX_PER_ZONE } from "../constants/ticket.constants";
import { useTicketSelectionStore } from "./ticket-selection.store";

const { getState } = useTicketSelectionStore;

describe("useTicketSelectionStore", () => {
  beforeEach(() => {
    getState().reset();
  });

  it("startSelection resets the selection when the event changes", () => {
    getState().startSelection("1");
    getState().setQuantity("general", 2);
    getState().startSelection("2");
    const state = getState();
    expect(state.eventId).toBe("2");
    expect(state.quantities).toEqual({});
    expect(state.activeZoneId).toBeNull();
  });

  it("startSelection keeps the selection for the same event", () => {
    getState().startSelection("1");
    getState().setQuantity("general", 2);
    getState().startSelection("1");
    expect(getState().quantities).toEqual({ general: 2 });
  });

  it("selectZone sets the active zone", () => {
    getState().selectZone("occidente");
    expect(getState().activeZoneId).toBe("occidente");
  });

  it("setQuantity clamps between 0 and the max and activates the zone", () => {
    getState().setQuantity("general", 99);
    expect(getState().quantities.general).toBe(TICKET_MAX_PER_ZONE);
    expect(getState().activeZoneId).toBe("general");
    getState().setQuantity("general", -1);
    expect(getState().quantities.general).toBe(0);
  });

  it("toggleSeat adds and removes seats", () => {
    getState().toggleSeat("occidente", "occidente-A-1");
    getState().toggleSeat("occidente", "occidente-A-2");
    expect(getState().seatIds.occidente).toEqual(["occidente-A-1", "occidente-A-2"]);
    getState().toggleSeat("occidente", "occidente-A-1");
    expect(getState().seatIds.occidente).toEqual(["occidente-A-2"]);
  });

  it("toggleSeat does not exceed the max per zone", () => {
    for (let number = 1; number <= TICKET_MAX_PER_ZONE + 2; number += 1) {
      getState().toggleSeat("occidente", `occidente-A-${number}`);
    }
    expect(getState().seatIds.occidente).toHaveLength(TICKET_MAX_PER_ZONE);
  });

  it("setSeats replaces the seats of a zone and respects the max", () => {
    getState().toggleSeat("occidente", "occidente-A-1");
    getState().setSeats("occidente", ["occidente-B-1", "occidente-B-2"]);
    expect(getState().seatIds.occidente).toEqual(["occidente-B-1", "occidente-B-2"]);
    const many = Array.from({ length: 9 }, (_, index) => `occidente-C-${index + 1}`);
    getState().setSeats("occidente", many);
    expect(getState().seatIds.occidente).toHaveLength(TICKET_MAX_PER_ZONE);
    expect(getState().activeZoneId).toBe("occidente");
  });
});

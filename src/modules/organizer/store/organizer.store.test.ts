import { beforeEach, describe, expect, it } from "vitest";

import { ORGANIZER_EVENTS_MOCK } from "../mocks/organizer.mock";
import { useOrganizerStore } from "./organizer.store";

const { getState, setState } = useOrganizerStore;

describe("useOrganizerStore", () => {
  beforeEach(() => {
    setState({ events: [] });
    localStorage.clear();
  });

  it("inserts and replaces events by id", () => {
    const event = { ...ORGANIZER_EVENTS_MOCK[3], ownerEmail: "maria@example.com" };
    getState().saveEvent(event);
    getState().saveEvent({ ...event, name: "Feria renombrada" });
    expect(getState().events).toHaveLength(1);
    expect(getState().events[0].name).toBe("Feria renombrada");
  });

  it("persists in localStorage", () => {
    getState().saveEvent({ ...ORGANIZER_EVENTS_MOCK[3], ownerEmail: "maria@example.com" });
    expect(localStorage.getItem("ticketera-organizer-events")).toContain("demo-feria-familiar");
  });
});

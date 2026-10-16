import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
vi.mock("@/modules/user", () => ({
  ORGANIZER_AREA_ROLES: ["super_admin", "admin", "organizer"],
  requireRole: (...args: unknown[]) => requireRole(...args),
}));

const checkInTicket = vi.fn();
vi.mock("../services/organizer-check-in.service", () => ({
  checkInTicket: (...args: unknown[]) => checkInTicket(...args),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

const { checkInTicketAction } = await import("./check-in.actions");

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const VIEWER = { id: "organizer-1", role: "organizer" };
const TICKET = { code: "TK-1A2B3C4D-01", zoneName: "General", seatLabel: null, attendeeName: "", sequence: 1 };

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

const run = (entries: Record<string, string>) =>
  checkInTicketAction({ status: "idle" }, form(entries));

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(VIEWER);
  checkInTicket.mockResolvedValue({ result: "valid", ticket: TICKET });
});

describe("checkInTicketAction", () => {
  it("llama requireRole con ORGANIZER_AREA_ROLES y si rechaza no toca el servicio", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(run({ eventId: EVENT_ID, code: "TK-1A2B3C4D-01" })).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith(["super_admin", "admin", "organizer"]);
    expect(checkInTicket).not.toHaveBeenCalled();
  });

  it("payload invalido devuelve error sin llamar al servicio", async () => {
    const result = await run({ eventId: EVENT_ID, code: "xx" });
    expect(result).toEqual({ status: "error", message: "Codigo invalido" });
    expect(checkInTicket).not.toHaveBeenCalled();
  });

  it("valid: normaliza el codigo, pasa el viewer de requireRole y revalida", async () => {
    const result = await run({ eventId: EVENT_ID, code: " tk-1a2b3c4d-01 " });
    expect(result).toEqual({ status: "valid", ticket: TICKET });
    expect(checkInTicket).toHaveBeenCalledWith({ eventId: EVENT_ID, code: "TK-1A2B3C4D-01" }, VIEWER);
    expect(revalidatePath).toHaveBeenCalledWith(`/organizer/events/${EVENT_ID}/check-in`);
  });

  it("already-used conserva checkedInAt, sin revalidar", async () => {
    checkInTicket.mockResolvedValue({ result: "already-used", checkedInAt: "2026-10-14T10:00:00.000Z" });
    expect(await run({ eventId: EVENT_ID, code: "TK-1A2B3C4D-01" })).toEqual({
      status: "already-used",
      checkedInAt: "2026-10-14T10:00:00.000Z",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["not-found", "wrong-event", "not-valid", "cancelled"])("%s mapea a status", async (result) => {
    checkInTicket.mockResolvedValue({ result });
    expect(await run({ eventId: EVENT_ID, code: "TK-1A2B3C4D-01" })).toEqual({ status: result });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

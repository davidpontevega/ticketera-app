import { describe, expect, it } from "vitest";

import { EVENTS_MOCK } from "@/modules/event/mocks/event.mock";

import { CHECKOUT_FORM_DEFAULT } from "../schemas/checkout.schema";
import {
  buildEventCalendarFile,
  buildCheckoutSessionInput,
  getConfirmationStatus,
  toOrderFromRecord,
  generateOrderNumber,
  getCheckoutFieldId,
  getCheckoutPrefill,
  getOrderTickets,
  isOrderUpcoming,
  setCheckoutField,
  splitOrdersByTime,
  toOrderEventSnapshot,
  toUserOrders,
  getOrderNumber,
  toTicketRows,
} from "./order.utils";
import type { OrderRecord } from "../db/order.table";
import type { Order } from "../types/order.types";

describe("generateOrderNumber", () => {
  it("builds TK- plus 5 digits", () => {
    expect(generateOrderNumber(() => 0)).toBe("TK-10000");
    expect(generateOrderNumber(() => 0.99999)).toBe("TK-99999");
    expect(generateOrderNumber()).toMatch(/^TK-\d{5}$/);
  });
});

describe("buildEventCalendarFile", () => {
  it("builds an ics event in UTC with title and location", () => {
    const event = EVENTS_MOCK[0]; // Bad Bunny, 2026-11-14T21:00:00-05:00
    const ics = buildEventCalendarFile(event, new Date("2026-09-29T00:00:00Z"));
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("BEGIN:VEVENT");
    expect(lines).toContain("DTSTART:20261115T020000Z");
    expect(lines).toContain("DTEND:20261115T050000Z");
    expect(lines).toContain("SUMMARY:Bad Bunny - World Tour");
    expect(lines).toContain(
      "LOCATION:Estadio Nacional\\, Av. Jose Diaz s/n\\, Cercado de Lima\\, Lima",
    );
    expect(lines.at(-1)).toBe("END:VCALENDAR");
  });
});

describe("getCheckoutFieldId", () => {
  it("builds a DOM friendly id", () => {
    expect(getCheckoutFieldId("email")).toBe("checkout-email");
  });
});

describe("setCheckoutField", () => {
  it("updates a field without mutating", () => {
    const withEmail = setCheckoutField(CHECKOUT_FORM_DEFAULT, "email", "a@b.com");
    expect(withEmail.email).toBe("a@b.com");
    expect(CHECKOUT_FORM_DEFAULT.email).toBe("");
    expect(setCheckoutField(withEmail, "acceptedTerms", true).acceptedTerms).toBe(true);
  });
});

describe("buildCheckoutSessionInput", () => {
  it("trims the buyer, strips phone spaces and drops extra fields", () => {
    const values = {
      ...CHECKOUT_FORM_DEFAULT,
      fullName: "  Ana Torres ",
      email: " ana@test.pe ",
      documentType: "dni" as const,
      documentNumber: " 12345678 ",
      phone: "987 654 321",
      acceptedTerms: true,
    };
    const selection = { quantities: { general: 2 }, seatIds: { general: [] } };
    expect(buildCheckoutSessionInput("bad-bunny", values, selection)).toEqual({
      eventSlug: "bad-bunny",
      quantities: { general: 2 },
      seatIds: { general: [] },
      buyer: {
        fullName: "Ana Torres",
        email: "ana@test.pe",
        documentType: "dni",
        documentNumber: "12345678",
        phone: "987654321",
      },
    });
  });
});

const RECORD: OrderRecord = {
  id: "abcdef12-3456-7890-abcd-ef1234567890",
  userId: null,
  eventId: null,
  eventSlug: EVENTS_MOCK[0].slug,
  buyer: {
    fullName: "Ana Torres",
    email: "ana@test.pe",
    documentType: "dni",
    documentNumber: "12345678",
    phone: "987654321",
  },
  lines: [
    { zoneId: "general", zoneName: "Campo General", quantity: 1, unitPrice: 450, amount: 450, seatLabels: [] },
  ],
  status: "paid",
  totalAmount: "450.00",
  stripePaymentIntentId: null,
  stripeCheckoutSessionId: "cs_test_1",
  refundedAt: null,
  refundedBy: null,
  stripeRefundId: null,
  platformFeeAmount: null,
  organizerNetAmount: null,
  platformFeePercent: null,
  createdAt: new Date("2026-10-01T10:00:00Z"),
  updatedAt: new Date("2026-10-01T10:00:00Z"),
};

describe("toOrderFromRecord", () => {
  it("builds a stable number, numeric total and copies buyer and lines", () => {
    const order = toOrderFromRecord(RECORD, EVENTS_MOCK[0]);
    expect(order.number).toBe("TK-ABCDEF12");
    expect(order.total).toBe(450);
    expect(order.buyer).toBe(RECORD.buyer);
    expect(order.lines).toBe(RECORD.lines);
    expect(order).not.toHaveProperty("accountEmail");
    expect(order.event.slug).toBe(EVENTS_MOCK[0].slug);
    expect(order.createdAt).toBe("2026-10-01T10:00:00.000Z");
  });

  it("accepts a serialized date string", () => {
    const serialized = { ...RECORD, createdAt: "2026-10-01T10:00:00.000Z" as unknown as Date };
    expect(toOrderFromRecord(serialized, EVENTS_MOCK[0]).createdAt).toBe(
      "2026-10-01T10:00:00.000Z",
    );
  });
});

describe("getOrderNumber", () => {
  it("uses the first 8 hex of the id, uppercased", () => {
    expect(getOrderNumber(RECORD.id)).toBe("TK-ABCDEF12");
  });
});

describe("toTicketRows", () => {
  const line = { unitPrice: 1, amount: 1 };
  it("builds consecutive rows across lines with seats and attendee", () => {
    const rows = toTicketRows({
      ...RECORD,
      lines: [
        { ...line, zoneId: "g", zoneName: "General", quantity: 1, seatLabels: [] },
        { ...line, zoneId: "o", zoneName: "Oriente", quantity: 2, seatLabels: ["C12", "C13"] },
      ],
    });
    expect(rows).toEqual([
      { orderId: RECORD.id, sequence: 1, qrCode: "TK-ABCDEF12-01", zoneName: "General", seatLabel: null, attendeeName: "Ana Torres" },
      { orderId: RECORD.id, sequence: 2, qrCode: "TK-ABCDEF12-02", zoneName: "Oriente", seatLabel: "C12", attendeeName: "Ana Torres" },
      { orderId: RECORD.id, sequence: 3, qrCode: "TK-ABCDEF12-03", zoneName: "Oriente", seatLabel: "C13", attendeeName: "Ana Torres" },
    ]);
  });

  it("returns [] when quantity is 0", () => {
    const lines = [{ ...line, zoneId: "g", zoneName: "General", quantity: 0, seatLabels: [] }];
    expect(toTicketRows({ ...RECORD, lines })).toEqual([]);
  });
});

describe("getConfirmationStatus", () => {
  const slug = EVENTS_MOCK[0].slug;
  it("returns not-found for null or another event", () => {
    expect(getConfirmationStatus(null, slug)).toBe("not-found");
    expect(getConfirmationStatus(RECORD, "otro-evento")).toBe("not-found");
  });

  it("returns the record status otherwise", () => {
    for (const status of ["pending", "paid", "failed", "cancelled"] as const) {
      expect(getConfirmationStatus({ ...RECORD, status }, slug)).toBe(status);
    }
  });
});

const NOW = new Date("2026-09-29T12:00:00-05:00");
const makeOrder = (number: string, date: string): Order => ({
  ...toOrderFromRecord(RECORD, EVENTS_MOCK[0]),
  number,
  event: { ...toOrderEventSnapshot(EVENTS_MOCK[0]), date },
});
const demoOrders = [
  makeOrder("TK-24817", "2026-10-15T20:00:00-05:00"),
  makeOrder("TK-24790", "2026-11-20T20:00:00-05:00"),
  makeOrder("TK-23105", "2026-03-01T20:00:00-05:00"),
];

describe("toOrderEventSnapshot", () => {
  it("copies only the fields the order needs", () => {
    const snapshot = toOrderEventSnapshot(EVENTS_MOCK[0]);
    expect(Object.keys(snapshot).sort()).toEqual(
      ["address", "category", "city", "date", "id", "imageUrl", "slug", "title", "venue"].sort(),
    );
    expect(snapshot.title).toBe(EVENTS_MOCK[0].title);
  });
});

describe("getOrderTickets", () => {
  it("builds one ticket per quantity with sequential codes and seats", () => {
    const order: Order = {
      ...demoOrders[0],
      number: "TK-11111",
      lines: [
        {
          zoneId: "general",
          zoneName: "Campo General",
          quantity: 1,
          unitPrice: 450,
          amount: 450,
          seatLabels: [],
        },
        {
          zoneId: "oriente",
          zoneName: "Tribuna Oriente",
          quantity: 2,
          unitPrice: 320,
          amount: 640,
          seatLabels: ["C12", "C13"],
        },
      ],
    };
    expect(getOrderTickets(order)).toEqual([
      { code: "TK-11111-01", index: 1, total: 3, zoneName: "Campo General", seatLabel: null },
      { code: "TK-11111-02", index: 2, total: 3, zoneName: "Tribuna Oriente", seatLabel: "C12" },
      { code: "TK-11111-03", index: 3, total: 3, zoneName: "Tribuna Oriente", seatLabel: "C13" },
    ]);
  });
});

describe("splitOrdersByTime", () => {
  it("separates upcoming (ascending) and past (descending)", () => {
    const { upcoming, past } = splitOrdersByTime(demoOrders, NOW);
    expect(upcoming.map((order) => order.number)).toEqual(["TK-24817", "TK-24790"]);
    expect(past.map((order) => order.number)).toEqual(["TK-23105"]);
    expect(isOrderUpcoming(demoOrders[2], NOW)).toBe(false);
  });
});

describe("toUserOrders", () => {
  const rec = (id: string, eventSlug: string): OrderRecord => ({ ...RECORD, id, eventSlug });

  it("maps known events and counts unknown ones", () => {
    const result = toUserOrders(
      [rec("aaaaaaaa-1", EVENTS_MOCK[0].slug), rec("bbbbbbbb-2", "gone-event")],
      EVENTS_MOCK,
    );
    expect(result.orders.map((order) => order.number)).toEqual(["TK-AAAAAAAA"]);
    expect(result.orders[0].event.slug).toBe(EVENTS_MOCK[0].slug);
    expect(result.unavailableCount).toBe(1);
  });

  it("returns empty for no records", () => {
    expect(toUserOrders([], EVENTS_MOCK)).toEqual({ orders: [], unavailableCount: 0 });
  });

  it("keeps the input order", () => {
    const result = toUserOrders(
      [rec("cccccccc-3", EVENTS_MOCK[1].slug), rec("dddddddd-4", EVENTS_MOCK[0].slug)],
      EVENTS_MOCK,
    );
    expect(result.orders.map((order) => order.number)).toEqual(["TK-CCCCCCCC", "TK-DDDDDDDD"]);
  });
});

describe("getCheckoutPrefill", () => {
  it("returns nothing without a user", () => {
    expect(getCheckoutPrefill(null)).toEqual({});
  });

  it("uses the account name and email", () => {
    expect(getCheckoutPrefill({ fullName: "Ana Torres", email: "ana@test.pe" })).toEqual({
      fullName: "Ana Torres",
      email: "ana@test.pe",
    });
  });
});

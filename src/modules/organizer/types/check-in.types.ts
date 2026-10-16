export interface CheckInTicket {
  code: string;
  zoneName: string;
  seatLabel: string | null;
  attendeeName: string;
  sequence: number;
}

export type CheckInFailure = "not-found" | "wrong-event" | "not-valid" | "already-used" | "cancelled";

export type CheckInResult =
  | { result: "valid"; ticket: CheckInTicket }
  | { result: "already-used"; checkedInAt: string | null }
  | { result: Exclude<CheckInFailure, "already-used"> };

// Fila del SELECT diagnostico (sin scope) que se ejecuta solo cuando el UPDATE afecta 0 filas.
export interface CheckInDiagnosticRow {
  ticketStatus: "valid" | "used" | "cancelled";
  checkedInAt: Date | null;
  orderStatus: "pending" | "paid" | "failed" | "cancelled" | "refunded";
  eventId: string | null;
  eventStatus: string;
  organizerId: string | null;
}

export interface CheckInContext {
  eventId: string;
  viewer: { id: string; role: string };
}

export type CheckInActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "valid"; ticket: CheckInTicket }
  | { status: "already-used"; checkedInAt: string | null }
  | { status: Exclude<CheckInFailure, "already-used"> };

export interface CheckInStats {
  total: number;
  checkedIn: number;
}

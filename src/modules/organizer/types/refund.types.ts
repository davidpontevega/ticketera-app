import type { EventStatusChangeError } from "./organizer.types";

export type RefundFailure = "not-found" | "not-refundable" | "has-used-tickets";

export type RefundResult =
  | { result: "refunded" }
  | { result: RefundFailure }
  | { result: "stripe-error"; message: string };

export interface EventOrderRow {
  id: string;
  shortId: string; // primeros 8 chars del id en mayusculas
  buyerName: string;
  buyerEmail: string;
  totalAmount: number;
  ticketCount: number;
  createdAt: string; // ISO (serializable hacia el cliente)
  status: "paid" | "refunded";
}

export type RefundActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "refunded" }
  | { status: RefundFailure }
  | { status: "stripe-error"; message: string };

export interface EventRefundSummary {
  total: number;
  refunded: number;
  failed: number;
}

export interface EventOrdersHeader {
  title: string;
  status: "draft" | "published" | "cancelled";
}

// refunds: null = el evento quedo cancelado pero el reembolso masivo no pudo ejecutarse (reintentar).
export type CancelEventResult =
  | { ok: true; refunds: EventRefundSummary | null }
  | { ok: false; error: "not-found" | EventStatusChangeError };

export type RetryEventRefundsResult =
  | { ok: true; refunds: EventRefundSummary }
  | { ok: false; error: "not-found" };

export type RetryRefundsActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; refunds: EventRefundSummary };

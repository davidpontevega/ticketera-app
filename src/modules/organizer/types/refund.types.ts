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

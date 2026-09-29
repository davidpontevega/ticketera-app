import type { TicketLine } from "@/modules/ticket";

export type PaymentMethod = "card" | "yape" | "cash";
export type DocumentType = "dni" | "ce" | "passport";

export interface BuyerInfo {
  fullName: string;
  email: string;
  documentType: DocumentType;
  documentNumber: string;
  phone: string;
}

// Solo vive en el estado del formulario: nunca se guarda en el pedido.
export interface CardInfo {
  number: string;
  expiry: string; // "MM/AA"
  cvc: string;
  holderName: string;
}

export interface Order {
  number: string; // "TK-24817"
  eventId: string;
  buyer: BuyerInfo;
  paymentMethod: PaymentMethod;
  lines: TicketLine[];
  total: number;
  createdAt: string; // ISO 8601
}

export type PlaceOrderInput = Omit<Order, "number" | "createdAt">;

export interface CheckoutFormValues extends BuyerInfo {
  paymentMethod: PaymentMethod;
  card: CardInfo;
  acceptedTerms: boolean;
}

export type CheckoutFieldName =
  | keyof BuyerInfo
  | "paymentMethod"
  | `card.${keyof CardInfo}`
  | "acceptedTerms";

export type CheckoutErrors = Partial<Record<CheckoutFieldName, string>>;

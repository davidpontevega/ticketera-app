import type { EventEntity } from "@/modules/event";
import type { TicketLine } from "@/modules/ticket";

export type DocumentType = "dni" | "ce" | "passport";

export interface BuyerInfo {
  fullName: string;
  email: string;
  documentType: DocumentType;
  documentNumber: string;
  phone: string;
}

// Copia de los datos del evento al momento de comprar: el pedido se puede mostrar aunque el
// evento ya no este en el catalogo (ej. eventos pasados).
export type OrderEventSnapshot = Pick<
  EventEntity,
  "id" | "slug" | "title" | "category" | "date" | "venue" | "address" | "city" | "imageUrl"
>;

export interface Order {
  number: string; // "TK-24817"
  eventId: string;
  event: OrderEventSnapshot;
  buyer: BuyerInfo;
  lines: TicketLine[];
  total: number;
  createdAt: string; // ISO 8601
}

// Una entrada individual de un pedido (un pedido de 2 entradas tiene 2 OrderTicket).
export interface OrderTicket {
  code: string; // "TK-24817-01"
  index: number; // 1..total
  total: number;
  zoneName: string;
  seatLabel: string | null; // "C12" en zonas numeradas
}

export interface CheckoutFormValues extends BuyerInfo {
  acceptedTerms: boolean;
}

export type CheckoutFieldName = keyof BuyerInfo | "acceptedTerms";

export type CheckoutErrors = Partial<Record<CheckoutFieldName, string>>;

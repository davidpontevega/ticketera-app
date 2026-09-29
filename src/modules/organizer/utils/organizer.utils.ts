import type {
  OrganizerEvent,
  OrganizerEventFilter,
  OrganizerKpis,
  OrganizerTicketTier,
} from "../types/organizer.types";

type TierAmounts = Pick<OrganizerTicketTier, "price" | "quantity">;

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// "2026-11-14" + "21:00" -> ISO en hora de Lima (Peru no tiene horario de verano).
export function toEventIsoDate(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return `${date}T${safeTime}:00-05:00`;
}

export function getEventCapacity(tiers: readonly TierAmounts[]): number {
  return tiers.reduce(
    (total, tier) => total + (Number.isFinite(tier.quantity) ? tier.quantity : 0),
    0,
  );
}

export function getEventSold(event: OrganizerEvent): number {
  return event.tiers.reduce((total, tier) => total + tier.sold, 0);
}

export function getEventRevenue(event: OrganizerEvent): number {
  return event.tiers.reduce((total, tier) => total + tier.sold * tier.price, 0);
}

// Menor precio > 0 (null si no hay ninguno).
export function getEventPriceFrom(
  tiers: readonly Pick<OrganizerTicketTier, "price">[],
): number | null {
  const prices = tiers
    .map((tier) => tier.price)
    .filter((price) => Number.isFinite(price) && price > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export function getOrganizerKpis(events: readonly OrganizerEvent[]): OrganizerKpis {
  return events.reduce(
    (kpis, event) => ({
      sold: kpis.sold + getEventSold(event),
      revenue: kpis.revenue + getEventRevenue(event),
      published: kpis.published + (event.status === "published" ? 1 : 0),
    }),
    { sold: 0, revenue: 0, published: 0 },
  );
}

// Eventos del usuario (mas recientes primero) + los de ejemplo que no reemplazo (mismo id).
export function getOrganizerEvents(
  stored: readonly OrganizerEvent[],
  demo: readonly OrganizerEvent[],
  ownerEmail: string,
): OrganizerEvent[] {
  const email = ownerEmail.trim().toLowerCase();
  const own = stored
    .filter((event) => event.ownerEmail?.toLowerCase() === email)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const ownIds = new Set(own.map((event) => event.id));
  return [...own, ...demo.filter((event) => !ownIds.has(event.id))];
}

export function filterOrganizerEvents(
  events: readonly OrganizerEvent[],
  filter: OrganizerEventFilter,
): OrganizerEvent[] {
  return filter === "all" ? [...events] : events.filter((event) => event.status === filter);
}

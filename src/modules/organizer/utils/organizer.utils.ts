import type {
  EventStatusChangeError,
  OrganizerDbEventStatus,
  OrganizerEventFilter,
  OrganizerEventSummary,
  OrganizerKpis,
} from "../types/organizer.types";

type TierAmounts = { price: number; quantity: number };

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

// Menor precio > 0 (null si no hay ninguno).
export function getEventPriceFrom(
  tiers: readonly Pick<TierAmounts, "price">[],
): number | null {
  const prices = tiers
    .map((tier) => tier.price)
    .filter((price) => Number.isFinite(price) && price > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export interface OrganizerEventRow {
  id: string;
  slug: string;
  title: string;
  status: OrganizerDbEventStatus;
  startsAt: Date;
  city: string;
  imageUrl: string;
  capacity: number;
  isFeatured: boolean;
  sold: number;
  revenue: string; // numeric(10,2) como texto desde SQL
}

export function toOrganizerEventSummaries(
  rows: readonly OrganizerEventRow[],
): OrganizerEventSummary[] {
  return rows.map((row) => ({
    ...row,
    startsAt: row.startsAt.toISOString(),
    revenue: Number(row.revenue),
  }));
}

export function getOrganizerKpis(
  events: readonly Pick<OrganizerEventSummary, "sold" | "revenue" | "status">[],
): OrganizerKpis {
  const kpis = events.reduce(
    (acc, event) => ({
      sold: acc.sold + event.sold,
      revenue: acc.revenue + event.revenue,
      published: acc.published + (event.status === "published" ? 1 : 0),
    }),
    { sold: 0, revenue: 0, published: 0 },
  );
  return { ...kpis, revenue: Math.round(kpis.revenue * 100) / 100 };
}

// Tabla D3 de la spec 030. cancelled es terminal; cualquier transicion no listada es invalid-transition.
export function getEventStatusChangeError(
  event: { status: OrganizerDbEventStatus; startsAt: Date; tierCount: number },
  target: OrganizerDbEventStatus,
  now: Date = new Date(),
): EventStatusChangeError | null {
  if (event.status === "draft" && target === "published") {
    // Si ambas condiciones fallan, se prioriza "past-date" (mas visible que agregar tiers).
    if (event.startsAt.getTime() <= now.getTime()) return "past-date";
    if (event.tierCount <= 0) return "no-tiers";
    return null;
  }
  if (event.status === "published" && target === "draft") return null;
  if ((event.status === "draft" || event.status === "published") && target === "cancelled") {
    return null;
  }
  return "invalid-transition";
}

export function filterOrganizerEvents<T extends { status: string }>(
  events: readonly T[],
  filter: OrganizerEventFilter,
): T[] {
  return filter === "all" ? [...events] : events.filter((event) => event.status === filter);
}

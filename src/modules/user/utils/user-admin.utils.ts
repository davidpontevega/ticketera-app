import { ADMIN_USERS_PATH } from "../constants/user.constants";
import type { UserListParams } from "../types/user.types";

/**
 * Builds the href for a given page of `/admin/users`, keeping the current filters.
 * Omits params that match their default (q/role undefined, status "active", page 1)
 * so the URL stays clean when nothing is filtered.
 */
export function getUsersPageHref(params: UserListParams, page: number): string {
  const searchParams = new URLSearchParams();

  if (params.q !== undefined) searchParams.set("q", params.q);
  if (params.role !== undefined) searchParams.set("role", params.role);
  if (params.status !== "active") searchParams.set("status", params.status);
  if (page !== 1) searchParams.set("page", String(page));

  const query = searchParams.toString();
  return query ? `${ADMIN_USERS_PATH}?${query}` : ADMIN_USERS_PATH;
}

export type PaginationItem = number | "ellipsis";

/**
 * Builds a compact list of pagination items: all pages when there are few,
 * otherwise first/last plus a window around `current`, with "ellipsis" in the gaps.
 */
export function getPaginationItems(current: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages]);
  for (const page of [current - 1, current, current + 1]) {
    if (page >= 1 && page <= totalPages) pages.add(page);
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const items: PaginationItem[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) items.push("ellipsis");
    items.push(page);
  });
  return items;
}

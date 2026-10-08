import { describe, expect, it } from "vitest";

import { getPaginationItems, getUsersPageHref } from "./user-admin.utils";

function searchParamsOf(href: string): URLSearchParams {
  return new URL(href, "http://x").searchParams;
}

describe("getUsersPageHref", () => {
  it("omits every default (status active, page 1, no q/role)", () => {
    expect(getUsersPageHref({ status: "active", page: 1 }, 1)).toBe("/admin/users");
  });

  it("includes non-default filters and page", () => {
    const href = getUsersPageHref({ q: "ana", role: "admin", status: "all", page: 1 }, 3);
    const params = searchParamsOf(href);

    expect(href.startsWith("/admin/users?")).toBe(true);
    expect(params.get("q")).toBe("ana");
    expect(params.get("role")).toBe("admin");
    expect(params.get("status")).toBe("all");
    expect(params.get("page")).toBe("3");
  });

  it("the page argument wins over params.page", () => {
    const params = searchParamsOf(getUsersPageHref({ status: "active", page: 5 }, 2));
    expect(params.get("page")).toBe("2");
  });

  it("encodes spaces and & in q correctly", () => {
    const params = searchParamsOf(getUsersPageHref({ q: "ana & luis", status: "active", page: 1 }, 1));
    expect(params.get("q")).toBe("ana & luis");
  });

  it("omits status when it is the default (active) even with other filters set", () => {
    const params = searchParamsOf(getUsersPageHref({ q: "ana", status: "active", page: 1 }, 1));
    expect(params.has("status")).toBe(false);
    expect(params.get("q")).toBe("ana");
  });
});

describe("getPaginationItems", () => {
  it("matches the spec examples exactly", () => {
    expect(getPaginationItems(1, 10)).toEqual([1, 2, "ellipsis", 10]);
    expect(getPaginationItems(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
  });

  it("returns every page with no ellipsis when totalPages <= 7", () => {
    expect(getPaginationItems(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getPaginationItems(4, 1)).toEqual([1]);
  });

  it("never duplicates or exceeds the [1, totalPages] range", () => {
    for (const [current, totalPages] of [
      [1, 10],
      [2, 10],
      [9, 10],
      [10, 10],
      [5, 10],
    ] as const) {
      const items = getPaginationItems(current, totalPages);
      const numbers = items.filter((item): item is number => item !== "ellipsis");
      expect(new Set(numbers).size).toBe(numbers.length);
      expect(numbers.every((n) => n >= 1 && n <= totalPages)).toBe(true);
    }
  });
});

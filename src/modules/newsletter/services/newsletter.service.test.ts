import { beforeEach, describe, expect, it, vi } from "vitest";

import { newsletterSubscribers } from "../db/newsletter-subscriber.table";
import { subscribe } from "./newsletter.service";

vi.mock("server-only", () => ({}));

const onConflictDoNothing = vi.fn(() => Promise.resolve());
const values = vi.fn(() => ({ onConflictDoNothing }));
const insert = vi.fn(() => ({ values }));

vi.mock("@/lib/db", () => ({ db: { insert: (...a: unknown[]) => (insert as (...x: unknown[]) => unknown)(...a) } }));

describe("subscribe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserta el correo ignorando el conflicto de unicidad", async () => {
    await subscribe("ana@correo.com");
    expect(insert).toHaveBeenCalledWith(newsletterSubscribers);
    expect(values).toHaveBeenCalledWith({ email: "ana@correo.com" });
    expect(onConflictDoNothing).toHaveBeenCalledWith({ target: newsletterSubscribers.email });
  });

  it("no falla al repetir el mismo correo", async () => {
    await subscribe("ana@correo.com");
    await expect(subscribe("ana@correo.com")).resolves.toBeUndefined();
  });
});

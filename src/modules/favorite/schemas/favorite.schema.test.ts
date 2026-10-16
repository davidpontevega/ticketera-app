import { describe, expect, it } from "vitest";

import { setFavoriteSchema } from "./favorite.schema";

const ID = "11111111-1111-4111-8111-111111111111";

describe("setFavoriteSchema", () => {
  it("acepta eventId uuid y favorite booleano", () => {
    expect(setFavoriteSchema.safeParse({ eventId: ID, favorite: true }).success).toBe(true);
    expect(setFavoriteSchema.safeParse({ eventId: ID, favorite: false }).success).toBe(true);
  });

  it("rechaza eventId no uuid", () => {
    expect(setFavoriteSchema.safeParse({ eventId: "abc", favorite: true }).success).toBe(false);
  });

  it("rechaza favorite no booleano", () => {
    expect(setFavoriteSchema.safeParse({ eventId: ID, favorite: "true" }).success).toBe(false);
    expect(setFavoriteSchema.safeParse({ eventId: ID }).success).toBe(false);
  });

  it("descarta userId del input", () => {
    const parsed = setFavoriteSchema.parse({ eventId: ID, favorite: true, userId: "x" });
    expect(parsed).toEqual({ eventId: ID, favorite: true });
  });
});

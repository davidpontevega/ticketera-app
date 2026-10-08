import { describe, expect, it } from "vitest";

import { USER_SEARCH_MAX_LENGTH } from "../constants/user.constants";
import {
  changeUserRoleSchema,
  deleteUserSchema,
  inviteUserSchema,
  userListParamsSchema,
} from "./user-admin.schema";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("userListParamsSchema", () => {
  it("defaults status to active and page to 1 with no q/role when input is empty", () => {
    expect(userListParamsSchema.parse({})).toEqual({ status: "active", page: 1 });
  });

  it("falls back role to undefined when invalid", () => {
    expect(userListParamsSchema.parse({ role: "foo" }).role).toBeUndefined();
  });

  it("preserves a valid role", () => {
    expect(userListParamsSchema.parse({ role: "organizer" }).role).toBe("organizer");
  });

  it("falls back status to active when invalid", () => {
    expect(userListParamsSchema.parse({ status: "x" }).status).toBe("active");
  });

  it.each(["-3", "abc", "0"])("falls back page to 1 when invalid (%s)", (page) => {
    expect(userListParamsSchema.parse({ page }).page).toBe(1);
  });

  it("coerces a numeric string page to a number", () => {
    expect(userListParamsSchema.parse({ page: "5" }).page).toBe(5);
  });

  it("never throws and falls back to the field default when any field is an array", () => {
    expect(() => userListParamsSchema.parse({ q: ["a", "b"] })).not.toThrow();
    expect(userListParamsSchema.parse({ q: ["a", "b"] }).q).toBeUndefined();
    expect(userListParamsSchema.parse({ role: ["admin", "organizer"] }).role).toBeUndefined();
    expect(userListParamsSchema.parse({ status: ["active", "all"] }).status).toBe("active");
    expect(userListParamsSchema.parse({ page: ["1", "2"] }).page).toBe(1);
  });

  it("trims q and turns an empty/blank value into undefined", () => {
    expect(userListParamsSchema.parse({ q: "  maria  " }).q).toBe("maria");
    expect(userListParamsSchema.parse({ q: "" }).q).toBeUndefined();
    expect(userListParamsSchema.parse({ q: "   " }).q).toBeUndefined();
  });

  // Decision: q mas largo que USER_SEARCH_MAX_LENGTH se recorta a ese largo exacto (no se descarta).
  it("truncates q to USER_SEARCH_MAX_LENGTH instead of discarding it", () => {
    const longQuery = "a".repeat(USER_SEARCH_MAX_LENGTH + 20);
    const result = userListParamsSchema.parse({ q: longQuery });
    expect(result.q).toHaveLength(USER_SEARCH_MAX_LENGTH);
    expect(result.q).toBe("a".repeat(USER_SEARCH_MAX_LENGTH));
  });
});

describe("inviteUserSchema", () => {
  it("normalizes the email (trim + lowercase)", () => {
    const result = inviteUserSchema.parse({ email: "  Foo@Bar.COM  ", role: "admin" });
    expect(result.email).toBe("foo@bar.com");
  });

  it("rejects an invalid email", () => {
    expect(inviteUserSchema.safeParse({ email: "not-an-email", role: "admin" }).success).toBe(false);
  });

  it("rejects customer and super_admin roles", () => {
    expect(inviteUserSchema.safeParse({ email: "a@b.com", role: "customer" }).success).toBe(false);
    expect(inviteUserSchema.safeParse({ email: "a@b.com", role: "super_admin" }).success).toBe(false);
  });

  it("accepts admin and organizer roles", () => {
    expect(inviteUserSchema.safeParse({ email: "a@b.com", role: "admin" }).success).toBe(true);
    expect(inviteUserSchema.safeParse({ email: "a@b.com", role: "organizer" }).success).toBe(true);
  });
});

describe("changeUserRoleSchema", () => {
  it.each(["admin", "organizer", "customer"])("accepts %s", (role) => {
    expect(changeUserRoleSchema.safeParse({ userId: VALID_UUID, role }).success).toBe(true);
  });

  it("rejects super_admin", () => {
    expect(changeUserRoleSchema.safeParse({ userId: VALID_UUID, role: "super_admin" }).success).toBe(false);
  });

  it("rejects a userId that is not a valid uuid", () => {
    expect(changeUserRoleSchema.safeParse({ userId: "not-a-uuid", role: "admin" }).success).toBe(false);
  });
});

describe("deleteUserSchema", () => {
  it("rejects a userId that is not a valid uuid", () => {
    expect(deleteUserSchema.safeParse({ userId: "not-a-uuid" }).success).toBe(false);
  });

  it("accepts a valid uuid", () => {
    expect(deleteUserSchema.safeParse({ userId: VALID_UUID }).success).toBe(true);
  });
});

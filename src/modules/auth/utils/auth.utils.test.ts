import { describe, expect, it } from "vitest";

import { getAuthHref, getInitials, getNameFromEmail, getSafeRedirect } from "./auth.utils";

describe("getSafeRedirect", () => {
  it("accepts internal paths", () => {
    expect(getSafeRedirect("/my-tickets")).toBe("/my-tickets");
    expect(getSafeRedirect("/events?categories=theater")).toBe("/events?categories=theater");
  });

  it("falls back for external or malformed values", () => {
    expect(getSafeRedirect("https://evil.com")).toBe("/");
    expect(getSafeRedirect("//evil.com")).toBe("/");
    expect(getSafeRedirect("/\\evil.com")).toBe("/");
    expect(getSafeRedirect("")).toBe("/");
    expect(getSafeRedirect(null)).toBe("/");
    expect(getSafeRedirect("evil", "/events")).toBe("/events");
  });
});

describe("getNameFromEmail", () => {
  it("builds a readable name from the local part", () => {
    expect(getNameFromEmail("maria.perez_92@correo.com")).toBe("Maria Perez");
    expect(getNameFromEmail("JUAN@correo.com")).toBe("Juan");
    expect(getNameFromEmail("123@correo.com")).toBe("Usuario");
  });
});

describe("getInitials", () => {
  it("uses up to two words", () => {
    expect(getInitials("Maria Perez Lopez")).toBe("MP");
    expect(getInitials(" juan ")).toBe("J");
  });
});

describe("getAuthHref", () => {
  it("keeps a safe redirect", () => {
    expect(getAuthHref("/login")).toBe("/login");
    expect(getAuthHref("/register", "/my-tickets")).toBe("/register?redirect=%2Fmy-tickets");
    expect(getAuthHref("/login", "/")).toBe("/login");
    expect(getAuthHref("/login", "https://evil.com")).toBe("/login");
  });
});

import { describe, expect, it } from "vitest";

import {
  decodeGoogleCredential,
  getAuthHref,
  getInitials,
  getNameFromEmail,
  getSafeRedirect,
  hashPassword,
} from "./auth.utils";

function fakeJwt(payload: object): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256" })}.${encode(payload)}.firma`;
}

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

describe("hashPassword", () => {
  it("is deterministic, normalizes the email and depends on it", async () => {
    const hash = await hashPassword("Maria@Example.com ", "secreto123");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashPassword("maria@example.com", "secreto123")).toBe(hash);
    expect(await hashPassword("otra@example.com", "secreto123")).not.toBe(hash);
  });
});

describe("decodeGoogleCredential", () => {
  it("reads name and email from the ID token", () => {
    expect(
      decodeGoogleCredential(
        fakeJwt({ email: "Ana@Gmail.com", email_verified: true, name: "Ana Núñez" }),
      ),
    ).toEqual({ email: "ana@gmail.com", fullName: "Ana Núñez" });
  });

  it("falls back to the email for the name", () => {
    expect(decodeGoogleCredential(fakeJwt({ email: "juan.torres@gmail.com" }))?.fullName).toBe(
      "Juan Torres",
    );
  });

  it("rejects invalid or unverified tokens", () => {
    expect(decodeGoogleCredential("no-es-un-jwt")).toBeNull();
    expect(decodeGoogleCredential("a.@@@.b")).toBeNull();
    expect(decodeGoogleCredential(fakeJwt({ email: "a@b.com", email_verified: false }))).toBeNull();
  });
});

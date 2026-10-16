import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let current: Headers;
vi.mock("next/headers", () => ({ headers: async () => current }));

const { getRequestOrigin } = await import("./request-origin");

beforeEach(() => {
  current = new Headers();
});

describe("getRequestOrigin", () => {
  it("localhost usa http", async () => {
    current = new Headers({ host: "localhost:3000" });
    expect(await getRequestOrigin()).toBe("http://localhost:3000");
  });

  it("otro host usa https", async () => {
    current = new Headers({ host: "app.example.com" });
    expect(await getRequestOrigin()).toBe("https://app.example.com");
  });

  it("ignora x-forwarded-host", async () => {
    current = new Headers({ host: "app.example.com", "x-forwarded-host": "evil.com" });
    expect(await getRequestOrigin()).toBe("https://app.example.com");
  });
});

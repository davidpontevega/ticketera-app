import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { isProtectedRoute } from "./protected-routes";

const check = (path: string) => isProtectedRoute(new NextRequest("http://localhost" + path));

describe("isProtectedRoute", () => {
  it.each([
    "/my-tickets",
    "/favorites",
    "/favorites/x",
    "/events/rock-fest/checkout",
    "/events/rock-fest/confirmation",
    "/organizer",
    "/organizer/events/new",
    "/admin",
    "/admin/users",
  ])("protege %s", (path) => {
    expect(check(path)).toBe(true);
  });

  it.each([
    "/",
    "/events",
    "/events/rock-fest",
    "/events/rock-fest/tickets",
    "/login",
    "/register",
    "/organizers-info",
    "/administrar",
    "/api/webhooks/clerk",
    "/api/webhooks/stripe",
    "/api/webhooks/stripe-connect",
    "/api/checkout/session",
  ])("no protege %s", (path) => {
    expect(check(path)).toBe(false);
  });
});

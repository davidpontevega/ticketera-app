import { beforeEach, describe, expect, it, vi } from "vitest";

const { isProtectedRoute } = vi.hoisted(() => ({ isProtectedRoute: vi.fn() }));

// clerkMiddleware(handler) returns the handler so the wiring can be called directly.
vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: (handler: unknown) => handler }));
vi.mock("@/lib/protected-routes", () => ({ isProtectedRoute }));

import proxy from "./proxy";

type Handler = (auth: { protect: () => Promise<void> }, req: unknown) => Promise<void>;
const handler = proxy as unknown as Handler;

describe("proxy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls auth.protect on protected routes", async () => {
    isProtectedRoute.mockReturnValue(true);
    const protect = vi.fn().mockResolvedValue(undefined);

    await handler({ protect }, {});

    expect(protect).toHaveBeenCalledTimes(1);
  });

  it("does not call auth.protect on public routes", async () => {
    isProtectedRoute.mockReturnValue(false);
    const protect = vi.fn().mockResolvedValue(undefined);

    await handler({ protect }, {});

    expect(protect).not.toHaveBeenCalled();
  });
});

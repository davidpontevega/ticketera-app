import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyWebhook, handleClerkWebhookEvent } = vi.hoisted(() => ({
  verifyWebhook: vi.fn(),
  handleClerkWebhookEvent: vi.fn(),
}));

vi.mock("@clerk/nextjs/webhooks", () => ({ verifyWebhook }));
vi.mock("@/modules/user", () => ({ handleClerkWebhookEvent }));

import { POST } from "./route";

const request = new Request("http://localhost/api/webhooks/clerk", {
  method: "POST",
  body: "{}",
}) as unknown as NextRequest;

describe("POST /api/webhooks/clerk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 400 and skips the sync when the signature is invalid", async () => {
    verifyWebhook.mockRejectedValue(new Error("bad signature"));

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(handleClerkWebhookEvent).not.toHaveBeenCalled();
  });

  it("passes the verified event to the sync service and returns 200", async () => {
    const event = { type: "user.created", data: { id: "user_1" } };
    verifyWebhook.mockResolvedValue(event);
    handleClerkWebhookEvent.mockResolvedValue(undefined);

    const response = await POST(request);

    expect(verifyWebhook).toHaveBeenCalledWith(request);
    expect(handleClerkWebhookEvent).toHaveBeenCalledWith(event);
    expect(response.status).toBe(200);
  });

  it("returns 500 when the sync service throws", async () => {
    verifyWebhook.mockResolvedValue({ type: "user.deleted", data: { id: "user_1" } });
    handleClerkWebhookEvent.mockRejectedValue(new Error("db down"));

    const response = await POST(request);

    expect(response.status).toBe(500);
  });
});

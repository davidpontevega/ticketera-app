import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { handleClerkWebhookEvent } from "@/modules/user";

export async function POST(request: NextRequest): Promise<Response> {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    await handleClerkWebhookEvent(event);
  } catch (error) {
    console.error("Failed to process Clerk webhook event:", error);
    return new Response("Internal Server Error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}

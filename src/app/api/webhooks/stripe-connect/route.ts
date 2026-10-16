import type { NextRequest } from "next/server";

import { stripe } from "@/lib/stripe";
import { handleConnectEvent } from "@/modules/payment/services/connect.service";

export async function POST(request: NextRequest): Promise<Response> {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_CONNECT_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Invalid signature", { status: 400 });
  }

  const body = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    await handleConnectEvent(event);
  } catch (error) {
    console.error("Failed to process Stripe Connect webhook event:", error);
    return new Response("Internal Server Error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}

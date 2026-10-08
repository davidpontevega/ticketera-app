import type { NextRequest } from "next/server";

import { stripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/modules/order/services/checkout.service";

export async function POST(request: NextRequest): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Invalid signature", { status: 400 });
  }

  const body = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    console.error("Failed to process Stripe webhook event:", error);
    return new Response("Internal Server Error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}

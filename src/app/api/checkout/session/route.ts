import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createCheckoutSessionSchema } from "@/modules/order/schemas/checkout.schema";
import { createCheckoutSession } from "@/modules/order/services/checkout.service";

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "JSON invalido" }, { status: 400 });
  }

  const parsed = createCheckoutSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos invalidos" }, { status: 400 });
  }

  try {
    const { userId } = await auth();
    const origin = new URL(request.url).origin;
    const result = await createCheckoutSession(parsed.data, { origin, clerkUserId: userId });

    if (result.ok) {
      return NextResponse.json({ url: result.url }, { status: 200 });
    }
    return NextResponse.json({ message: result.message }, { status: result.status });
  } catch (error) {
    console.error("Failed to create checkout session:", error);
    return NextResponse.json({ message: "No pudimos iniciar el pago" }, { status: 500 });
  }
}

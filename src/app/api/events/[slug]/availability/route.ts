import { NextResponse } from "next/server";

import { getEventAvailability } from "@/modules/order/services/availability.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;

  try {
    const snapshot = await getEventAvailability(slug);
    if (!snapshot) {
      return NextResponse.json({ message: "Evento no encontrado" }, { status: 404 });
    }
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    console.error("Failed to read event availability:", error);
    return NextResponse.json({ message: "No pudimos leer la disponibilidad" }, { status: 500 });
  }
}

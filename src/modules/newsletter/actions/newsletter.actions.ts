"use server";

import { subscribeSchema } from "../schemas/newsletter.schema";
import { subscribe } from "../services/newsletter.service";
import type { SubscribeState } from "../types/newsletter.types";

const SUCCESS: SubscribeState = { status: "success", message: "Listo, te avisaremos de novedades" };

export async function subscribeAction(_prev: SubscribeState, formData: FormData): Promise<SubscribeState> {
  const parsed = subscribeSchema.safeParse({
    email: formData.get("email"),
    website: formData.get("website") ?? undefined,
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Correo invalido" };
  // Bot: responder igual que a un humano, sin guardar.
  if (parsed.data.website) return SUCCESS;
  try {
    await subscribe(parsed.data.email);
    return SUCCESS;
  } catch (error) {
    console.error("newsletter subscribe failed", error);
    return { status: "error", message: "No se pudo suscribir, intenta de nuevo" };
  }
}

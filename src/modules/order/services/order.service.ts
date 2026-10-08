import axios from "axios";

import type { CreateCheckoutSessionInput } from "../schemas/checkout.schema";

const CHECKOUT_SESSION_ENDPOINT = "/api/checkout/session";
const GENERIC_ERROR_MESSAGE = "No pudimos iniciar el pago. Intenta de nuevo.";
const UNAVAILABLE_EVENT_MESSAGE = "Este evento todavia no admite pagos en linea.";

export function getCheckoutErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof message === "string" && message) return message;
    if (error.response?.status === 404) return UNAVAILABLE_EVENT_MESSAGE;
  }
  return GENERIC_ERROR_MESSAGE;
}

export async function startCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<{ url: string }> {
  try {
    const { data } = await axios.post<{ url: string }>(CHECKOUT_SESSION_ENDPOINT, input);
    return { url: data.url };
  } catch (error) {
    throw new Error(getCheckoutErrorMessage(error));
  }
}

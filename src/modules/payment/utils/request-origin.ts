import "server-only";

import { headers } from "next/headers";

/** Origen del request. Solo `host`: x-forwarded-host lo puede fijar el cliente si no hay un proxy que lo sobrescriba. */
export async function getRequestOrigin(): Promise<string> {
  const host = (await headers()).get("host");
  const proto = host?.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

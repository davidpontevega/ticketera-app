import "server-only";

import { db } from "@/lib/db";

import { newsletterSubscribers } from "../db/newsletter-subscriber.table";

// `email` ya viene normalizado por subscribeSchema. Repetido = no-op.
export async function subscribe(email: string): Promise<void> {
  await db
    .insert(newsletterSubscribers)
    .values({ email })
    .onConflictDoNothing({ target: newsletterSubscribers.email });
}

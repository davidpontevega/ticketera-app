import type { UserJSON, WebhookEvent } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getNameFromEmail } from "@/modules/auth";
import { db } from "@/lib/db";
import { users } from "../db/user.table";
import { ASSIGNABLE_ROLES, SUPER_ADMIN_EMAIL } from "../constants/user.constants";
import type { NewUser, UserRole } from "../types/user.types";

export type ClerkUserFields = Pick<NewUser, "clerkId" | "email" | "fullName"> & { role: UserRole };

function resolveRole(
  normalizedEmail: string,
  primaryEmail: UserJSON["email_addresses"][number] | undefined,
  data: UserJSON,
): UserRole {
  if (normalizedEmail === SUPER_ADMIN_EMAIL && primaryEmail?.verification?.status === "verified") {
    return "super_admin";
  }

  const metadataRole = data.public_metadata?.role;
  if (typeof metadataRole === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(metadataRole)) {
    return metadataRole as UserRole;
  }

  return "customer";
}

export function mapClerkUser(data: UserJSON): ClerkUserFields {
  const { email_addresses: emailAddresses, primary_email_address_id: primaryId } = data;
  const primaryEmail = emailAddresses.find((address) => address.id === primaryId);
  const email = (primaryEmail ?? emailAddresses[0])?.email_address;
  if (!email) {
    throw new Error(`Clerk user ${data.id} has no email address`);
  }
  const normalizedEmail = email.toLowerCase();

  const fullName =
    `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || getNameFromEmail(normalizedEmail);

  const role = resolveRole(normalizedEmail, primaryEmail, data);

  return { clerkId: data.id, email: normalizedEmail, fullName, role };
}

export async function upsertUserFromClerk(data: UserJSON): Promise<void> {
  const fields = mapClerkUser(data);
  await db
    .insert(users)
    .values(fields)
    .onConflictDoUpdate({
      target: users.clerkId,
      set: {
        email: fields.email,
        fullName: fields.fullName,
        deletedAt: null,
        updatedAt: new Date(),
        ...(fields.role === "super_admin" ? { role: fields.role } : {}),
      },
    });
}

export async function softDeleteUserByClerkId(clerkId: string): Promise<void> {
  await db
    .update(users)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.clerkId, clerkId));
}

export async function handleClerkWebhookEvent(event: WebhookEvent): Promise<void> {
  switch (event.type) {
    case "user.created":
    case "user.updated":
      await upsertUserFromClerk(event.data);
      return;
    case "user.deleted":
      if (event.data.id) {
        await softDeleteUserByClerkId(event.data.id);
      }
      return;
    default:
      return;
  }
}

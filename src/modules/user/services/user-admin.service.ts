import { clerkClient } from "@clerk/nextjs/server";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { and, desc, eq, ilike, isNull, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "../db/user.table";
import { USERS_PAGE_SIZE } from "../constants/user.constants";
import type {
  ChangeUserRoleInput,
  DeleteUserInput,
  InviteUserInput,
} from "../schemas/user-admin.schema";
import type {
  DeleteUserResult,
  InviteUserResult,
  UserListParams,
  UserListResult,
} from "../types/user.types";
import { softDeleteUserByClerkId } from "./user-sync.service";

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function listUsers(
  params: UserListParams,
): Promise<UserListResult> {
  const searchPattern = params.q ? `%${escapeLikePattern(params.q)}%` : undefined;
  const conditions = [
    params.status === "active" ? isNull(users.deletedAt) : undefined,
    params.role ? eq(users.role, params.role) : undefined,
    searchPattern
      ? or(ilike(users.fullName, searchPattern), ilike(users.email, searchPattern))
      : undefined,
  ];
  const where = and(...conditions);

  const total = await db.$count(users, where);
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const page = Math.min(params.page, totalPages);

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(USERS_PAGE_SIZE)
    .offset((page - 1) * USERS_PAGE_SIZE);

  return { users: rows, total, page, pageSize: USERS_PAGE_SIZE };
}

export async function inviteUser(
  input: InviteUserInput,
  context: { origin: string },
): Promise<InviteUserResult> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, input.email), isNull(users.deletedAt)))
    .limit(1);

  if (existing) {
    return { ok: false, error: "already-registered" };
  }

  try {
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress: input.email,
      publicMetadata: { role: input.role },
      redirectUrl: `${context.origin}/register`,
    });
    return { ok: true };
  } catch (error) {
    if (isClerkAPIResponseError(error)) {
      const code = error.errors[0]?.code;
      if (code === "duplicate_record") {
        return { ok: false, error: "already-invited" };
      }
      if (code === "form_identifier_exists") {
        return { ok: false, error: "already-registered" };
      }
    }
    console.error(error);
    return { ok: false, error: "invitation-failed" };
  }
}

export async function changeUserRole(
  input: ChangeUserRoleInput,
): Promise<boolean> {
  const updated = await db
    .update(users)
    .set({ role: input.role, updatedAt: new Date() })
    .where(
      and(
        eq(users.id, input.userId),
        ne(users.role, "super_admin"),
        isNull(users.deletedAt),
      ),
    )
    .returning({ id: users.id });

  return updated.length > 0;
}

export async function deleteUser(
  input: DeleteUserInput,
): Promise<DeleteUserResult> {
  const [row] = await db
    .select({ id: users.id, clerkId: users.clerkId })
    .from(users)
    .where(
      and(
        eq(users.id, input.userId),
        ne(users.role, "super_admin"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!row) {
    return { ok: false, error: "not-found" };
  }

  try {
    const client = await clerkClient();
    await client.users.deleteUser(row.clerkId);
  } catch (error) {
    const isNotFound = isClerkAPIResponseError(error) && error.status === 404;
    if (!isNotFound) {
      console.error(error);
      return { ok: false, error: "delete-failed" };
    }
  }

  await softDeleteUserByClerkId(row.clerkId);
  return { ok: true };
}

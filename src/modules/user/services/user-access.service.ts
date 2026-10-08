import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "../db/user.table";
import type { UserEntity, UserRole } from "../types/user.types";

async function findActiveUserByClerkId(clerkId: string): Promise<UserEntity | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.clerkId, clerkId), isNull(users.deletedAt)))
    .limit(1);

  return row ?? null;
}

export async function getCurrentDbUser(): Promise<UserEntity | null> {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  return findActiveUserByClerkId(userId);
}

export async function requireRole(allowed: readonly UserRole[]): Promise<UserEntity> {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const user = await findActiveUserByClerkId(userId);
  if (!user || !allowed.includes(user.role)) {
    redirect("/");
  }

  return user;
}

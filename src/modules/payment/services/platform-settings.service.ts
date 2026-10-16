import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";

import { DEFAULT_PLATFORM_FEE_PERCENT } from "../constants/payment.constants";
import { platformSettings } from "../db/platform-settings.table";
import type { PlatformSettings } from "../types/payment.types";

/** Sin fila devuelve el default sin escribir (spec 042, Decision 5). */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
  if (!row) return { feePercent: DEFAULT_PLATFORM_FEE_PERCENT, updatedBy: null, updatedAt: null };
  return { feePercent: Number(row.feePercent), updatedBy: row.updatedBy, updatedAt: row.updatedAt };
}

export async function getPlatformFeePercent(): Promise<number> {
  return (await getPlatformSettings()).feePercent;
}

export async function setPlatformFeePercent(percent: number, viewerId: string): Promise<void> {
  const values = { feePercent: percent.toFixed(2), updatedBy: viewerId, updatedAt: new Date() };
  await db
    .insert(platformSettings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: platformSettings.id, set: values });
}

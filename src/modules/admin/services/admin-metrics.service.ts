import "server-only";
import { sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { requireRole, USER_ADMIN_ROLES } from "@/modules/user";

import type { AdminMetrics, AdminMetricsRows } from "../types/admin-metrics.types";
import { recentMonths, toAdminMetrics, windowStart } from "../utils/admin-metrics.utils";

// created_at es timestamp sin zona en UTC: se pasa a Lima antes de truncar al mes.
const monthOf = (table: string) =>
  sql.raw(
    `to_char(date_trunc('month', "${table}"."created_at" at time zone 'UTC' at time zone 'America/Lima'), 'YYYY-MM')`,
  );

async function rowsOf<T>(query: SQL): Promise<T[]> {
  return (await db.execute(query)) as unknown as T[];
}

// Todo se agrega en SQL: cada consulta devuelve como maximo una fila por mes/estado/rol.
// Nombres calificados a mano (Drizzle omite el prefijo de tabla). Ordenes pagadas: ingresos/comision
// y entradas van separadas porque el lateral sobre lines duplicaria total_amount.
// ponytail: filtro global por created_at sin indice dedicado; techo: cientos de miles de ordenes,
// salida: indice (status, created_at) o vista materializada.
export async function getAdminMetrics(now: Date = new Date()): Promise<AdminMetrics> {
  await requireRole(USER_ADMIN_ROLES);

  const since = windowStart(recentMonths(now));
  const month = monthOf;

  const [orderMonths, soldMonths, events, users] = await Promise.all([
    rowsOf<AdminMetricsRows["orderMonths"][number]>(sql`
      select ${month("orders")} as month,
        sum("orders"."total_amount")::text as revenue,
        sum(coalesce("orders"."platform_fee_amount", 0))::text as fee
      from "orders"
      where "orders"."status" = 'paid' and "orders"."created_at" >= ${since}::timestamp
      group by 1`),
    rowsOf<AdminMetricsRows["soldMonths"][number]>(sql`
      select ${month("orders")} as month, sum((line->>'quantity')::int)::int as value
      from "orders", jsonb_array_elements("orders"."lines") as line
      where "orders"."status" = 'paid' and "orders"."created_at" >= ${since}::timestamp
      group by 1`),
    rowsOf<{ kind: string; key: string; value: number }>(sql`
      select 'status' as kind, "events"."status"::text as key, count(*)::int as value
      from "events" group by 2
      union all
      select 'month', ${month("events")}, count(*)::int
      from "events" where "events"."created_at" >= ${since}::timestamp group by 2`),
    rowsOf<{ kind: string; key: string; value: number }>(sql`
      select 'role' as kind, "users"."role"::text as key, count(*)::int as value
      from "users" where "users"."deleted_at" is null group by 2
      union all
      select 'month', ${month("users")}, count(*)::int
      from "users" where "users"."created_at" >= ${since}::timestamp group by 2`),
  ]);

  const split = (list: typeof events, kind: string) =>
    list.filter((row) => row.kind === kind);

  return toAdminMetrics(
    {
      orderMonths,
      soldMonths,
      eventStatuses: split(events, "status"),
      eventMonths: split(events, "month").map((r) => ({ month: r.key, value: r.value })),
      userRoles: split(users, "role"),
      userMonths: split(users, "month").map((r) => ({ month: r.key, value: r.value })),
    },
    now,
  );
}

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEventPrice } from "@/modules/event";
import { USER_ROLE_LABELS } from "@/modules/user/constants/user.constants";
import type { UserRole } from "@/modules/user/types/user.types";

import type { AdminMetrics } from "../types/admin-metrics.types";
import { AdminExportButton } from "./admin-export-button";
import { AdminKpis } from "./admin-kpis";
import { AdminTrendChart } from "./admin-trend-chart";

export interface AdminDashboardProps {
  metrics: AdminMetrics;
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-wrap gap-3">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd>
                <Badge variant="secondary">{value}</Badge>
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

// Datos ya cargados y autorizados por la pagina (requireRole + getAdminMetrics).
export function AdminDashboard({ metrics }: AdminDashboardProps) {
  const { events, users } = metrics;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight">Resumen</h1>
          <p className="text-muted-foreground">
            Metricas globales de la plataforma. Tendencias de los ultimos 6 meses; el ultimo es el mes en curso.
          </p>
        </div>
        <AdminExportButton metrics={metrics} />
      </div>
      <AdminKpis metrics={metrics} />
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminTrendChart title="Ingresos" series={metrics.revenue} formatValue={formatEventPrice} />
        <AdminTrendChart title="Comision de plataforma" series={metrics.platformFee} formatValue={formatEventPrice} />
        <AdminTrendChart title="Entradas vendidas" series={metrics.sold} />
        <AdminTrendChart title="Usuarios nuevos" series={metrics.newUsers} />
        <AdminTrendChart title="Eventos nuevos" series={metrics.newEvents} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown
          title="Eventos por estado"
          rows={[
            { label: "Publicados", value: events.published },
            { label: "Borrador", value: events.draft },
            { label: "Cancelados", value: events.cancelled },
          ]}
        />
        <Breakdown
          title="Usuarios por rol"
          rows={(Object.keys(users.byRole) as UserRole[]).map((role) => ({
            label: USER_ROLE_LABELS[role],
            value: users.byRole[role],
          }))}
        />
      </div>
    </div>
  );
}

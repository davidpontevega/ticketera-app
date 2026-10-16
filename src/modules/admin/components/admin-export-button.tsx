"use client";

import { Download } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import type { AdminMetrics } from "../types/admin-metrics.types";
import { downloadAdminReport } from "../utils/admin-pdf";

export function AdminExportButton({ metrics }: { metrics: AdminMetrics }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);

  async function handleClick() {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(false);
    try {
      await downloadAdminReport(metrics);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" onClick={handleClick} disabled={loading}>
        <Download aria-hidden />
        {loading ? "Generando..." : "Exportar PDF"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          No se pudo generar el PDF. Intenta de nuevo.
        </p>
      )}
    </div>
  );
}

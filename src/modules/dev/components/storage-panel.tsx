"use client";

import { useEffect, useReducer } from "react";
import { Database, RotateCcw, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";

import type { StorageArea, StorageEntry } from "../types/dev.types";
import {
  clearStorageEntry,
  formatBytes,
  listStorageEntries,
  resetDemoData,
} from "../utils/storage.utils";

function formatJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

const AREA_LABEL: Record<StorageArea, string> = {
  local: "localStorage",
  session: "sessionStorage",
};

function StorageEntryRow({ entry, onDelete }: { entry: StorageEntry; onDelete: () => void }) {
  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 font-mono text-sm font-semibold break-all">{entry.key}</code>
        <Badge variant="secondary">{AREA_LABEL[entry.area]}</Badge>
        <span className="text-xs text-muted-foreground">{formatBytes(entry.bytes)}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="ml-auto text-destructive hover:text-destructive"
          aria-label={`Borrar ${entry.key}`}
        >
          <Trash2 aria-hidden />
          Borrar
        </Button>
      </div>
      <details className="group">
        <summary className="w-fit cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          Ver JSON
        </summary>
        <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
          {formatJson(entry.value)}
        </pre>
      </details>
    </li>
  );
}

export function StoragePanel() {
  const isClient = useIsClient();
  // storage no es reactivo: se fuerza un re-render al borrar o cuando otra pestaña lo cambia
  const [, refresh] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  if (!isClient) return <div aria-busy className="h-96 animate-pulse rounded-2xl bg-muted" />;

  const entries = listStorageEntries();
  const totalBytes = entries.reduce((total, entry) => total + entry.bytes, 0);

  const handleReset = () => {
    if (
      !window.confirm(
        "Se borraran la sesion, las cuentas creadas, los pedidos y los eventos. ¿Continuar?",
      )
    ) {
      return;
    }
    resetDemoData();
    // Recarga completa a proposito: los stores de zustand en memoria tambien deben reiniciarse.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          {entries.length} {entries.length === 1 ? "clave" : "claves"} · {formatBytes(totalBytes)}{" "}
          en este navegador
        </p>
        <Button variant="destructive" onClick={handleReset} className="sm:ml-auto">
          <RotateCcw aria-hidden />
          Reiniciar datos de prueba
        </Button>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Database}
          titleAs="h2"
          title="No hay datos guardados"
          description="Inicia sesion, compra entradas o crea un evento y sus datos apareceran aqui."
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl bg-card ring-1 ring-foreground/10">
          {entries.map((entry) => (
            <StorageEntryRow
              key={`${entry.area}:${entry.key}`}
              entry={entry}
              onDelete={() => {
                clearStorageEntry(entry.key, entry.area);
                refresh();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

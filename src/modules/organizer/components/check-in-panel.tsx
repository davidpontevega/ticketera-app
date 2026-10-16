"use client";

import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { checkInTicketAction } from "../actions/check-in.actions";
import type { CheckInActionState, CheckInStats } from "../types/check-in.types";

export interface CheckInPanelProps {
  eventId: string;
  stats: CheckInStats;
}

const FAILURE_MESSAGES = {
  "not-found": "Entrada no encontrada",
  "wrong-event": "Esta entrada es de otro evento",
  "not-valid": "Entrada no valida (pago pendiente o evento cancelado)",
  cancelled: "Entrada cancelada",
} as const;

type Tone = "success" | "danger" | "warning";

const TONE_CLASSES: Record<Tone, string> = {
  success: "border-green-600 bg-green-50 text-green-900",
  danger: "border-destructive bg-destructive/10 text-destructive",
  warning: "border-amber-600 bg-amber-50 text-amber-900",
};

function formatCheckedInAt(value: string | null): string {
  return value ? new Date(value).toLocaleString("es-PE") : "";
}

function ResultBlock({ state }: { state: Exclude<CheckInActionState, { status: "idle" }> }) {
  let tone: Tone = "danger";
  let title: string;
  let detail: string | null = null;

  switch (state.status) {
    case "valid": {
      const { ticket } = state;
      tone = "success";
      title = "Entrada valida";
      detail = [
        ticket.code,
        ticket.seatLabel ? `${ticket.zoneName} - ${ticket.seatLabel}` : ticket.zoneName,
        ticket.attendeeName || "Sin nombre",
      ].join(" | ");
      break;
    }
    case "already-used":
      title = "Ya usada";
      detail = state.checkedInAt ? `Ingreso el ${formatCheckedInAt(state.checkedInAt)}` : null;
      break;
    case "error":
      title = state.message;
      break;
    default:
      tone = state.status === "not-found" ? "danger" : "warning";
      title = FAILURE_MESSAGES[state.status];
  }

  const Icon = tone === "success" ? CheckCircle2 : XCircle;
  return (
    <div role="status" className={cn("flex items-start gap-3 rounded-lg border p-4", TONE_CLASSES[tone])}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        {detail && <p className="text-sm">{detail}</p>}
      </div>
    </div>
  );
}

export function CheckInPanel({ eventId, stats }: CheckInPanelProps) {
  const [state, formAction, pending] = useActionState<CheckInActionState, FormData>(
    checkInTicketAction,
    { status: "idle" },
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Tras cada resultado: input limpio y con foco para el siguiente escaneo.
  useEffect(() => {
    if (state.status === "idle" || !inputRef.current) return;
    inputRef.current.value = "";
    inputRef.current.focus();
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Ingresados: <span className="font-semibold text-foreground">{stats.checkedIn}/{stats.total}</span>
      </p>
      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="eventId" value={eventId} />
        <Input
          ref={inputRef}
          name="code"
          autoFocus
          autoComplete="off"
          placeholder="TK-XXXXXXXX-NN"
          aria-label="Codigo de entrada"
          className="font-mono uppercase"
        />
        <Button type="submit" disabled={pending}>
          Validar
        </Button>
      </form>
      {state.status !== "idle" && <ResultBlock state={state} />}
    </div>
  );
}

"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { retryEventRefundsAction } from "../actions/refund.actions";
import type { RetryRefundsActionState } from "../types/refund.types";

export interface RetryRefundsButtonProps {
  eventId: string;
}

function resultMessage(state: Exclude<RetryRefundsActionState, { status: "idle" }>): string {
  if (state.status === "error") return state.message;
  const { total, refunded, failed } = state.refunds;
  if (total === 0) return "No hay ordenes pendientes de reembolso.";
  const base = `Reembolsadas ${refunded} de ${total} ordenes.`;
  return failed > 0 ? `${base} ${failed} fallaron: vuelve a intentarlo.` : base;
}

export function RetryRefundsButton({ eventId }: RetryRefundsButtonProps) {
  const [state, formAction, pending] = useActionState<RetryRefundsActionState, FormData>(
    retryEventRefundsAction,
    { status: "idle" },
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="eventId" value={eventId} />
      <Button type="submit" variant="outline" disabled={pending}>
        Reintentar reembolsos
      </Button>
      {state.status !== "idle" && (
        <p role="status" className="text-sm">
          {resultMessage(state)}
        </p>
      )}
    </form>
  );
}

import { Timer, TimerOff } from "lucide-react";

import { cn } from "@/lib/utils";

export interface HoldTimerNoticeProps {
  label: string; // "MM:SS"
  isExpired: boolean;
}

export function HoldTimerNotice({ label, isExpired }: HoldTimerNoticeProps) {
  const Icon = isExpired ? TimerOff : Timer;
  return (
    <p
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-3 text-sm",
        isExpired ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {isExpired ? (
        <span>Tu reserva vencio. Vuelve a elegir tus entradas para continuar.</span>
      ) : (
        <span>
          Reservamos tus entradas por{" "}
          <strong className="font-semibold tabular-nums" role="timer" aria-live="off">
            {label}
          </strong>
          . Completa el pago antes de que se liberen.
        </span>
      )}
    </p>
  );
}

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QuantityStepperProps {
  value: number;
  min?: number;
  max: number;
  label: string; // nombre de lo que se cuenta, para los aria-label
  onChange: (value: number) => void;
  className?: string;
}

export function QuantityStepper({
  value,
  min = 0,
  max,
  label,
  onChange,
  className,
}: QuantityStepperProps) {
  return (
    <div
      className={cn("flex items-center gap-1 rounded-xl border border-border p-0.5", className)}
    >
      <Button
        type="button"
        variant="secondary"
        size="icon-lg"
        className="size-10 rounded-lg"
        aria-label={`Quitar una entrada de ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus aria-hidden />
      </Button>
      <span aria-live="polite" className="w-7 text-center font-semibold tabular-nums">
        {value}
      </span>
      <Button
        type="button"
        size="icon-lg"
        className="size-10 rounded-lg bg-foreground text-background hover:bg-foreground/90"
        aria-label={`Agregar una entrada de ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}

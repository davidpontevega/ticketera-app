import { Plus, Trash2 } from "lucide-react";

import { FORM_INPUT_CLASS_NAME } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { EventFormErrors, EventFormTier } from "../types/organizer.types";
import { getEventCapacity } from "../utils/organizer.utils";

export interface EventTierFieldsProps {
  tiers: readonly EventFormTier[];
  errors: EventFormErrors;
  getFieldId: (key: string) => string;
  onChange: (index: number, field: keyof Omit<EventFormTier, "id">, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

const numberFormatter = new Intl.NumberFormat("es-PE");

const TIER_COLUMNS: readonly {
  field: keyof Omit<EventFormTier, "id">;
  label: string;
  placeholder: string;
}[] = [
  { field: "name", label: "Nombre", placeholder: "Ej. General" },
  { field: "price", label: "Precio (S/)", placeholder: "0" },
  { field: "quantity", label: "Cantidad", placeholder: "0" },
];

export function EventTierFields({
  tiers,
  errors,
  getFieldId,
  onChange,
  onAdd,
  onRemove,
}: EventTierFieldsProps) {
  const capacity = getEventCapacity(
    tiers.map((tier) => ({
      price: Number(tier.price),
      quantity: Math.trunc(Number(tier.quantity)),
    })),
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        aria-hidden
        className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_40px] gap-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:grid"
      >
        {TIER_COLUMNS.map((column) => (
          <span key={column.field}>{column.label}</span>
        ))}
        <span />
      </div>
      <ul className="flex flex-col gap-4 sm:gap-3">
        {tiers.map((tier, index) => (
          <li key={tier.id}>
            <fieldset className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] items-start gap-3 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_40px] sm:border-0 sm:p-0">
              <legend className="sr-only">Tipo de entrada {index + 1}</legend>
              {TIER_COLUMNS.map((column) => {
                const key = `tiers.${index}.${column.field}`;
                const id = getFieldId(key);
                const error = errors[key];
                return (
                  <div
                    key={column.field}
                    className={cn(
                      "flex flex-col gap-1",
                      column.field === "name" && "col-span-3 sm:col-span-1",
                    )}
                  >
                    <label
                      htmlFor={id}
                      className="text-xs font-medium text-muted-foreground sm:sr-only"
                    >
                      {column.label} (tipo {index + 1})
                    </label>
                    <Input
                      id={id}
                      value={tier[column.field]}
                      type={column.field === "name" ? "text" : "number"}
                      inputMode={
                        column.field === "price"
                          ? "decimal"
                          : column.field === "quantity"
                            ? "numeric"
                            : undefined
                      }
                      min={column.field === "name" ? undefined : 0}
                      placeholder={column.placeholder}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `${id}-error` : undefined}
                      onChange={(event) => onChange(index, column.field, event.target.value)}
                      className={FORM_INPUT_CLASS_NAME}
                    />
                    {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
                  </div>
                );
              })}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Quitar tipo de entrada ${index + 1}`}
                disabled={tiers.length === 1}
                onClick={() => onRemove(index)}
                className="mt-6 size-10 sm:mt-0.5"
              >
                <Trash2 aria-hidden />
              </Button>
            </fieldset>
          </li>
        ))}
      </ul>
      {errors.tiers && <FieldError>{errors.tiers}</FieldError>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onAdd} className="h-10">
          <Plus aria-hidden />
          Agregar tipo de entrada
        </Button>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Capacidad total{" "}
          <strong className="font-semibold text-foreground tabular-nums">
            {numberFormatter.format(capacity)} entradas
          </strong>
        </p>
      </div>
    </div>
  );
}

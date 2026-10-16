"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { TextField } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { createZoneAction, updateZoneAction } from "../actions/venue.actions";
import type { VenueZoneDto, VenueZoneInput, VenueZoneKind } from "../types/venue.types";
import { MAX_GENERAL_CAPACITY, MAX_ROWS, MAX_SEATS_PER_ROW } from "../utils/venue.utils";

export interface VenueZoneFormProps {
  venueId: string;
  zone?: VenueZoneDto; // presente = modo edicion
  onDone?: () => void;
}

function toInput(zone?: VenueZoneDto): VenueZoneInput {
  if (!zone) return { name: "", kind: "numbered", capacity: "", rows: "", seatsPerRow: "" };
  return {
    name: zone.name,
    kind: zone.kind,
    capacity: zone.kind === "general" ? String(zone.capacity) : "",
    rows: zone.kind === "numbered" ? String(zone.rows) : "",
    seatsPerRow: zone.kind === "numbered" ? String(zone.seatsPerRow) : "",
  };
}

export function VenueZoneForm({ venueId, zone, onDone }: VenueZoneFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<VenueZoneInput>(() => toInput(zone));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [message, setMessage] = useState<string | null>(null);

  const locked = zone?.inUse ?? false;
  const idPrefix = `zone-${zone?.id ?? "new"}`;

  const field = (key: Exclude<keyof VenueZoneInput, "kind">, label: string, props: Record<string, string> = {}) => (
    <TextField
      id={`${idPrefix}-${key}`}
      label={label}
      value={values[key] ?? ""}
      error={errors[key]}
      inputMode={key === "name" ? undefined : "numeric"}
      onChange={(event) => setValues({ ...values, [key]: event.target.value })}
      {...props}
    />
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = zone ? await updateZoneAction(zone.id, values) : await createZoneAction(venueId, values);
      if (result.status === "error") {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
        return;
      }
      setErrors({});
      if (!zone) setValues(toInput());
      router.refresh();
      onDone?.();
    });
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-label={zone ? `Editar zona ${zone.name}` : "Nueva zona"}
      className="flex flex-col gap-4"
    >
      {field("name", "Nombre de la zona", { placeholder: "Ej. Platea" })}

      {locked ? (
        <p id={`${idPrefix}-locked`} role="status" className="text-sm text-muted-foreground">
          La usa {zone!.usedByEvents} evento(s): solo se puede cambiar el nombre.
        </p>
      ) : (
        <>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-kind`} className="text-sm font-medium text-foreground">
              Tipo de zona
            </FieldLabel>
            <NativeSelect
              id={`${idPrefix}-kind`}
              value={values.kind}
              onChange={(event) => setValues({ ...values, kind: event.target.value as VenueZoneKind })}
              className="w-full [&>select]:h-11 [&>select]:rounded-xl [&>select]:text-[15px]"
            >
              <NativeSelectOption value="numbered">Numerada (filas y asientos)</NativeSelectOption>
              <NativeSelectOption value="general">General (capacidad)</NativeSelectOption>
            </NativeSelect>
          </Field>
          {values.kind === "general" ? (
            field("capacity", `Capacidad (1-${MAX_GENERAL_CAPACITY})`)
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {field("rows", `Filas (1-${MAX_ROWS})`)}
              {field("seatsPerRow", `Asientos por fila (1-${MAX_SEATS_PER_ROW})`)}
            </div>
          )}
        </>
      )}

      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="outline" className="h-11" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isPending} className="h-11">
          {zone ? "Guardar zona" : "Agregar zona"}
        </Button>
      </div>
    </form>
  );
}

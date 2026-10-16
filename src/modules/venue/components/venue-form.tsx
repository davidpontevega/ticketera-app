"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { TextField } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";

import { createVenueAction, updateVenueAction } from "../actions/venue.actions";
import type { VenueDto, VenueInput } from "../types/venue.types";

export interface VenueFormProps {
  venue?: VenueDto; // presente = modo edicion
}

const toInput = (venue?: VenueDto): VenueInput => ({
  name: venue?.name ?? "",
  address: venue?.address ?? "",
  city: venue?.city ?? "",
  latitude: venue?.latitude ?? "",
  longitude: venue?.longitude ?? "",
});

export function VenueForm({ venue }: VenueFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<VenueInput>(() => toInput(venue));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const field = (key: keyof VenueInput, label: string, props: Record<string, string> = {}) => (
    <TextField
      id={`venue-${key}`}
      label={label}
      value={values[key] ?? ""}
      error={errors[key]}
      onChange={(event) => setValues({ ...values, [key]: event.target.value })}
      {...props}
    />
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = venue ? await updateVenueAction(venue.id, values) : await createVenueAction(values);
      if (result.status === "error") {
        setErrors(result.fieldErrors ?? {});
        setMessage({ ok: false, text: result.message });
        return;
      }
      setErrors({});
      if (venue) {
        setMessage({ ok: true, text: "Cambios guardados" });
        router.refresh();
      } else {
        router.push(result.id ? `/organizer/venues/${result.id}` : "/organizer/venues");
      }
    });
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-label="Datos del recinto"
      className="flex flex-col gap-5 rounded-2xl bg-background p-5 ring-1 ring-foreground/10 sm:p-6"
    >
      {field("name", "Nombre del recinto", { placeholder: "Ej. Teatro Municipal" })}
      {field("address", "Direccion")}
      {field("city", "Ciudad")}
      <div className="grid gap-5 sm:grid-cols-2">
        {field("latitude", "Latitud (opcional)", { inputMode: "decimal", placeholder: "-12.0464" })}
        {field("longitude", "Longitud (opcional)", { inputMode: "decimal", placeholder: "-77.0428" })}
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm" : "text-sm text-destructive"}>
          {message.text}
        </p>
      )}
      <Button type="submit" size="lg" disabled={isPending} className="h-12 self-end rounded-xl px-6">
        {venue ? "Guardar cambios" : "Crear recinto"}
      </Button>
    </form>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { TextField } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { focusFormField } from "@/lib/focus-form-field";
import { useAuthStore } from "@/modules/auth";
import { EVENT_CATEGORIES, type EventCategory } from "@/modules/event";

import { ORGANIZER_PATH } from "../constants/organizer.constants";
import { ORGANIZER_EVENTS_MOCK } from "../mocks/organizer.mock";
import {
  createEmptyTier,
  createEventFormValues,
  toEventFormValues,
  toOrganizerEvent,
  validateEventForm,
} from "../schemas/event-form.schema";
import { useOrganizerStore } from "../store/organizer.store";
import type {
  EventFormErrors,
  EventFormMode,
  EventFormTier,
  EventFormValues,
} from "../types/organizer.types";
import { getOrganizerEvents } from "../utils/organizer.utils";
import { EventCoverField } from "./event-cover-field";
import { EventPreview } from "./event-preview";
import { EventTierFields } from "./event-tier-fields";

type EventFormField = Exclude<keyof EventFormValues, "tiers">;

const getFieldId = (key: string) => `event-${key.replaceAll(".", "-")}`;

// Orden visual del formulario: para enfocar el primer error.
function getFieldOrder(values: EventFormValues): string[] {
  return [
    "name",
    "category",
    "description",
    "date",
    "time",
    "venue",
    "city",
    "imageUrl",
    ...values.tiers.flatMap((_, index) => [
      `tiers.${index}.name`,
      `tiers.${index}.price`,
      `tiers.${index}.quantity`,
    ]),
  ];
}

const sectionClassName =
  "flex flex-col gap-5 rounded-2xl bg-background p-5 ring-1 ring-foreground/10 sm:p-6";

// Se renderiza dentro de OrganizerShell, que ya garantiza sesion e hidratacion.
export function EventForm() {
  const router = useRouter();
  const draftId = useSearchParams().get("draft");
  const user = useAuthStore((state) => state.user);
  const storedEvents = useOrganizerStore((state) => state.events);
  const saveEvent = useOrganizerStore((state) => state.saveEvent);

  const ownerEmail = user?.email ?? "";
  const draft = draftId
    ? getOrganizerEvents(storedEvents, ORGANIZER_EVENTS_MOCK, ownerEmail).find(
        (event) => event.id === draftId && event.status === "draft",
      )
    : undefined;

  const [values, setValues] = useState<EventFormValues>(() =>
    draft ? toEventFormValues(draft) : createEventFormValues(),
  );
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [lastMode, setLastMode] = useState<EventFormMode | null>(null);

  const update = (next: EventFormValues) => {
    setValues(next);
    // Despues del primer intento, los errores se actualizan mientras se corrige.
    if (lastMode) setErrors(validateEventForm(next, lastMode));
  };
  const setField = (field: EventFormField, value: string) => update({ ...values, [field]: value });
  const setTier = (index: number, field: keyof Omit<EventFormTier, "id">, value: string) =>
    update({
      ...values,
      tiers: values.tiers.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier)),
    });

  const save = (mode: EventFormMode) => {
    const nextErrors = validateEventForm(values, mode);
    setLastMode(mode);
    setErrors(nextErrors);
    const firstError = getFieldOrder(values).find((key) => nextErrors[key]);
    if (firstError) {
      focusFormField(getFieldId(firstError));
      return;
    }
    saveEvent(
      toOrganizerEvent(values, {
        status: mode === "publish" ? "published" : "draft",
        ownerEmail,
        previous: draft,
      }),
    );
    router.push(ORGANIZER_PATH);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save("publish");
  };

  const textField = (field: EventFormField, label: string, props: Record<string, string> = {}) => (
    <TextField
      id={getFieldId(field)}
      label={label}
      value={values[field]}
      error={errors[field]}
      onChange={(event) => setField(field, event.target.value)}
      {...props}
    />
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={ORGANIZER_PATH}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Mis eventos
        </Link>
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          {draft ? "Editar borrador" : "Crear evento"}
        </h1>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit}
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="event-basic-title" className={sectionClassName}>
            <h2 id="event-basic-title" className="text-lg font-semibold">
              Informacion basica
            </h2>
            {textField("name", "Nombre del evento", { placeholder: "Ej. Festival de verano 2026" })}
            <Field data-invalid={Boolean(errors.category)}>
              <FieldLabel
                htmlFor={getFieldId("category")}
                className="text-sm font-medium text-foreground"
              >
                Categoria
              </FieldLabel>
              <NativeSelect
                id={getFieldId("category")}
                value={values.category}
                onChange={(event) => setField("category", event.target.value as EventCategory)}
                className="w-full [&>select]:h-11 [&>select]:rounded-xl [&>select]:text-[15px]"
              >
                {EVENT_CATEGORIES.map((category) => (
                  <NativeSelectOption key={category.id} value={category.id}>
                    {category.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {errors.category && <FieldError>{errors.category}</FieldError>}
            </Field>
            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel
                htmlFor={getFieldId("description")}
                className="text-sm font-medium text-foreground"
              >
                Descripcion
              </FieldLabel>
              <Textarea
                id={getFieldId("description")}
                rows={4}
                value={values.description}
                placeholder="Cuenta de que trata el evento, quienes se presentan y que incluye la entrada."
                aria-invalid={Boolean(errors.description)}
                aria-describedby={
                  errors.description ? `${getFieldId("description")}-error` : undefined
                }
                onChange={(event) => setField("description", event.target.value)}
                className="min-h-28 rounded-xl px-3.5 py-3 text-[15px] md:text-[15px]"
              />
              {errors.description && (
                <FieldError id={`${getFieldId("description")}-error`}>
                  {errors.description}
                </FieldError>
              )}
            </Field>
          </section>

          <section aria-labelledby="event-place-title" className={sectionClassName}>
            <h2 id="event-place-title" className="text-lg font-semibold">
              Fecha y lugar
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {textField("date", "Fecha", { type: "date" })}
              {textField("time", "Hora de inicio", { type: "time" })}
              {textField("venue", "Lugar", { placeholder: "Ej. Estadio Nacional" })}
              {textField("city", "Ciudad", { placeholder: "Ej. Lima" })}
            </div>
          </section>

          <section aria-labelledby="event-cover-title" className={sectionClassName}>
            <h2 id="event-cover-title" className="text-lg font-semibold">
              Imagen de portada
            </h2>
            <EventCoverField
              id={getFieldId("imageUrl")}
              value={values.imageUrl}
              error={errors.imageUrl}
              onChange={(imageUrl) => setField("imageUrl", imageUrl)}
            />
          </section>

          <section aria-labelledby="event-tiers-title" className={sectionClassName}>
            <div className="flex flex-col gap-1">
              <h2 id="event-tiers-title" className="text-lg font-semibold">
                Tipos de entrada
              </h2>
              <p className="text-sm text-muted-foreground">
                Cada tipo tiene su precio y su cantidad disponible.
              </p>
            </div>
            <EventTierFields
              tiers={values.tiers}
              errors={errors}
              getFieldId={getFieldId}
              onChange={setTier}
              onAdd={() => update({ ...values, tiers: [...values.tiers, createEmptyTier()] })}
              onRemove={(index) =>
                update({ ...values, tiers: values.tiers.filter((_, i) => i !== index) })
              }
            />
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => save("draft")}
              className="h-12 rounded-xl px-6 text-[15px] font-semibold"
            >
              Guardar borrador
            </Button>
            <Button
              type="submit"
              size="lg"
              className="h-12 rounded-xl px-6 text-[15px] font-semibold"
            >
              Publicar evento
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-10">
          <EventPreview values={values} />
        </div>
      </form>
    </div>
  );
}

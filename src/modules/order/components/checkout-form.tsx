"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Info, LogIn, Sparkles, Ticket } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { useCountdown } from "@/hooks/use-countdown";
import { useIsClient } from "@/hooks/use-is-client";
import { focusFormField } from "@/lib/focus-form-field";
import { getAuthHref, useCurrentUser, type AuthUser } from "@/modules/auth";
import { getEventHref, type EventEntity } from "@/modules/event";
import { getTicketLines, useTicketSelectionStore, type VenueLayout } from "@/modules/ticket";

import { CHECKOUT_FIELD_ORDER, CHECKOUT_HOLD_SECONDS } from "../constants/order.constants";
import { CHECKOUT_FORM_DEFAULT, validateCheckout } from "../schemas/checkout.schema";
import { startCheckoutSession } from "../services/order.service";
import type { CheckoutErrors, CheckoutFieldName } from "../types/order.types";
import {
  buildCheckoutSessionInput,
  getCheckoutFieldId,
  getCheckoutPrefill,
  setCheckoutField,
} from "../utils/order.utils";
import { BuyerFields } from "./buyer-fields";
import { CheckoutSummary, CheckoutSummaryToggle } from "./checkout-summary";
import { HoldTimerNotice } from "./hold-timer-notice";

export interface CheckoutFormProps {
  event: EventEntity;
  layout: VenueLayout;
  paymentCancelled?: boolean; // volvio de Stripe sin pagar
}

function focusFirstError(errors: CheckoutErrors) {
  const firstField = CHECKOUT_FIELD_ORDER.find((field) => errors[field]);
  if (firstField) focusFormField(getCheckoutFieldId(firstField));
}

export function CheckoutForm(props: CheckoutFormProps) {
  const isClient = useIsClient();
  const { user, isLoaded } = useCurrentUser();

  // Antes de hidratar no se conoce la seleccion guardada, y Clerk carga el usuario async:
  // el prefill se calcula recien con ambos listos (sin hydration mismatch).
  if (!isClient || !isLoaded) {
    return <div aria-busy className="h-96 animate-pulse rounded-2xl bg-card" />;
  }

  return <CheckoutFormBody {...props} user={user} />;
}

function CheckoutFormBody({
  event,
  layout,
  paymentCancelled = false,
  user,
}: CheckoutFormProps & { user: AuthUser | null }) {
  const { eventId, quantities, seatIds } = useTicketSelectionStore();
  const countdown = useCountdown(CHECKOUT_HOLD_SECONDS);

  // Autocompletado solo en la carga inicial (el cuerpo se monta cuando Clerk ya cargo).
  const [prefill] = useState(() => getCheckoutPrefill(user));
  const [values, setValues] = useState(() => ({
    ...CHECKOUT_FORM_DEFAULT,
    ...prefill,
  }));
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const eventHref = getEventHref(event.slug);
  const ticketsHref = `${eventHref}/tickets`;
  const lines = eventId === event.id ? getTicketLines(layout, quantities, seatIds) : [];

  if (lines.length === 0 && !isPlacing) {
    return (
      <EmptyState
        icon={Ticket}
        title="No tienes entradas seleccionadas"
        description="Elige tu zona y tus entradas para continuar con la compra."
        action={
          <Button
            size="lg"
            render={<Link href={ticketsHref} />}
            nativeButton={false}
            className="h-11 px-5"
          >
            Elegir entradas
          </Button>
        }
      />
    );
  }

  const handleValueChange = (field: CheckoutFieldName, value: string | boolean) => {
    const nextValues = setCheckoutField(values, field, value);
    setValues(nextValues);
    // Despues del primer intento de pago, los errores se actualizan mientras se corrige.
    if (hasSubmitted) setErrors(validateCheckout(nextValues));
  };

  const handleSubmit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (countdown.isExpired || isPlacing) return;

    const nextErrors = validateCheckout(values);
    setHasSubmitted(true);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
      return;
    }

    setIsPlacing(true);
    setSubmitError(null);
    try {
      const { url } = await startCheckoutSession(
        buildCheckoutSessionInput(event.slug, values, { quantities, seatIds }),
      );
      window.location.assign(url); // isPlacing queda en true: el usuario sale de la pagina
    } catch (error) {
      setIsPlacing(false);
      setSubmitError(error instanceof Error ? error.message : "No pudimos iniciar el pago.");
    }
  };

  return (
    <form
      id="checkout-form"
      noValidate
      onSubmit={handleSubmit}
      className="grid items-start gap-5 pb-32 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8 lg:pb-0"
    >
      <div className="flex min-w-0 flex-col gap-5">
        {paymentCancelled && (
          <p className="rounded-xl bg-muted px-4 py-3 text-sm text-foreground">
            Cancelaste el pago. Tu seleccion sigue guardada.
          </p>
        )}
        <HoldTimerNotice label={countdown.label} isExpired={countdown.isExpired} />
        <CheckoutSummaryToggle event={event} lines={lines} ticketsHref={ticketsHref} />
        <BuyerFields
          values={values}
          errors={errors}
          onValueChange={handleValueChange}
          notice={
            user ? (
              prefill.email && (
                <p className="flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2.5 text-sm text-foreground">
                  <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
                  Completamos tus datos con tu cuenta. Puedes editarlos.
                </p>
              )
            ) : (
              <Link
                href={getAuthHref("/login", `${eventHref}/checkout`)}
                className="flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <LogIn className="size-4" aria-hidden />
                Inicia sesion para autocompletar tus datos
              </Link>
            )
          }
        />
        <p className="flex items-start gap-3 rounded-xl bg-primary/5 p-4 text-sm text-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          Seras redirigido a Stripe para completar el pago de forma segura.
        </p>
        <Field
          orientation="horizontal"
          data-invalid={Boolean(errors.acceptedTerms)}
          className="items-start px-1"
        >
          <Checkbox
            id={getCheckoutFieldId("acceptedTerms")}
            checked={values.acceptedTerms}
            onCheckedChange={(checked) => handleValueChange("acceptedTerms", checked)}
            aria-invalid={Boolean(errors.acceptedTerms)}
            className="mt-0.5"
          />
          <div className="flex flex-col gap-1">
            <FieldLabel
              htmlFor={getCheckoutFieldId("acceptedTerms")}
              className="block text-sm font-normal text-foreground"
            >
              Acepto los{" "}
              <a href="#" className="font-medium text-primary hover:underline">
                Terminos y condiciones
              </a>{" "}
              y la{" "}
              <a href="#" className="font-medium text-primary hover:underline">
                Politica de privacidad
              </a>
              .
            </FieldLabel>
            {errors.acceptedTerms && <FieldError>{errors.acceptedTerms}</FieldError>}
          </div>
        </Field>
        {submitError && (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {submitError}
          </p>
        )}
      </div>
      <CheckoutSummary
        event={event}
        lines={lines}
        ticketsHref={ticketsHref}
        isExpired={countdown.isExpired}
        isPlacing={isPlacing}
        hint={values.acceptedTerms ? undefined : "Acepta los terminos para continuar."}
      />
    </form>
  );
}

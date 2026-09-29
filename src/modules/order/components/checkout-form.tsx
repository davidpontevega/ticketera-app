"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { useCountdown } from "@/hooks/use-countdown";
import { useIsClient } from "@/hooks/use-is-client";
import { getEventHref, type EventEntity } from "@/modules/event";
import {
  getTicketLines,
  getTicketTotals,
  useTicketSelectionStore,
  type VenueLayout,
} from "@/modules/ticket";

import { CHECKOUT_FIELD_ORDER, CHECKOUT_HOLD_SECONDS } from "../constants/order.constants";
import { CHECKOUT_FORM_DEFAULT, validateCheckout } from "../schemas/checkout.schema";
import { useOrderStore } from "../store/order.store";
import type { CheckoutErrors, CheckoutFieldName } from "../types/order.types";
import { getCheckoutFieldId, setCheckoutField } from "../utils/order.utils";
import { BuyerFields } from "./buyer-fields";
import { CheckoutSummary, CheckoutSummaryToggle } from "./checkout-summary";
import { HoldTimerNotice } from "./hold-timer-notice";
import { PaymentFields } from "./payment-fields";

export interface CheckoutFormProps {
  event: EventEntity;
  layout: VenueLayout;
}

function focusFirstError(errors: CheckoutErrors) {
  const firstField = CHECKOUT_FIELD_ORDER.find((field) => errors[field]);
  if (!firstField) return;
  const element = document.getElementById(getCheckoutFieldId(firstField));
  // En checkbox/radio de base-ui el id queda en un input oculto: se enfoca el control visible.
  const visibleControl =
    element?.getAttribute("aria-hidden") === "true"
      ? element.closest('[data-slot="field"]')?.querySelector<HTMLElement>('[role="checkbox"]')
      : element;
  visibleControl?.focus();
}

export function CheckoutForm({ event, layout }: CheckoutFormProps) {
  const router = useRouter();
  const isClient = useIsClient();
  const { eventId, quantities, seatIds } = useTicketSelectionStore();
  const placeOrder = useOrderStore((state) => state.placeOrder);
  const countdown = useCountdown(CHECKOUT_HOLD_SECONDS);

  const [values, setValues] = useState(CHECKOUT_FORM_DEFAULT);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);

  const eventHref = getEventHref(event.slug);
  const ticketsHref = `${eventHref}/tickets`;
  const lines = isClient && eventId === event.id ? getTicketLines(layout, quantities, seatIds) : [];

  // Antes de hidratar no se conoce la seleccion guardada en sessionStorage.
  if (!isClient) {
    return <div aria-busy className="h-96 animate-pulse rounded-2xl bg-card" />;
  }

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

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (countdown.isExpired || isPlacing) return;

    const nextErrors = validateCheckout(values);
    setHasSubmitted(true);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
      return;
    }

    const { paymentMethod, fullName, email, documentType, documentNumber, phone } = values;
    setIsPlacing(true);
    placeOrder({
      eventId: event.id,
      buyer: {
        fullName: fullName.trim(),
        email: email.trim(),
        documentType,
        documentNumber: documentNumber.trim(),
        phone: phone.replace(/\s+/g, ""),
      },
      paymentMethod,
      lines,
      total: getTicketTotals(lines).amount,
    });
    router.replace(`${eventHref}/confirmation`);
  };

  return (
    <form
      id="checkout-form"
      noValidate
      onSubmit={handleSubmit}
      className="grid items-start gap-5 pb-32 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8 lg:pb-0"
    >
      <div className="flex min-w-0 flex-col gap-5">
        <HoldTimerNotice label={countdown.label} isExpired={countdown.isExpired} />
        <CheckoutSummaryToggle event={event} lines={lines} ticketsHref={ticketsHref} />
        <BuyerFields values={values} errors={errors} onValueChange={handleValueChange} />
        <PaymentFields
          paymentMethod={values.paymentMethod}
          card={values.card}
          errors={errors}
          onValueChange={handleValueChange}
        />
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
      </div>
      <CheckoutSummary
        event={event}
        lines={lines}
        ticketsHref={ticketsHref}
        isExpired={countdown.isExpired}
        hint={values.acceptedTerms ? undefined : "Acepta los terminos para continuar."}
      />
    </form>
  );
}

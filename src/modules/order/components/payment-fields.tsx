import { Info } from "lucide-react";

import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { PAYMENT_METHOD_OPTIONS } from "../constants/order.constants";
import type {
  CardInfo,
  CheckoutErrors,
  CheckoutFieldName,
  PaymentMethod,
} from "../types/order.types";
import { getCheckoutFieldId } from "../utils/order.utils";
import { CheckoutTextField } from "./checkout-text-field";

export interface PaymentFieldsProps {
  paymentMethod: PaymentMethod;
  card: CardInfo;
  errors: CheckoutErrors;
  onValueChange: (field: CheckoutFieldName, value: string) => void;
}

export function PaymentFields({ paymentMethod, card, errors, onValueChange }: PaymentFieldsProps) {
  const selected = PAYMENT_METHOD_OPTIONS.find((option) => option.value === paymentMethod);

  return (
    <section
      aria-labelledby="payment-fields-title"
      className="flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-7"
    >
      <h2 id="payment-fields-title" className="text-lg font-semibold">
        Metodo de pago
      </h2>
      <RadioGroup
        id={getCheckoutFieldId("paymentMethod")}
        aria-labelledby="payment-fields-title"
        value={paymentMethod}
        onValueChange={(value) => onValueChange("paymentMethod", value as PaymentMethod)}
        className="grid gap-2 sm:grid-cols-3 sm:gap-3"
      >
        {PAYMENT_METHOD_OPTIONS.map(({ value, label, icon: Icon }) => {
          const id = `payment-method-${value}`;
          return (
            <FieldLabel key={value} htmlFor={id} className="cursor-pointer rounded-xl">
              <Field orientation="horizontal" className="min-h-14 gap-2 px-3 sm:gap-3">
                <RadioGroupItem value={value} id={id} />
                <Icon
                  className="size-4 shrink-0 text-muted-foreground sm:hidden md:block"
                  aria-hidden
                />
                <span className="text-sm font-semibold">{label}</span>
              </Field>
            </FieldLabel>
          );
        })}
      </RadioGroup>

      {paymentMethod === "card" ? (
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <CheckoutTextField
            field="card.number"
            label="Numero de tarjeta"
            value={card.number}
            error={errors["card.number"]}
            onValueChange={onValueChange}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="0000 0000 0000 0000"
            className="sm:col-span-2"
          />
          <CheckoutTextField
            field="card.expiry"
            label="Vencimiento"
            value={card.expiry}
            error={errors["card.expiry"]}
            onValueChange={onValueChange}
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/AA"
          />
          <CheckoutTextField
            field="card.cvc"
            label="CVV"
            value={card.cvc}
            error={errors["card.cvc"]}
            onValueChange={onValueChange}
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="3 o 4 digitos"
          />
          <CheckoutTextField
            field="card.holderName"
            label="Nombre en la tarjeta"
            value={card.holderName}
            error={errors["card.holderName"]}
            onValueChange={onValueChange}
            autoComplete="cc-name"
            placeholder="Como aparece en la tarjeta"
            className="sm:col-span-2"
          />
        </div>
      ) : (
        <p className="flex items-start gap-3 rounded-xl bg-primary/5 p-4 text-sm text-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {selected?.hint}
        </p>
      )}
    </section>
  );
}

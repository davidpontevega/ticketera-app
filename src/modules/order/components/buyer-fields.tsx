import { FORM_INPUT_CLASS_NAME } from "@/components/shared/text-field";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { DOCUMENT_TYPE_OPTIONS } from "../constants/order.constants";
import type { BuyerInfo, CheckoutErrors, CheckoutFieldName } from "../types/order.types";
import { getCheckoutFieldId } from "../utils/order.utils";
import { CheckoutTextField } from "./checkout-text-field";

export interface BuyerFieldsProps {
  values: BuyerInfo;
  errors: CheckoutErrors;
  onValueChange: (field: CheckoutFieldName, value: string) => void;
}

export function BuyerFields({ values, errors, onValueChange }: BuyerFieldsProps) {
  const documentId = getCheckoutFieldId("documentNumber");
  const documentError = errors.documentNumber;

  return (
    <section
      aria-labelledby="buyer-fields-title"
      className="flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-7"
    >
      <div className="flex flex-col gap-1">
        <h2 id="buyer-fields-title" className="text-lg font-semibold">
          Datos del comprador
        </h2>
        <p className="text-sm text-muted-foreground">
          Enviaremos tus entradas al correo que indiques.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        <CheckoutTextField
          field="fullName"
          label="Nombre completo"
          value={values.fullName}
          error={errors.fullName}
          onValueChange={onValueChange}
          autoComplete="name"
          placeholder="Como figura en tu documento"
        />
        <CheckoutTextField
          field="email"
          label="Correo electronico"
          type="email"
          value={values.email}
          error={errors.email}
          onValueChange={onValueChange}
          autoComplete="email"
          placeholder="tu@email.com"
        />
        <Field data-invalid={Boolean(documentError)}>
          <FieldLabel htmlFor={documentId} className="text-sm font-medium text-foreground">
            Documento de identidad
          </FieldLabel>
          <div className="flex gap-2">
            <NativeSelect
              id={getCheckoutFieldId("documentType")}
              aria-label="Tipo de documento"
              value={values.documentType}
              onChange={(event) => onValueChange("documentType", event.target.value)}
              className="w-28 shrink-0 [&>select]:h-11 [&>select]:rounded-xl [&>select]:text-[15px]"
            >
              {DOCUMENT_TYPE_OPTIONS.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Input
              id={documentId}
              name="documentNumber"
              value={values.documentNumber}
              inputMode={values.documentType === "dni" ? "numeric" : "text"}
              placeholder="Numero"
              aria-invalid={Boolean(documentError)}
              aria-describedby={documentError ? `${documentId}-error` : undefined}
              onChange={(event) => onValueChange("documentNumber", event.target.value)}
              className={FORM_INPUT_CLASS_NAME}
            />
          </div>
          {documentError && <FieldError id={`${documentId}-error`}>{documentError}</FieldError>}
        </Field>
        <CheckoutTextField
          field="phone"
          label="Celular"
          type="tel"
          value={values.phone}
          error={errors.phone}
          onValueChange={onValueChange}
          autoComplete="tel"
          inputMode="tel"
          placeholder="987 654 321"
        />
      </div>
    </section>
  );
}

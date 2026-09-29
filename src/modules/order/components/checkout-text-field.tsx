import type { ComponentProps } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type { CheckoutFieldName } from "../types/order.types";
import { getCheckoutFieldId } from "../utils/order.utils";

export interface CheckoutTextFieldProps extends Omit<
  ComponentProps<"input">,
  "id" | "value" | "onChange" | "name"
> {
  field: CheckoutFieldName;
  label: string;
  value: string;
  error?: string;
  onValueChange: (field: CheckoutFieldName, value: string) => void;
}

export const checkoutInputClassName = "h-11 rounded-xl px-3.5 text-[15px] md:text-[15px]";

export function CheckoutTextField({
  field,
  label,
  value,
  error,
  onValueChange,
  className,
  ...inputProps
}: CheckoutTextFieldProps) {
  const id = getCheckoutFieldId(field);
  return (
    <Field data-invalid={Boolean(error)} className={className}>
      <FieldLabel htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </FieldLabel>
      <Input
        id={id}
        name={field}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onValueChange(field, event.target.value)}
        className={checkoutInputClassName}
        {...inputProps}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}

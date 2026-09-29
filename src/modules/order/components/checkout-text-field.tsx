import { TextField, type TextFieldProps } from "@/components/shared/text-field";

import type { CheckoutFieldName } from "../types/order.types";
import { getCheckoutFieldId } from "../utils/order.utils";

export interface CheckoutTextFieldProps extends Omit<
  TextFieldProps,
  "id" | "name" | "value" | "onChange"
> {
  field: CheckoutFieldName;
  value: string;
  onValueChange: (field: CheckoutFieldName, value: string) => void;
}

// TextField del checkout: id/name derivados del campo y cambio tipado por CheckoutFieldName.
export function CheckoutTextField({ field, onValueChange, ...props }: CheckoutTextFieldProps) {
  return (
    <TextField
      id={getCheckoutFieldId(field)}
      name={field}
      onChange={(event) => onValueChange(field, event.target.value)}
      {...props}
    />
  );
}

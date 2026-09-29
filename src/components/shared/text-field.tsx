import type { ComponentProps, ReactNode } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const FORM_INPUT_CLASS_NAME = "h-11 rounded-xl px-3.5 text-[15px] md:text-[15px]";

export interface TextFieldProps extends Omit<ComponentProps<"input">, "id"> {
  id: string;
  label: string;
  error?: string;
  labelAction?: ReactNode; // ej. link "¿Olvidaste tu contraseña?" a la derecha del label
  trailing?: ReactNode; // ej. boton dentro del input, a la derecha
  inputClassName?: string;
}

// Label + input + mensaje de error, con aria-invalid y aria-describedby.
export function TextField({
  id,
  label,
  error,
  labelAction,
  trailing,
  className,
  inputClassName,
  ...inputProps
}: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <Field data-invalid={Boolean(error)} className={className}>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </FieldLabel>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(FORM_INPUT_CLASS_NAME, trailing && "pr-12", inputClassName)}
          {...inputProps}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
}

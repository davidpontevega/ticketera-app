"use client";

import { useState, type FormEvent } from "react";

import { focusFormField } from "@/lib/focus-form-field";

import type { FormErrors } from "../types/auth.types";

const SUBMIT_DELAY_MS = 600; // simula la espera de un backend

export interface UseAuthFormOptions<T> {
  initialValues: T;
  validate: (values: T) => FormErrors<T>;
  fieldOrder: readonly (keyof T & string)[];
  getFieldId: (field: keyof T & string) => string;
  // Puede devolver errores (ej. "contraseña incorrecta") para mostrarlos en el formulario.
  onValid: (values: T) => void | FormErrors<T> | Promise<void | FormErrors<T>>;
}

// Formulario controlado: errores en vivo despues del primer envio, foco al primer error
// y estado "enviando" mientras se simula la respuesta.
export function useAuthForm<T>({
  initialValues,
  validate,
  fieldOrder,
  getFieldId,
  onValid,
}: UseAuthFormOptions<T>) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = <K extends keyof T>(field: K, value: T[K]) => {
    const next = { ...values, [field]: value };
    setValues(next);
    if (hasSubmitted) setErrors(validate(next));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    const nextErrors = validate(values);
    setHasSubmitted(true);
    setErrors(nextErrors);
    const firstError = fieldOrder.find((field) => nextErrors[field]);
    if (firstError) {
      focusFormField(getFieldId(firstError));
      return;
    }
    setIsSubmitting(true);
    setTimeout(async () => {
      const submitErrors = await onValid(values);
      if (!submitErrors || Object.keys(submitErrors).length === 0) return;
      setErrors(submitErrors);
      setIsSubmitting(false);
      const firstSubmitError = fieldOrder.find((field) => submitErrors[field]);
      if (firstSubmitError) focusFormField(getFieldId(firstSubmitError));
    }, SUBMIT_DELAY_MS);
  };

  return { values, errors, isSubmitting, setValue, handleSubmit };
}

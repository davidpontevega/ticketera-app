"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { PasswordField } from "@/components/shared/password-field";
import { TextField } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { useIsClient } from "@/hooks/use-is-client";

import { useAuthForm } from "../hooks/use-auth-form";
import { REGISTER_FORM_DEFAULT, validateRegister } from "../schemas/auth.schema";
import { useAuthStore } from "../store/auth.store";
import type { RegisterFormValues } from "../types/auth.types";
import { getAuthHref, getSafeRedirect } from "../utils/auth.utils";
import { AuthDivider } from "./auth-divider";
import { AuthSignedIn } from "./auth-signed-in";
import { AuthTabs } from "./auth-tabs";
import { GoogleSignInButton } from "./google-sign-in-button";

const getFieldId = (field: keyof RegisterFormValues) => `register-${field}`;

export function RegisterForm() {
  const router = useRouter();
  const redirectParam = useSearchParams().get("redirect");
  const redirectHref = getSafeRedirect(redirectParam);
  const isClient = useIsClient();
  const user = useAuthStore((state) => state.user);
  const register = useAuthStore((state) => state.register);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { values, errors, isSubmitting, setValue, handleSubmit } = useAuthForm({
    initialValues: REGISTER_FORM_DEFAULT,
    validate: validateRegister,
    fieldOrder: ["fullName", "email", "password", "acceptedTerms"],
    getFieldId,
    onValid: async ({ fullName, email, password }) => {
      const result = await register({ fullName, email, password });
      if (!result.ok) return { [result.field]: result.message };
      setIsRedirecting(true);
      router.replace(redirectHref);
    },
  });

  if (isClient && user && !isSubmitting && !isRedirecting) {
    return <AuthSignedIn user={user} redirectHref={redirectHref} />;
  }

  const termsId = getFieldId("acceptedTerms");

  return (
    <>
      <AuthTabs current="/register" />
      <GoogleSignInButton
        mode="signup"
        onSuccess={(profile) => {
          setIsRedirecting(true);
          loginWithGoogle(profile);
          router.replace(redirectHref);
        }}
      />
      <AuthDivider label="o con tu correo" />
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight">Crea tu cuenta</h1>
          <p className="text-muted-foreground">
            Guarda tus entradas y recibe novedades de tus eventos.
          </p>
        </div>
        <TextField
          id={getFieldId("fullName")}
          label="Nombre completo"
          autoComplete="name"
          placeholder="Tu nombre y apellido"
          value={values.fullName}
          error={errors.fullName}
          onChange={(event) => setValue("fullName", event.target.value)}
        />
        <TextField
          id={getFieldId("email")}
          label="Correo electronico"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          value={values.email}
          error={errors.email}
          onChange={(event) => setValue("email", event.target.value)}
        />
        <PasswordField
          id={getFieldId("password")}
          label="Contraseña"
          autoComplete="new-password"
          placeholder="Minimo 8 caracteres, con letras y numeros"
          value={values.password}
          error={errors.password}
          onChange={(event) => setValue("password", event.target.value)}
        />
        <Field
          orientation="horizontal"
          data-invalid={Boolean(errors.acceptedTerms)}
          className="items-start"
        >
          <Checkbox
            id={termsId}
            checked={values.acceptedTerms}
            onCheckedChange={(checked) => setValue("acceptedTerms", checked)}
            aria-invalid={Boolean(errors.acceptedTerms)}
            className="mt-0.5"
          />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={termsId} className="block text-sm font-normal text-foreground">
              Acepto los{" "}
              <a href="#" className="font-medium text-primary hover:underline">
                Terminos y condiciones
              </a>
            </FieldLabel>
            {errors.acceptedTerms && <FieldError>{errors.acceptedTerms}</FieldError>}
          </div>
        </Field>
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="h-12 rounded-xl text-base font-semibold"
        >
          {isSubmitting && <Loader2 aria-hidden className="animate-spin" />}
          {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link
            href={getAuthHref("/login", redirectParam)}
            replace
            className="font-semibold text-primary hover:underline"
          >
            Inicia sesion
          </Link>
        </p>
      </form>
    </>
  );
}

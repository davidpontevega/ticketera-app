"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { PasswordField } from "@/components/shared/password-field";
import { TextField } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";

import { useAuthForm } from "../hooks/use-auth-form";
import { LOGIN_FORM_DEFAULT, validateLogin } from "../schemas/auth.schema";
import { useAuthStore } from "../store/auth.store";
import type { LoginFormValues } from "../types/auth.types";
import { getAuthHref, getSafeRedirect } from "../utils/auth.utils";
import { AuthSignedIn } from "./auth-signed-in";
import { AuthTabs } from "./auth-tabs";

const getFieldId = (field: keyof LoginFormValues) => `login-${field}`;

export function LoginForm() {
  const router = useRouter();
  const redirectParam = useSearchParams().get("redirect");
  const redirectHref = getSafeRedirect(redirectParam);
  const isClient = useIsClient();
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);

  const { values, errors, isSubmitting, setValue, handleSubmit } = useAuthForm({
    initialValues: LOGIN_FORM_DEFAULT,
    validate: validateLogin,
    fieldOrder: ["email", "password"],
    getFieldId,
    onValid: ({ email }) => {
      login(email);
      router.replace(redirectHref);
    },
  });

  if (isClient && user && !isSubmitting) {
    return <AuthSignedIn user={user} redirectHref={redirectHref} />;
  }

  return (
    <>
      <AuthTabs current="/login" />
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight">Hola de nuevo</h1>
          <p className="text-muted-foreground">
            Ingresa para ver tus entradas y comprar mas rapido.
          </p>
        </div>
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
          autoComplete="current-password"
          value={values.password}
          error={errors.password}
          onChange={(event) => setValue("password", event.target.value)}
          labelAction={
            <a href="#" className="text-sm font-medium text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
          }
        />
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="h-12 rounded-xl text-base font-semibold"
        >
          {isSubmitting && <Loader2 aria-hidden className="animate-spin" />}
          {isSubmitting ? "Ingresando..." : "Iniciar sesion"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link
            href={getAuthHref("/register", redirectParam)}
            replace
            className="font-semibold text-primary hover:underline"
          >
            Crea una gratis
          </Link>
        </p>
      </form>
    </>
  );
}

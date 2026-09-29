"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { PasswordField } from "@/components/shared/password-field";
import { TextField } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";
import { DEV_INBOX_PATH } from "@/modules/dev";

import { useAuthForm } from "../hooks/use-auth-form";
import { LOGIN_FORM_DEFAULT, validateLogin } from "../schemas/auth.schema";
import { useAuthStore } from "../store/auth.store";
import type { LoginFormValues } from "../types/auth.types";
import { DEMO_ACCOUNT, getAuthHref, getSafeRedirect } from "../utils/auth.utils";
import { AuthDivider } from "./auth-divider";
import { AuthSignedIn } from "./auth-signed-in";
import { AuthTabs } from "./auth-tabs";
import { GoogleSignInButton } from "./google-sign-in-button";

const getFieldId = (field: keyof LoginFormValues) => `login-${field}`;

export function LoginForm() {
  const router = useRouter();
  const redirectParam = useSearchParams().get("redirect");
  const redirectHref = getSafeRedirect(redirectParam);
  const isClient = useIsClient();
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { values, errors, isSubmitting, setValue, handleSubmit } = useAuthForm({
    initialValues: LOGIN_FORM_DEFAULT,
    validate: validateLogin,
    fieldOrder: ["email", "password"],
    getFieldId,
    onValid: async (credentials) => {
      const result = await login(credentials);
      if (!result.ok) return { [result.field]: result.message };
      setIsRedirecting(true);
      router.replace(redirectHref);
    },
  });

  if (isClient && user && !isSubmitting && !isRedirecting) {
    return <AuthSignedIn user={user} redirectHref={redirectHref} />;
  }

  return (
    <>
      <AuthTabs current="/login" />
      <GoogleSignInButton
        mode="signin"
        onSuccess={(profile) => {
          setIsRedirecting(true);
          loginWithGoogle(profile);
          router.replace(redirectHref);
        }}
      />
      <AuthDivider label="o con tu correo" />
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
            <Link
              href={getAuthHref("/forgot-password", redirectParam)}
              className="text-sm font-medium text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
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
        <div className="flex flex-col items-center gap-1 rounded-xl bg-muted px-4 py-3 text-center text-xs text-muted-foreground">
          <p>
            Cuenta de prueba:{" "}
            <strong className="whitespace-nowrap text-foreground">{DEMO_ACCOUNT.email}</strong> /{" "}
            <strong className="text-foreground">{DEMO_ACCOUNT.password}</strong>
          </p>
          <Link href={DEV_INBOX_PATH} className="font-medium text-primary hover:underline">
            Abrir bandeja de prueba
          </Link>
        </div>
      </form>
    </>
  );
}

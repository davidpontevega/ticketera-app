"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Inbox, Loader2, MailCheck } from "lucide-react";

import { TextField } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";
import { DEV_INBOX_PATH, useDevMailStore } from "@/modules/dev";

import { useAuthForm } from "../hooks/use-auth-form";
import { validateForgotPassword } from "../schemas/auth.schema";
import { useAuthStore } from "../store/auth.store";
import type { ForgotPasswordValues } from "../types/auth.types";
import { getAuthHref, normalizeEmail } from "../utils/auth.utils";

const getFieldId = (field: keyof ForgotPasswordValues) => `forgot-${field}`;

export const RESET_PASSWORD_PATH = "/reset-password";

export function ForgotPasswordForm() {
  const redirectParam = useSearchParams().get("redirect");
  const accounts = useAuthStore((state) => state.accounts);
  const createResetToken = useDevMailStore((state) => state.createResetToken);
  const sendMockEmail = useDevMailStore((state) => state.sendMockEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const { values, errors, isSubmitting, setValue, handleSubmit } = useAuthForm({
    initialValues: { email: "" },
    validate: validateForgotPassword,
    fieldOrder: ["email"],
    getFieldId,
    onValid: ({ email }) => {
      const normalized = normalizeEmail(email);
      const account = accounts.find((item) => item.email === normalized);
      // Siempre se muestra el mismo mensaje: no se revela si el correo esta registrado.
      if (account) {
        const { token } = createResetToken(account.email);
        sendMockEmail({
          to: account.email,
          subject: "Restablece tu contraseña de Ticketera",
          body: `Hola ${account.fullName}, recibimos un pedido para restablecer la contraseña de tu cuenta. El enlace vence en 30 minutos y se puede usar una sola vez. Si no fuiste tu, ignora este correo.`,
          actionLabel: "Restablecer contraseña",
          actionHref: `${RESET_PASSWORD_PATH}?token=${token}`,
        });
      }
      setSentTo(normalized);
    },
  });

  const backToLogin = (
    <Link
      href={getAuthHref("/login", redirectParam)}
      className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Volver a iniciar sesion
    </Link>
  );

  if (sentTo) {
    return (
      <div className="flex flex-col gap-5">
        {backToLogin}
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-card p-8 text-center ring-1 ring-foreground/10">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="size-6" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-xl font-semibold">Revisa tu correo</h1>
            <p className="text-sm text-muted-foreground">
              Si existe una cuenta con <span className="font-medium text-foreground">{sentTo}</span>
              , te enviamos un enlace para restablecer tu contraseña. Vence en 30 minutos.
            </p>
          </div>
          <Button
            size="lg"
            render={<Link href={DEV_INBOX_PATH} />}
            nativeButton={false}
            className="h-11 w-full"
          >
            <Inbox aria-hidden />
            Abrir bandeja de prueba
          </Button>
          <p className="text-xs text-muted-foreground">
            Modo de prueba: los correos no se envian, llegan a la bandeja de la app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      {backToLogin}
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          ¿Olvidaste tu contraseña?
        </h1>
        <p className="text-muted-foreground">
          Ingresa tu correo y te enviaremos un enlace para crear una nueva.
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
      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="h-12 rounded-xl text-base font-semibold"
      >
        {isSubmitting && <Loader2 aria-hidden className="animate-spin" />}
        {isSubmitting ? "Enviando..." : "Enviar enlace"}
      </Button>
    </form>
  );
}

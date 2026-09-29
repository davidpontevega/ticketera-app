"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleCheck, KeyRound, Loader2, TriangleAlert } from "lucide-react";

import { PasswordField } from "@/components/shared/password-field";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";
import { useDevMailStore } from "@/modules/dev";

import { useAuthForm } from "../hooks/use-auth-form";
import { validateResetPassword } from "../schemas/auth.schema";
import { useAuthStore } from "../store/auth.store";
import type { ResetPasswordValues } from "../types/auth.types";

const getFieldId = (field: keyof ResetPasswordValues) => `reset-${field}`;

function ResultPanel({
  icon: Icon,
  tone,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: typeof KeyRound;
  tone: "success" | "error";
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-card p-8 text-center ring-1 ring-foreground/10">
      <span
        className={
          tone === "success"
            ? "flex size-12 items-center justify-center rounded-full bg-success/10 text-success"
            : "flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"
        }
      >
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button
        size="lg"
        render={<Link href={actionHref} />}
        nativeButton={false}
        className="h-11 w-full"
      >
        {actionLabel}
      </Button>
    </div>
  );
}

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const isClient = useIsClient();
  const getResetTokenStatus = useDevMailStore((state) => state.getResetTokenStatus);
  const consumeResetToken = useDevMailStore((state) => state.consumeResetToken);
  const updatePassword = useAuthStore((state) => state.updatePassword);
  const [isDone, setIsDone] = useState(false);

  const { values, errors, isSubmitting, setValue, handleSubmit } = useAuthForm({
    initialValues: { password: "", confirmPassword: "" },
    validate: validateResetPassword,
    fieldOrder: ["password", "confirmPassword"],
    getFieldId,
    onValid: async ({ password }) => {
      const email = consumeResetToken(token);
      if (!email) return { password: "El enlace no es valido o expiro. Solicita otro." };
      await updatePassword(email, password);
      setIsDone(true);
    },
  });

  if (!isClient) {
    return <div aria-busy className="h-72 animate-pulse rounded-2xl bg-muted" />;
  }

  if (isDone) {
    return (
      <ResultPanel
        icon={CircleCheck}
        tone="success"
        title="Contraseña actualizada"
        description="Ya puedes iniciar sesion con tu nueva contraseña."
        actionHref="/login"
        actionLabel="Iniciar sesion"
      />
    );
  }

  const status = getResetTokenStatus(token);
  if (status.status !== "valid" && !isSubmitting) {
    return (
      <ResultPanel
        icon={TriangleAlert}
        tone="error"
        title="El enlace no es valido o expiro"
        description="Los enlaces para restablecer la contraseña vencen en 30 minutos y se pueden usar una sola vez."
        actionHref="/forgot-password"
        actionLabel="Solicitar otro enlace"
      />
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">
          Crea una nueva contraseña
        </h1>
        {status.status === "valid" && (
          <p className="text-muted-foreground">
            Para la cuenta <span className="font-medium text-foreground">{status.email}</span>.
          </p>
        )}
      </div>
      <PasswordField
        id={getFieldId("password")}
        label="Nueva contraseña"
        autoComplete="new-password"
        placeholder="Minimo 8 caracteres, con letras y numeros"
        value={values.password}
        error={errors.password}
        onChange={(event) => setValue("password", event.target.value)}
      />
      <PasswordField
        id={getFieldId("confirmPassword")}
        label="Repite la contraseña"
        autoComplete="new-password"
        value={values.confirmPassword}
        error={errors.confirmPassword}
        onChange={(event) => setValue("confirmPassword", event.target.value)}
      />
      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="h-12 rounded-xl text-base font-semibold"
      >
        {isSubmitting && <Loader2 aria-hidden className="animate-spin" />}
        {isSubmitting ? "Guardando..." : "Guardar contraseña"}
      </Button>
    </form>
  );
}

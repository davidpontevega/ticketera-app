"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { startConnectOnboardingAction } from "../actions/connect.actions";
import type { ConnectActionState, OnboardingStatus } from "../types/payment.types";

export interface ConnectStatusCardProps {
  status: OnboardingStatus;
  enabled: boolean;
}

const STATUS_COPY: Record<OnboardingStatus, { label: string; description: string; button: string }> = {
  not_started: {
    label: "No iniciado",
    description: "Conecta tu cuenta de Stripe para recibir los pagos de tus eventos.",
    button: "Conectar con Stripe",
  },
  pending: {
    label: "Pendiente",
    description: "Falta completar la informacion de tu cuenta en Stripe.",
    button: "Continuar onboarding",
  },
  complete: {
    label: "Listo",
    description: "Tu cuenta esta lista para recibir pagos.",
    button: "",
  },
};

export function ConnectStatusCard({ status, enabled }: ConnectStatusCardProps) {
  const [state, formAction, pending] = useActionState<ConnectActionState>(startConnectOnboardingAction, {});
  const copy = STATUS_COPY[status];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Pagos con Stripe
          {enabled && <Badge variant={status === "complete" ? "default" : "secondary"}>{copy.label}</Badge>}
        </CardTitle>
        <CardDescription>{enabled ? copy.description : "Stripe Connect desactivado"}</CardDescription>
      </CardHeader>
      {enabled && status !== "complete" && (
        <CardContent className="flex flex-col gap-3">
          <form action={formAction}>
            <Button type="submit" disabled={pending}>
              {copy.button}
            </Button>
          </form>
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

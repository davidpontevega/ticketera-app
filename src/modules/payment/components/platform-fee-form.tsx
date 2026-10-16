"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updatePlatformFeeAction } from "../actions/platform-settings.actions";
import { FEE_PERCENT_MAX } from "../constants/payment.constants";
import type { FeeActionState } from "../types/payment.types";

export interface PlatformFeeFormProps {
  feePercent: number;
  updatedAt: Date | null;
}

export function PlatformFeeForm({ feePercent, updatedAt }: PlatformFeeFormProps) {
  const [state, formAction, pending] = useActionState<FeeActionState, FormData>(updatePlatformFeeAction, {});

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Comision de la plataforma</CardTitle>
        <CardDescription>
          Porcentaje retenido de cada orden. {updatedAt ? `Ultima actualizacion: ${updatedAt.toLocaleString("es-PE")}` : "Valor por defecto, sin cambios."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <Label htmlFor="feePercent">Porcentaje (0 a {FEE_PERCENT_MAX})</Label>
          <Input
            id="feePercent"
            name="feePercent"
            type="number"
            step="0.01"
            min={0}
            max={FEE_PERCENT_MAX}
            defaultValue={feePercent}
            required
          />
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state.success && (
            <p role="status" className="text-sm text-green-700">
              Comision actualizada
            </p>
          )}
          <Button type="submit" disabled={pending} className="self-start">
            Guardar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

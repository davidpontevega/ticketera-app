"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEventDate, formatEventPrice } from "@/modules/event";

import { releasePayoutsAction } from "../actions/payout.actions";
import type { PayoutActionState, PayoutStatus, PayoutSummary } from "../types/payment.types";

export interface PayoutHoldCardProps {
  summary: PayoutSummary;
}

const STATUS_BADGE: Record<PayoutStatus, { label: string; variant: "secondary" | "default" | "outline" }> = {
  held: { label: "Retenido", variant: "secondary" },
  available: { label: "Disponible", variant: "default" },
  released: { label: "Liberado", variant: "outline" },
};

export function PayoutHoldCard({ summary }: PayoutHoldCardProps) {
  const [state, formAction, pending] = useActionState<PayoutActionState>(releasePayoutsAction, {});
  const hasAvailable = summary.rows.some((r) => r.status === "available");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fondos retenidos: {formatEventPrice(summary.heldTotal)}</CardTitle>
        <CardDescription>Podras retirar los fondos de cada evento a partir de su fecha de liberacion.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {summary.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no tienes ventas con pagos a retener.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Liberacion</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.rows.map((row) => (
                <TableRow key={row.eventId}>
                  <TableCell>{row.title}</TableCell>
                  <TableCell>{formatEventPrice(row.amount)}</TableCell>
                  <TableCell>{formatEventDate(row.releaseAt.toISOString())}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[row.status].variant}>{STATUS_BADGE[row.status].label}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <form action={formAction}>
          <Button type="submit" disabled={!hasAvailable || pending}>
            Retirar fondos disponibles
          </Button>
        </form>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

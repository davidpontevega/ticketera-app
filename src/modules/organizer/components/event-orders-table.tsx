"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEventPrice } from "@/modules/event";

import { refundOrderAction } from "../actions/refund.actions";
import type { EventOrderRow, RefundActionState } from "../types/refund.types";

export interface EventOrdersTableProps {
  eventId: string;
  orders: EventOrderRow[];
}

const RESULT_MESSAGES = {
  refunded: "Orden reembolsada. Las entradas fueron canceladas.",
  "not-found": "Orden no encontrada",
  "not-refundable": "La orden no se puede reembolsar (no esta pagada o no tiene un pago asociado)",
  "has-used-tickets": "La orden tiene entradas ya usadas en puerta",
} as const;

function ResultBlock({ state }: { state: Exclude<RefundActionState, { status: "idle" }> }) {
  const message =
    state.status === "error"
      ? state.message
      : state.status === "stripe-error"
        ? `Error al reembolsar en Stripe: ${state.message}`
        : RESULT_MESSAGES[state.status];
  const ok = state.status === "refunded";
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div
      role="status"
      className={
        ok
          ? "flex items-start gap-3 rounded-lg border border-green-600 bg-green-50 p-4 text-green-900"
          : "flex items-start gap-3 rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive"
      }
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="font-semibold">{message}</p>
    </div>
  );
}

export function EventOrdersTable({ eventId, orders }: EventOrdersTableProps) {
  const [state, formAction, pending] = useActionState<RefundActionState, FormData>(refundOrderAction, {
    status: "idle",
  });
  const [selected, setSelected] = useState<EventOrderRow | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {state.status !== "idle" && <ResultBlock state={state} />}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Orden</TableHead>
            <TableHead>Comprador</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Entradas</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-mono">{order.shortId}</TableCell>
              <TableCell>
                <div>{order.buyerName}</div>
                <div className="text-xs text-muted-foreground">{order.buyerEmail}</div>
              </TableCell>
              <TableCell>{formatEventPrice(order.totalAmount)}</TableCell>
              <TableCell>{order.ticketCount}</TableCell>
              <TableCell>{new Date(order.createdAt).toLocaleString("es-PE")}</TableCell>
              <TableCell>
                <Badge variant={order.status === "paid" ? "default" : "secondary"}>
                  {order.status === "paid" ? "Pagada" : "Reembolsada"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {order.status === "paid" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setSelected(order)}
                  >
                    Reembolsar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reembolsar orden {selected?.shortId}</DialogTitle>
            <DialogDescription>
              Se reembolsaran {selected ? formatEventPrice(selected.totalAmount) : ""} a{" "}
              {selected?.buyerName} ({selected?.buyerEmail}) y sus entradas quedaran canceladas. Esta
              accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <form
            action={(formData) => {
              setSelected(null);
              formAction(formData);
            }}
          >
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="orderId" value={selected?.id ?? ""} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                Confirmar reembolso
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarPlus,
  CircleCheck,
  Download,
  Mail,
  QrCode,
  SearchX,
  Ticket,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";
import { getEventHref, type EventEntity } from "@/modules/event";
import { MY_TICKETS_PATH } from "@/modules/auth";
import { useTicketSelectionStore } from "@/modules/ticket";

import type { OrderRecord } from "../db/order.table";
import {
  downloadEventCalendar,
  getConfirmationStatus,
  toOrderFromRecord,
} from "../utils/order.utils";
import { OrderPaymentStatus } from "./order-payment-status";
import { OrderTicketCard } from "./order-ticket-card";

export interface OrderConfirmationProps {
  event: EventEntity;
  order: OrderRecord | null; // orden real (servidor); null si no hay session_id valido
}

const NEXT_STEPS = [
  {
    icon: Mail,
    title: "Revisa tu correo",
    text: "Ahi llegan tus entradas y el comprobante de pago.",
  },
  {
    icon: QrCode,
    title: "Muestra tu QR",
    text: "Cada entrada tiene su propio QR. Muestralo desde tu celular en el ingreso.",
  },
  {
    icon: Ticket,
    title: "Todo en Mis entradas",
    text: "Entra con tu cuenta para ver y descargar tus entradas cuando quieras.",
  },
];

export function OrderConfirmation({ event, order: record }: OrderConfirmationProps) {
  const isClient = useIsClient();
  const selectionEventId = useTicketSelectionStore((state) => state.eventId);
  const resetSelection = useTicketSelectionStore((state) => state.reset);

  const status = getConfirmationStatus(record, event.slug);
  const order = useMemo(
    () => (status === "paid" && record ? toOrderFromRecord(record, event) : null),
    [status, record, event],
  );

  // Compra pagada: se limpia la seleccion del evento.
  useEffect(() => {
    if (order && selectionEventId === event.id) resetSelection();
  }, [order, selectionEventId, event.id, resetSelection]);

  if (!isClient) {
    return <div aria-busy className="mx-auto h-96 max-w-4xl animate-pulse rounded-3xl bg-card" />;
  }

  if (status === "pending" || status === "failed" || status === "cancelled") {
    return (
      <OrderPaymentStatus status={status} checkoutHref={`${getEventHref(event.slug)}/checkout`} />
    );
  }

  if (!order) {
    return (
      <EmptyState
        icon={SearchX}
        title="No encontramos tu compra"
        description="Si ya pagaste, revisa tu correo: ahi llegan tus entradas y el comprobante."
        action={
          <Button size="lg" render={<Link href="/" />} nativeButton={false} className="h-11 px-5">
            Ir al inicio
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 lg:gap-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success/10 text-success">
          <CircleCheck className="size-9" aria-hidden />
        </span>
        <h1 className="font-heading text-3xl font-bold tracking-tight lg:text-4xl">
          ¡Compra confirmada!
        </h1>
        <p className="max-w-md text-muted-foreground">
          Enviamos tus entradas a{" "}
          <span className="font-medium text-foreground">{order.buyer.email}</span>. Tambien las
          tienes siempre en Mis entradas.
        </p>
        <span className="rounded-full bg-card px-4 py-1.5 text-sm ring-1 ring-foreground/10">
          Pedido N.º <strong className="font-semibold">{order.number}</strong>
        </span>
      </div>

      <OrderTicketCard event={event} order={order} />

      <div className="grid gap-2.5 sm:flex sm:justify-center">
        <Button
          size="lg"
          render={<Link href={`${MY_TICKETS_PATH}?order=${order.number}`} />}
          nativeButton={false}
          className="h-12 rounded-xl px-5 text-[15px]"
        >
          Ver mis entradas
          <ArrowRight aria-hidden />
        </Button>
        <div className="grid grid-cols-2 gap-2.5 sm:flex">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => downloadEventCalendar(event)}
            className="h-12 rounded-xl px-5 text-[15px]"
          >
            <CalendarPlus aria-hidden />
            Agregar al calendario
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => window.print()}
            className="h-12 rounded-xl px-5 text-[15px]"
          >
            <Download aria-hidden />
            Descargar PDF
          </Button>
        </div>
      </div>

      <section aria-labelledby="next-steps-title" className="flex flex-col gap-4">
        <h2 id="next-steps-title" className="sr-only">
          Que sigue
        </h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {NEXT_STEPS.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="flex gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 md:flex-col"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{title}</span>
                <span className="text-sm text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

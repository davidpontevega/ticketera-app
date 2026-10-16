"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, Clock, RefreshCw, TicketX, Undo2 } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

import type { OrderStatus } from "../db/order.table";

export interface OrderPaymentStatusProps {
  status: Exclude<OrderStatus, "paid">;
  checkoutHref: string; // destino de "Intentar de nuevo"
}

const COPY = {
  pending: {
    icon: Clock,
    title: "Estamos confirmando tu pago",
    description: "Puede tardar unos segundos. Verifica de nuevo en un momento.",
  },
  failed: {
    icon: CircleAlert,
    title: "No pudimos procesar tu pago",
    description: "No se realizo ningun cobro. Intenta de nuevo con otro metodo de pago.",
  },
  cancelled: {
    icon: TicketX,
    title: "Tu pago fue cancelado o expiro",
    description: "Tu compra no se completo. Puedes volver a intentarlo.",
  },
  refunded: {
    icon: Undo2,
    title: "Esta compra fue reembolsada",
    description: "El importe se devolvio a tu medio de pago original.",
  },
} as const;

export function OrderPaymentStatus({ status, checkoutHref }: OrderPaymentStatusProps) {
  const router = useRouter();
  const { icon, title, description } = COPY[status];

  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={
        status === "pending" ? (
          <Button size="lg" onClick={() => router.refresh()} className="h-11 px-5">
            <RefreshCw aria-hidden />
            Verificar de nuevo
          </Button>
        ) : (
          <Button
            size="lg"
            render={<Link href={status === "refunded" ? "/" : checkoutHref} />}
            nativeButton={false}
            className="h-11 px-5"
          >
            {status === "refunded" ? "Ir al inicio" : "Intentar de nuevo"}
          </Button>
        )
      }
    />
  );
}

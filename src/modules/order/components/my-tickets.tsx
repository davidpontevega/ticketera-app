"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { History, Ticket } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";
import { cn } from "@/lib/utils";
import { MY_TICKETS_PATH, getAuthHref, useAuthStore } from "@/modules/auth";
import { getEventSearchHref } from "@/modules/event";

import { getDemoOrders } from "../mocks/order.mock";
import { useOrderStore } from "../store/order.store";
import { getUserOrders, splitOrdersByTime } from "../utils/order.utils";
import { OrderList } from "./order-list";
import { OrderTicketViewer } from "./order-ticket-viewer";

type MyTicketsTab = "upcoming" | "past";

const TAB_LABEL: Record<MyTicketsTab, string> = { upcoming: "Proximas", past: "Pasadas" };

const EMPTY_STATE: Record<
  MyTicketsTab,
  { icon: typeof Ticket; title: string; description: string }
> = {
  upcoming: {
    icon: Ticket,
    title: "Aun no tienes entradas",
    description: "Cuando compres entradas para un evento, las veras aqui.",
  },
  past: {
    icon: History,
    title: "Aun no tienes eventos pasados",
    description: "Cuando vayas a tu primer evento, lo veras aqui.",
  },
};

export function MyTickets() {
  const router = useRouter();
  const preselectedNumber = useSearchParams().get("order");
  const isClient = useIsClient();
  const user = useAuthStore((state) => state.user);
  const storedOrders = useOrderStore((state) => state.orders);

  const [tab, setTab] = useState<MyTicketsTab | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(preselectedNumber);

  // Guard de sesion (la sesion mock vive en el navegador): sin usuario, al login y de vuelta.
  useEffect(() => {
    if (isClient && !user) router.replace(getAuthHref("/login", MY_TICKETS_PATH));
  }, [isClient, user, router]);

  if (!isClient || !user) {
    return <div aria-busy className="h-96 animate-pulse rounded-3xl bg-muted" />;
  }

  // Compras reales primero (las mas nuevas arriba en su grupo), luego los pedidos de ejemplo.
  const orders = [...getUserOrders(storedOrders, user.email).reverse(), ...getDemoOrders(user)];
  const groups = splitOrdersByTime(orders);
  const preselectedIsPast = groups.past.some((order) => order.number === selectedNumber);
  const activeTab = tab ?? (preselectedIsPast ? "past" : "upcoming");
  const visibleOrders = groups[activeTab];
  const selectedOrder =
    visibleOrders.find((order) => order.number === selectedNumber) ?? visibleOrders[0];
  const emptyState = EMPTY_STATE[activeTab];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl font-bold tracking-tight lg:text-4xl">Mis entradas</h1>
        <div
          role="tablist"
          aria-label="Tipo de entradas"
          className="flex gap-1 rounded-xl bg-card p-1 ring-1 ring-foreground/10"
        >
          {(Object.keys(TAB_LABEL) as MyTicketsTab[]).map((key) => {
            const isActive = key === activeTab;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setTab(key);
                  setSelectedNumber(null);
                }}
                className={cn(
                  "h-9 cursor-pointer rounded-lg px-4 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  isActive ? "bg-foreground text-background" : "text-foreground hover:bg-muted",
                )}
              >
                {TAB_LABEL[key]} ({groups[key].length})
              </button>
            );
          })}
        </div>
      </div>

      {selectedOrder ? (
        <div className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-8">
          <OrderList
            orders={visibleOrders}
            selectedNumber={selectedOrder.number}
            onSelect={setSelectedNumber}
          />
          <OrderTicketViewer
            key={selectedOrder.number}
            order={selectedOrder}
            isPast={activeTab === "past"}
          />
        </div>
      ) : (
        <EmptyState
          icon={emptyState.icon}
          title={emptyState.title}
          description={emptyState.description}
          titleAs="h2"
          action={
            <Button
              size="lg"
              render={<Link href={getEventSearchHref()} />}
              nativeButton={false}
              className="h-11 px-5"
            >
              Explorar eventos
            </Button>
          }
        />
      )}
    </div>
  );
}

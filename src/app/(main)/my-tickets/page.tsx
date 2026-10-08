import type { Metadata } from "next";

// Ruta directa: el barrel de event no expone el servicio con `db`.
import { listEventsBySlugs } from "@/modules/event/services/event.service";
import { MyTickets } from "@/modules/order";
import { toUserOrders } from "@/modules/order/utils/order.utils";
// Ruta directa: el barrel arrastraria `db`/`stripe` al bundle cliente.
import { listUserOrders } from "@/modules/order/services/user-orders.service";
import { getCurrentDbUser } from "@/modules/user";

export const metadata: Metadata = { title: "Mis entradas | Ticketera" };

export default async function MyTicketsPage({ searchParams }: PageProps<"/my-tickets">) {
  const { order } = await searchParams;
  // El proxy (026) exige sesion; sin fila `users` aun sincronizada => lista vacia (sin redirect, evita bucle).
  const user = await getCurrentDbUser();
  const records = user ? await listUserOrders(user.id) : [];
  const { orders, unavailableCount } = toUserOrders(
    records,
    await listEventsBySlugs(records.map((record) => record.eventSlug)),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:py-10">
      <MyTickets
        orders={orders}
        unavailableCount={unavailableCount}
        initialOrderNumber={typeof order === "string" ? order : null}
      />
    </div>
  );
}

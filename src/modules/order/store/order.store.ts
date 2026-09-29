import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Order, PlaceOrderInput } from "../types/order.types";
import { generateOrderNumber } from "../utils/order.utils";

export interface OrderState {
  orders: Order[];
  lastOrderNumber: string | null;
  placeOrder: (input: PlaceOrderInput) => Order;
  clearOrders: () => void;
}

// Historial de pedidos en localStorage: la compra sigue en "Mis entradas" aunque se cierre
// la pestaña. Nunca guarda datos de tarjeta (los campos se copian uno por uno).
export const useOrderStore = create<OrderState>()(
  persist(
    (set) => ({
      orders: [],
      lastOrderNumber: null,
      placeOrder: (input) => {
        const order: Order = {
          number: generateOrderNumber(),
          eventId: input.eventId,
          event: input.event,
          accountEmail: input.accountEmail,
          buyer: input.buyer,
          paymentMethod: input.paymentMethod,
          lines: input.lines,
          total: input.total,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ orders: [...state.orders, order], lastOrderNumber: order.number }));
        return order;
      },
      clearOrders: () => set({ orders: [], lastOrderNumber: null }),
    }),
    {
      name: "ticketera-orders",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ orders, lastOrderNumber }) => ({ orders, lastOrderNumber }),
    },
  ),
);

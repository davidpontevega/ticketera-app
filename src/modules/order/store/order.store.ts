import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Order, PlaceOrderInput } from "../types/order.types";
import { generateOrderNumber } from "../utils/order.utils";

export interface OrderState {
  lastOrder: Order | null;
  placeOrder: (input: PlaceOrderInput) => Order;
  clearOrder: () => void;
}

// Ultimo pedido en sessionStorage para que la confirmacion sobreviva a un refresh.
export const useOrderStore = create<OrderState>()(
  persist(
    (set) => ({
      lastOrder: null,
      placeOrder: (input) => {
        const order: Order = {
          number: generateOrderNumber(),
          eventId: input.eventId,
          buyer: input.buyer,
          paymentMethod: input.paymentMethod,
          lines: input.lines,
          total: input.total,
          createdAt: new Date().toISOString(),
        };
        set({ lastOrder: order });
        return order;
      },
      clearOrder: () => set({ lastOrder: null }),
    }),
    {
      name: "ticketera-last-order",
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ lastOrder }) => ({ lastOrder }),
    },
  ),
);

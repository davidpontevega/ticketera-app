import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { TICKET_MAX_PER_ZONE } from "../constants/ticket.constants";

export interface TicketSelectionState {
  eventId: string | null;
  activeZoneId: string | null;
  quantities: Record<string, number>; // solo zonas de admision general
  seatIds: Record<string, string[]>; // solo zonas numeradas
  startSelection: (eventId: string) => void;
  selectZone: (zoneId: string | null) => void; // null = volver a la vista general
  setQuantity: (zoneId: string, quantity: number) => void;
  toggleSeat: (zoneId: string, seatId: string) => void;
  setSeats: (zoneId: string, seatIds: string[]) => void; // reemplaza (ej. "mejores asientos")
  reset: () => void;
}

const INITIAL_SELECTION = {
  eventId: null,
  activeZoneId: null,
  quantities: {},
  seatIds: {},
} satisfies Pick<TicketSelectionState, "eventId" | "activeZoneId" | "quantities" | "seatIds">;

// Persistido en localStorage (datos de prueba, spec 016): la seleccion sobrevive a un refresh
// del checkout y a cerrar el navegador. Se ve y se borra en /dev/storage.
export const useTicketSelectionStore = create<TicketSelectionState>()(
  persist(
    (set) => ({
      ...INITIAL_SELECTION,
      startSelection: (eventId) =>
        set((state) => (state.eventId === eventId ? state : { ...INITIAL_SELECTION, eventId })),
      selectZone: (activeZoneId) => set({ activeZoneId }),
      setQuantity: (zoneId, quantity) =>
        set((state) => ({
          activeZoneId: zoneId,
          quantities: {
            ...state.quantities,
            [zoneId]: Math.min(TICKET_MAX_PER_ZONE, Math.max(0, quantity)),
          },
        })),
      toggleSeat: (zoneId, seatId) =>
        set((state) => {
          const current = state.seatIds[zoneId] ?? [];
          const isSelected = current.includes(seatId);
          if (!isSelected && current.length >= TICKET_MAX_PER_ZONE) return state;
          const next = isSelected ? current.filter((id) => id !== seatId) : [...current, seatId];
          return { activeZoneId: zoneId, seatIds: { ...state.seatIds, [zoneId]: next } };
        }),
      setSeats: (zoneId, seatIds) =>
        set((state) => ({
          activeZoneId: zoneId,
          seatIds: { ...state.seatIds, [zoneId]: seatIds.slice(0, TICKET_MAX_PER_ZONE) },
        })),
      reset: () => set(INITIAL_SELECTION),
    }),
    {
      name: "ticketera-ticket-selection",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ eventId, activeZoneId, quantities, seatIds }) => ({
        eventId,
        activeZoneId,
        quantities,
        seatIds,
      }),
    },
  ),
);

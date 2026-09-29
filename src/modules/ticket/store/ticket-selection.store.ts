import { create } from "zustand";

import { TICKET_MAX_PER_ZONE } from "../constants/ticket.constants";

export interface TicketSelectionState {
  eventId: string | null;
  activeZoneId: string | null;
  quantities: Record<string, number>; // solo zonas de admision general
  seatIds: Record<string, string[]>; // solo zonas numeradas
  startSelection: (eventId: string) => void;
  selectZone: (zoneId: string) => void;
  setQuantity: (zoneId: string, quantity: number) => void;
  toggleSeat: (zoneId: string, seatId: string) => void;
  reset: () => void;
}

const INITIAL_SELECTION = {
  eventId: null,
  activeZoneId: null,
  quantities: {},
  seatIds: {},
} satisfies Pick<TicketSelectionState, "eventId" | "activeZoneId" | "quantities" | "seatIds">;

export const useTicketSelectionStore = create<TicketSelectionState>()((set) => ({
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
  reset: () => set(INITIAL_SELECTION),
}));

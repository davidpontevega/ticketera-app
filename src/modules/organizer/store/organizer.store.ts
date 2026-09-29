import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { OrganizerEvent } from "../types/organizer.types";

export interface OrganizerState {
  events: OrganizerEvent[];
  saveEvent: (event: OrganizerEvent) => void; // inserta o reemplaza por id
}

// Eventos creados en el panel (mock, en el navegador del organizador).
export const useOrganizerStore = create<OrganizerState>()(
  persist(
    (set) => ({
      events: [],
      saveEvent: (event) =>
        set((state) => ({
          events: [...state.events.filter((item) => item.id !== event.id), event],
        })),
    }),
    {
      name: "ticketera-organizer-events",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ events }) => ({ events }),
    },
  ),
);

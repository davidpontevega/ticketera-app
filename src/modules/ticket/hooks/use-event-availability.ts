"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchEventAvailability } from "../services/availability.service";
import type { EventAvailabilitySnapshot, VenueLayout } from "../types/ticket.types";
import { applyAvailability } from "../utils/ticket.utils";

/**
 * Devuelve el layout con la ocupacion real del servidor aplicada. Refresca al montar y al
 * volver a enfocar la pestana. Si la lectura falla, se queda con el ultimo snapshot (o el
 * layout base): el servidor sigue siendo la barrera en el checkout.
 */
export function useEventAvailability(slug: string, layout: VenueLayout): VenueLayout {
  const [snapshot, setSnapshot] = useState<EventAvailabilitySnapshot | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetchEventAvailability(slug)
        .then((next) => {
          if (active) setSnapshot(next);
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, [slug]);

  return useMemo(() => (snapshot ? applyAvailability(layout, snapshot) : layout), [layout, snapshot]);
}

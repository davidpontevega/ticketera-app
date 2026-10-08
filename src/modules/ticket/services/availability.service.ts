import axios from "axios";

import type { EventAvailabilitySnapshot } from "../types/ticket.types";

export async function fetchEventAvailability(slug: string): Promise<EventAvailabilitySnapshot> {
  const { data } = await axios.get<EventAvailabilitySnapshot>(
    `/api/events/${encodeURIComponent(slug)}/availability`,
  );
  return data;
}

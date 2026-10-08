import type { Metadata } from "next";

import { OrganizerDashboard } from "@/modules/organizer";
import { listOrganizerEvents } from "@/modules/organizer/services/organizer-events.service";

export const metadata: Metadata = { title: "Panel de organizador | Ticketera" };

export default async function OrganizerPage() {
  const events = await listOrganizerEvents();

  return <OrganizerDashboard events={events} />;
}

import type { Metadata } from "next";

import { OrganizerDashboard } from "@/modules/organizer";

export const metadata: Metadata = { title: "Panel de organizador | Ticketera" };

export default function OrganizerPage() {
  return <OrganizerDashboard />;
}

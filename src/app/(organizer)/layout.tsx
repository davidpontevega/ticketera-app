import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";
import { OrganizerShell } from "@/modules/organizer";

export default async function OrganizerLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);

  return <OrganizerShell viewer={{ fullName: viewer.fullName, email: viewer.email }}>{children}</OrganizerShell>;
}

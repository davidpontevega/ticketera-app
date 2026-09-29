import { OrganizerShell } from "@/modules/organizer";

export default function OrganizerLayout({ children }: LayoutProps<"/">) {
  return <OrganizerShell>{children}</OrganizerShell>;
}

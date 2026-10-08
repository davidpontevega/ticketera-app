import { SiteFooter } from "@/components/shared/site-footer";
import { SiteHeader } from "@/components/shared/site-header";
import { getCurrentDbUser } from "@/modules/user";

export default async function MainLayout({ children }: LayoutProps<"/">) {
  const viewer = await getCurrentDbUser();

  return (
    <>
      <SiteHeader role={viewer?.role ?? null} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}

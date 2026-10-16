import { SiteFooter } from "@/components/shared/site-footer";
import { SiteHeader } from "@/components/shared/site-header";
import { FavoritesProvider } from "@/modules/favorite";
import { listFavoriteEventIds } from "@/modules/favorite/services/favorite.service";
import { getCurrentDbUser } from "@/modules/user";

export default async function MainLayout({ children }: LayoutProps<"/">) {
  const viewer = await getCurrentDbUser();
  // Si falla (p. ej. migracion 0010 sin aplicar) se degrada a corazones vacios en vez de romper todo el sitio.
  const favoriteEventIds = viewer
    ? await listFavoriteEventIds(viewer.id).catch((error) => {
        console.error("No se pudieron cargar los favoritos", error);
        return [] as string[];
      })
    : [];

  return (
    <FavoritesProvider favoriteEventIds={favoriteEventIds} isAuthenticated={!!viewer}>
      <SiteHeader role={viewer?.role ?? null} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </FavoritesProvider>
  );
}

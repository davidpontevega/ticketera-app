import {
  BestSellerEvents,
  CategoryList,
  EventSearchBar,
  getBestSellerEvents,
  getTrendingEvents,
  HeroCarousel,
  UpcomingEvents,
  TrendingSidebar,
} from "@/modules/event";
import { listFeaturedEvents } from "@/modules/event/services/featured-event.service";
import { listCatalogEvents } from "@/modules/catalog/services/catalog.service";
import { NewsletterSignup } from "@/modules/newsletter";

export default async function Home() {
  const [featuredEvents, catalog] = await Promise.all([listFeaturedEvents(), listCatalogEvents()]);
  const events = catalog.map(({ event }) => event);

  return (
    <>
      <EventSearchBar />
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="grid gap-4 py-8 md:grid-cols-[1fr_320px]">
          <HeroCarousel events={featuredEvents} />
          <TrendingSidebar events={getTrendingEvents(events)} />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <CategoryList />
      </div>
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <BestSellerEvents events={getBestSellerEvents(events)} />
      </div>
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <UpcomingEvents events={events} />
      </div>
      <NewsletterSignup />
    </>
  );
}

import {
  BestSellerEvents,
  CategoryList,
  EVENTS_MOCK,
  EventSearchBar,
  getBestSellerEvents,
  getFeaturedEvents,
  getTrendingEvents,
  HeroCarousel,
  TrendingSidebar,
} from "@/modules/event";
import { CatalogUpcomingEvents } from "@/modules/catalog";
import { NewsletterSignup } from "@/components/shared/newsletter-signup";

export default function Home() {
  return (
    <>
      <EventSearchBar />
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="grid gap-4 py-8 md:grid-cols-[1fr_320px]">
          <HeroCarousel events={getFeaturedEvents(EVENTS_MOCK)} />
          <TrendingSidebar events={getTrendingEvents(EVENTS_MOCK)} />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <CategoryList />
      </div>
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <BestSellerEvents events={getBestSellerEvents(EVENTS_MOCK)} />
      </div>
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <CatalogUpcomingEvents />
      </div>
      <NewsletterSignup />
    </>
  );
}

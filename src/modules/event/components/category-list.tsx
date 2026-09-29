"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import { EVENT_CATEGORIES } from "../constants/event.constants";
import { useEventFilterStore } from "../store/event-filter.store";

export function CategoryList() {
  const setCategory = useEventFilterStore((state) => state.setCategory);
  const listRef = useRef<HTMLUListElement>(null);

  function scroll(direction: -1 | 1): void {
    listRef.current?.scrollBy({
      left: direction * (listRef.current.clientWidth * 0.8),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  return (
    <div className="flex items-center gap-2 py-4">
      <Button
        variant="outline"
        size="icon"
        className="shrink-0 cursor-pointer rounded-full"
        aria-label="Categorias anteriores"
        onClick={() => scroll(-1)}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <ul ref={listRef} className="flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto pb-1">
        {EVENT_CATEGORIES.map(({ id, label, icon: Icon, bgClassName, textClassName }) => (
          <li key={id} className="shrink-0 snap-start">
            <a
              href="#upcoming-events"
              onClick={() => setCategory(id)}
              className="group flex w-24 cursor-pointer flex-col items-center gap-2 rounded-xl p-1 text-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span
                className={`flex size-20 items-center justify-center rounded-full transition-all duration-200 group-hover:ring-2 group-hover:ring-primary motion-safe:group-hover:-translate-y-0.5 ${bgClassName}`}
              >
                <Icon aria-hidden className={`size-8 ${textClassName}`} />
              </span>
              <span className="line-clamp-2 text-sm font-medium text-foreground">{label}</span>
            </a>
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        size="icon"
        className="shrink-0 cursor-pointer rounded-full"
        aria-label="Categorias siguientes"
        onClick={() => scroll(1)}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}

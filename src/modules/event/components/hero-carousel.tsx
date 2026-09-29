"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Swiper, SwiperSlide, type SwiperClass } from "swiper/react";
import { A11y, Keyboard, Pagination } from "swiper/modules";

import "swiper/css";
import "swiper/css/pagination";

import { Button } from "@/components/ui/button";

import type { EventEntity } from "../types/event.types";
import { formatEventDate } from "../utils/event.utils";

export interface HeroCarouselProps {
  events: readonly EventEntity[];
}

export function HeroCarousel({ events }: HeroCarouselProps) {
  const [swiper, setSwiper] = useState<SwiperClass | null>(null);

  if (events.length === 0) return null;

  return (
    <section
      aria-label="Eventos destacados"
      aria-roledescription="carrusel"
      className="relative overflow-hidden rounded-xl shadow-xl"
      style={
        {
          "--swiper-pagination-color": "var(--color-cta)",
          "--swiper-pagination-bullet-inactive-color": "#ffffff",
          "--swiper-pagination-bullet-inactive-opacity": "0.6",
        } as CSSProperties
      }
    >
      <h1 className="sr-only">Descubre tu proximo evento</h1>
      <Swiper
        modules={[Keyboard, A11y, Pagination]}
        loop
        keyboard={{ enabled: true, onlyInViewport: true }}
        a11y={{ prevSlideMessage: "Evento anterior", nextSlideMessage: "Evento siguiente" }}
        pagination={{ clickable: true }}
        onSwiper={setSwiper}
        className="h-72 md:h-[420px]"
      >
        {events.map((event, index) => (
          <SwiperSlide key={event.id}>
            <div className="relative h-full">
              <Image
                src={event.imageUrl}
                alt={event.title}
                fill
                sizes="(min-width: 768px) 70vw, 100vw"
                className="object-cover"
                preload={index === 0}
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"
              />
              <div className="absolute inset-0 z-10 flex flex-col justify-end gap-4 p-6 pointer-events-none text-white md:p-10">
                <h2 className="text-[28px] font-bold leading-tight md:text-[40px]">
                  {event.title}
                </h2>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/80">
                  <span className="flex items-center gap-2">
                    <CalendarDays aria-hidden className="size-4" />
                    {formatEventDate(event.date)}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="flex items-center gap-2">
                    <MapPin aria-hidden className="size-4" />
                    {event.venue}, {event.city}
                  </span>
                </div>
                <Button
                  className="pointer-events-auto w-fit"
                  render={<a href="#upcoming-events" />}
                  nativeButton={false}
                >
                  Comprar entradas
                </Button>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
      <div className="absolute bottom-4 right-4 z-20 hidden items-center gap-1 rounded-full bg-white p-1 shadow-md md:flex">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Evento anterior"
          className="cursor-pointer"
          onClick={() => swiper?.slidePrev()}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Evento siguiente"
          className="cursor-pointer"
          onClick={() => swiper?.slideNext()}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </section>
  );
}

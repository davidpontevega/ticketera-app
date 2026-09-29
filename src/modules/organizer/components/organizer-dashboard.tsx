"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/modules/auth";

import {
  ORGANIZER_EVENTS_ANCHOR,
  ORGANIZER_NEW_EVENT_PATH,
} from "../constants/organizer.constants";
import { ORGANIZER_EVENTS_MOCK } from "../mocks/organizer.mock";
import { useOrganizerStore } from "../store/organizer.store";
import type { OrganizerEventFilter } from "../types/organizer.types";
import {
  filterOrganizerEvents,
  getOrganizerEvents,
  getOrganizerKpis,
} from "../utils/organizer.utils";
import { OrganizerEventList } from "./organizer-event-list";
import { OrganizerKpis } from "./organizer-kpis";

// Se renderiza dentro de OrganizerShell, que ya garantiza sesion e hidratacion.
export function OrganizerDashboard() {
  const user = useAuthStore((state) => state.user);
  const storedEvents = useOrganizerStore((state) => state.events);
  const [filter, setFilter] = useState<OrganizerEventFilter>("all");

  const events = getOrganizerEvents(storedEvents, ORGANIZER_EVENTS_MOCK, user?.email ?? "");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight">Resumen</h1>
          <p className="text-muted-foreground">Asi van las ventas de tus eventos.</p>
        </div>
        <Button
          size="lg"
          render={<Link href={ORGANIZER_NEW_EVENT_PATH} />}
          nativeButton={false}
          className="h-11 rounded-xl px-5 text-[15px] font-semibold"
        >
          <Plus aria-hidden />
          Crear evento
        </Button>
      </div>
      <OrganizerKpis kpis={getOrganizerKpis(events)} />
      <section
        id={ORGANIZER_EVENTS_ANCHOR}
        aria-labelledby="organizer-events-title"
        className="flex scroll-mt-24 flex-col gap-4"
      >
        <h2 id="organizer-events-title" className="font-heading text-xl font-bold tracking-tight">
          Mis eventos
        </h2>
        <OrganizerEventList
          events={filterOrganizerEvents(events, filter)}
          filter={filter}
          onFilterChange={setFilter}
        />
      </section>
    </div>
  );
}

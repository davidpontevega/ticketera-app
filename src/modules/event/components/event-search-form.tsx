"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface EventSearchFormProps {
  defaultQuery: string;
  onSubmit: (query: string) => void;
}

export function EventSearchForm({ defaultQuery, onSubmit }: EventSearchFormProps) {
  const [query, setQuery] = useState(defaultQuery);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(query);
      }}
      className="flex items-center gap-2 rounded-2xl bg-card p-2 shadow-sm ring-1 ring-foreground/10"
    >
      <div className="relative flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Artista, evento o ciudad"
          aria-label="Buscar eventos"
          className="h-11 border-0 bg-transparent pl-10 text-[15px] shadow-none focus-visible:ring-0 md:text-[15px]"
        />
      </div>
      <Button type="submit" size="lg" className="h-11 rounded-xl px-5 text-[15px] font-semibold">
        <Search aria-hidden className="hidden sm:block" />
        Buscar
      </Button>
    </form>
  );
}

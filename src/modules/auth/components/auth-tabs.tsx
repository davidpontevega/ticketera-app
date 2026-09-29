"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

import { getAuthHref, type AuthPath } from "../utils/auth.utils";

const AUTH_TABS: readonly { path: AuthPath; label: string }[] = [
  { path: "/login", label: "Iniciar sesion" },
  { path: "/register", label: "Crear cuenta" },
];

export interface AuthTabsProps {
  current: AuthPath;
}

export function AuthTabs({ current }: AuthTabsProps) {
  const redirect = useSearchParams().get("redirect");
  return (
    <nav
      aria-label="Acceso"
      className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 ring-1 ring-border"
    >
      {AUTH_TABS.map(({ path, label }) => {
        const isCurrent = path === current;
        return (
          <Link
            key={path}
            href={getAuthHref(path, redirect)}
            aria-current={isCurrent ? "page" : undefined}
            replace
            className={cn(
              "flex h-10 items-center justify-center rounded-lg text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              isCurrent
                ? "bg-background font-semibold text-foreground shadow-sm"
                : "font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

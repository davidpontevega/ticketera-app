"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsClient } from "@/hooks/use-is-client";
import { cn } from "@/lib/utils";
import { getAuthHref, getInitials, useAuthStore, type AuthUser } from "@/modules/auth";

import { ORGANIZER_NAV } from "../constants/organizer.constants";

export interface OrganizerShellProps {
  children: ReactNode;
}

function OrganizerLogo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-foreground">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Ticket className="size-5" aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-lg font-semibold">Ticketera</span>
        <span className="text-xs font-medium text-muted-foreground">Organizadores</span>
      </span>
    </Link>
  );
}

function OrganizerNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Panel" className="flex flex-col gap-1">
      {ORGANIZER_NAV.map(({ href, label, icon: Icon }) => {
        const isCurrent = href === pathname;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              isCurrent ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4.5" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function OrganizerUser({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
      >
        {getInitials(user.fullName)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{user.fullName}</span>
        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Cerrar sesion"
        onClick={onLogout}
      >
        <LogOut aria-hidden />
      </Button>
    </div>
  );
}

// Layout del area de organizador: sidebar (desktop), barra + menu (mobile) y guard de sesion.
export function OrganizerShell({ children }: OrganizerShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isClient = useIsClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (isClient && !user) router.replace(getAuthHref("/login", pathname));
  }, [isClient, user, router, pathname]);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-muted lg:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-border bg-background p-5 lg:flex">
        <OrganizerLogo />
        <OrganizerNav pathname={pathname} />
        <div className="mt-auto">{user && <OrganizerUser user={user} onLogout={logout} />}</div>
      </aside>

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <OrganizerLogo />
        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetTrigger
            render={
              <Button type="button" variant="ghost" size="icon" aria-label="Abrir menu del panel" />
            }
          >
            <Menu aria-hidden />
          </SheetTrigger>
          <SheetContent side="left" className="gap-6 p-5">
            <SheetHeader className="p-0">
              <SheetTitle>Panel de organizador</SheetTitle>
            </SheetHeader>
            <OrganizerNav pathname={pathname} onNavigate={() => setIsMenuOpen(false)} />
            <div className="mt-auto">{user && <OrganizerUser user={user} onLogout={logout} />}</div>
          </SheetContent>
        </Sheet>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:py-10">
        {isClient && user ? (
          children
        ) : (
          <div aria-busy className="h-96 animate-pulse rounded-3xl bg-background" />
        )}
      </main>
    </div>
  );
}

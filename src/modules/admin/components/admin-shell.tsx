"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { LogOut, Menu, Ticket } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getInitials } from "@/modules/auth";
import { USER_ROLE_LABELS } from "@/modules/user/constants/user.constants";
import type { UserRole } from "@/modules/user/types/user.types";

import { ADMIN_NAV_SECTIONS, type AdminNavSection } from "../constants/admin.constants";

export interface AdminViewer {
  fullName: string;
  email: string;
  role: UserRole;
}

export interface AdminShellProps {
  viewer: AdminViewer;
  children: ReactNode;
}

function AdminLogo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-foreground">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Ticket className="size-5" aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-lg font-semibold">Ticketera</span>
        <span className="text-xs font-medium text-muted-foreground">Administracion</span>
      </span>
    </Link>
  );
}

function AdminNav({
  sections,
  pathname,
  onNavigate,
}: {
  sections: readonly AdminNavSection[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Panel de administracion" className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          <span className="px-3 text-xs font-semibold uppercase text-muted-foreground">
            {section.label}
          </span>
          {section.items.map(({ href, label, icon: Icon }) => {
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
        </div>
      ))}
    </nav>
  );
}

function AdminUser({ viewer }: { viewer: AdminViewer }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
      <Avatar>
        <AvatarFallback className="bg-primary text-primary-foreground">
          {getInitials(viewer.fullName)}
        </AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{viewer.fullName}</span>
        <span className="truncate text-xs text-muted-foreground">
          {USER_ROLE_LABELS[viewer.role]}
        </span>
      </span>
      <SignOutButton redirectUrl="/">
        <Button type="button" variant="ghost" size="icon" aria-label="Cerrar sesion">
          <LogOut aria-hidden />
        </Button>
      </SignOutButton>
    </div>
  );
}

// Layout del area de administracion: sidebar (desktop) y drawer (mobile) con nav filtrado por rol.
export function AdminShell({ viewer, children }: AdminShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const sections = ADMIN_NAV_SECTIONS.filter((section) => section.roles.includes(viewer.role));

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-muted lg:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-68 shrink-0 flex-col gap-8 border-r border-border bg-background p-5 lg:flex">
        <AdminLogo />
        <AdminNav sections={sections} pathname={pathname} />
        <div className="mt-auto">
          <AdminUser viewer={viewer} />
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <AdminLogo />
        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetTrigger
            render={<Button type="button" variant="ghost" size="icon" aria-label="Abrir menu" />}
          >
            <Menu aria-hidden />
          </SheetTrigger>
          <SheetContent side="left" className="w-70 gap-6 p-5">
            <SheetHeader className="p-0">
              <SheetTitle>Panel de administracion</SheetTitle>
            </SheetHeader>
            <AdminNav
              sections={sections}
              pathname={pathname}
              onNavigate={() => setIsMenuOpen(false)}
            />
            <div className="mt-auto">
              <AdminUser viewer={viewer} />
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:py-10">{children}</main>
    </div>
  );
}

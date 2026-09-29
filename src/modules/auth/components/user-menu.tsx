"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsClient } from "@/hooks/use-is-client";
import { cn } from "@/lib/utils";

import { useAuthStore } from "../store/auth.store";
import type { AuthUser } from "../types/auth.types";
import { getAuthHref, getInitials } from "../utils/auth.utils";

export const MY_TICKETS_PATH = "/my-tickets";

export interface UserMenuProps {
  layout?: "inline" | "sheet"; // "sheet": links apilados para el menu lateral mobile
}

function UserAvatar({ user, className }: { user: AuthUser; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground",
        className,
      )}
    >
      {getInitials(user.fullName)}
    </span>
  );
}

export function UserMenu({ layout = "inline" }: UserMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isClient = useIsClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // Sin sesion (o antes de hidratar): link a login que vuelve a la pagina actual. El href usa
  // el pathname; al hacer click se suma el query string actual (ej. filtros de /events) sin
  // leer useSearchParams aca, que obligaria a envolver cada pagina en Suspense.
  if (!isClient || !user) {
    return (
      <Link
        href={getAuthHref("/login", pathname)}
        onClick={(event) => {
          event.preventDefault();
          router.push(
            getAuthHref("/login", `${window.location.pathname}${window.location.search}`),
          );
        }}
        className="cursor-pointer text-sm font-medium hover:text-primary"
      >
        Iniciar sesion
      </Link>
    );
  }

  if (layout === "sheet") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} className="size-10 text-sm" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{user.fullName}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
        </div>
        <Link
          href={MY_TICKETS_PATH}
          className="flex items-center gap-2 text-sm font-medium hover:text-primary"
        >
          <Ticket className="size-4" aria-hidden />
          Mis entradas
        </Link>
        <button
          type="button"
          onClick={logout}
          className="flex cursor-pointer items-center gap-2 text-left text-sm font-medium hover:text-primary"
        >
          <LogOut className="size-4" aria-hidden />
          Cerrar sesion
        </button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="ghost" className="h-10 gap-2 rounded-full pr-2 pl-1" />
        }
      >
        <UserAvatar user={user} />
        <span className="max-w-32 truncate text-sm font-medium">{user.fullName}</span>
        <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
            <span className="text-sm font-semibold text-foreground">{user.fullName}</span>
            <span className="truncate text-xs font-normal">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href={MY_TICKETS_PATH} />}
          className="cursor-pointer px-2 py-1.5"
        >
          <Ticket aria-hidden />
          Mis entradas
        </DropdownMenuItem>
        <DropdownMenuItem onClick={logout} className="cursor-pointer px-2 py-1.5">
          <LogOut aria-hidden />
          Cerrar sesion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

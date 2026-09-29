"use client";

import Link from "next/link";
import { CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useAuthStore } from "../store/auth.store";
import type { AuthUser } from "../types/auth.types";

export interface AuthSignedInProps {
  user: AuthUser;
  redirectHref: string;
}

// Se muestra al entrar a /login o /register con una sesion activa.
export function AuthSignedIn({ user, redirectHref }: AuthSignedInProps) {
  const logout = useAuthStore((state) => state.logout);
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-card p-8 text-center ring-1 ring-foreground/10">
      <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
        <CircleCheck className="size-6" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold">Ya iniciaste sesion</h1>
        <p className="text-sm text-muted-foreground">
          Estas conectado como <span className="font-medium text-foreground">{user.fullName}</span>{" "}
          ({user.email}).
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Button
          size="lg"
          render={<Link href={redirectHref} />}
          nativeButton={false}
          className="h-11 flex-1"
        >
          Continuar
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={logout} className="h-11 flex-1">
          Cerrar sesion
        </Button>
      </div>
    </div>
  );
}

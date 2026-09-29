import type { ReactNode } from "react";
import Image from "next/image";

import { BrandLogo } from "@/components/shared/brand-logo";

const AUTH_IMAGE_URL =
  "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop";

export interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="relative isolate flex h-52 flex-col justify-between overflow-hidden bg-indigo-950 p-5 text-white lg:h-auto lg:p-12">
        <Image
          src={AUTH_IMAGE_URL}
          alt="Multitud con las manos en alto frente a un escenario durante un festival nocturno"
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="-z-10 object-cover opacity-60"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-indigo-950 via-indigo-950/40 to-transparent"
        />
        <BrandLogo className="w-fit text-white [&>span]:bg-white/15" />
        <div className="flex flex-col gap-1 lg:gap-3">
          <p className="font-heading text-xl font-bold tracking-tight lg:text-4xl">
            Tus entradas, siempre a mano.
          </p>
          <p className="text-sm text-indigo-100 lg:text-base">
            Compra en minutos y lleva tu QR en el celular.
          </p>
        </div>
      </section>
      <main className="flex items-start justify-center bg-background px-4 py-8 lg:items-center lg:px-12">
        <div className="flex w-full max-w-md flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}

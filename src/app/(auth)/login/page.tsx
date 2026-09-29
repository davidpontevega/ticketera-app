import { Suspense } from "react";
import type { Metadata } from "next";

import { LoginForm } from "@/modules/auth";

export const metadata: Metadata = { title: "Iniciar sesion | Ticketera" };

export default function LoginPage() {
  // LoginForm lee ?redirect= con useSearchParams
  return (
    <Suspense fallback={<div aria-busy className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <LoginForm />
    </Suspense>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";

import { RegisterForm } from "@/modules/auth";

export const metadata: Metadata = { title: "Crear cuenta | Ticketera" };

export default function RegisterPage() {
  // RegisterForm lee ?redirect= con useSearchParams
  return (
    <Suspense fallback={<div aria-busy className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <RegisterForm />
    </Suspense>
  );
}

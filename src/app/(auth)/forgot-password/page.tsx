import { Suspense } from "react";
import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/modules/auth";

export const metadata: Metadata = { title: "Recuperar contraseña | Ticketera" };

export default function ForgotPasswordPage() {
  // ForgotPasswordForm lee ?redirect= con useSearchParams
  return (
    <Suspense fallback={<div aria-busy className="h-72 animate-pulse rounded-2xl bg-muted" />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}

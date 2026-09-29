import { Suspense } from "react";
import type { Metadata } from "next";

import { ResetPasswordForm } from "@/modules/auth";

export const metadata: Metadata = { title: "Nueva contraseña | Ticketera" };

export default function ResetPasswordPage() {
  // ResetPasswordForm lee ?token= con useSearchParams
  return (
    <Suspense fallback={<div aria-busy className="h-72 animate-pulse rounded-2xl bg-muted" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

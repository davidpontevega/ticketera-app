"use client";

import { useSearchParams } from "next/navigation";
import { SignUp } from "@clerk/nextjs";

import { getAuthHref, getSafeRedirect } from "../utils/auth.utils";
import { AuthTabs } from "./auth-tabs";

export function RegisterForm() {
  const redirect = useSearchParams().get("redirect");

  return (
    <>
      <AuthTabs current="/register" />
      <SignUp
        path="/register"
        signInUrl={getAuthHref("/login", redirect)}
        fallbackRedirectUrl={getSafeRedirect(redirect)}
      />
    </>
  );
}

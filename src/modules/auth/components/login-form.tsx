"use client";

import { useSearchParams } from "next/navigation";
import { SignIn } from "@clerk/nextjs";

import { getAuthHref, getSafeRedirect } from "../utils/auth.utils";
import { AuthTabs } from "./auth-tabs";

export function LoginForm() {
  const redirect = useSearchParams().get("redirect");

  return (
    <>
      <AuthTabs current="/login" />
      <SignIn
        path="/login"
        signUpUrl={getAuthHref("/register", redirect)}
        fallbackRedirectUrl={getSafeRedirect(redirect)}
      />
    </>
  );
}

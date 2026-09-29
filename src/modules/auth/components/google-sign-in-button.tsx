"use client";

import { useRef, useState } from "react";
import Script from "next/script";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { AuthUser } from "../types/auth.types";
import { decodeGoogleCredential, getNameFromEmail, normalizeEmail } from "../utils/auth.utils";

// Client ID publico de Google (OAuth "Aplicacion web"). Sin el, se usa el selector simulado.
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";

const MOCK_GOOGLE_ACCOUNTS: readonly AuthUser[] = [
  { fullName: "Lucia Fernandez", email: "lucia.fernandez@gmail.com" },
  { fullName: "Carlos Ramos", email: "carlos.ramos@gmail.com" },
];

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
        ux_mode?: "popup";
      }) => void;
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

export interface GoogleSignInButtonProps {
  mode: "signin" | "signup";
  onSuccess: (profile: AuthUser) => void;
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

// Google Identity Services real (con NEXT_PUBLIC_GOOGLE_CLIENT_ID): boton oficial de Google.
function RealGoogleButton({ mode, onSuccess }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const renderButton = () => {
    const google = window.google;
    const container = containerRef.current;
    if (!google || !container || !GOOGLE_CLIENT_ID) return;
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      ux_mode: "popup",
      callback: ({ credential }) => {
        const profile = credential ? decodeGoogleCredential(credential) : null;
        if (profile) onSuccess(profile);
        else setError("No pudimos leer tu cuenta de Google. Intenta de nuevo.");
      },
    });
    google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "rectangular",
      text: mode === "signup" ? "signup_with" : "continue_with",
      locale: "es",
      width: Math.min(container.offsetWidth || 400, 400),
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Script
        src={GIS_SCRIPT_URL}
        strategy="afterInteractive"
        onReady={renderButton}
        onError={() => setError("No se pudo cargar Google. Ingresa con tu correo.")}
      />
      <div ref={containerRef} className="flex min-h-11 w-full justify-center" />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// Sin Client ID: selector de cuentas simulado con el mismo resultado (perfil de Google).
function MockGoogleButton({ mode, onSuccess }: GoogleSignInButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const choose = (profile: AuthUser) => {
    setIsOpen(false);
    onSuccess(profile);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => setIsOpen(true)}
        className="h-12 w-full gap-3 rounded-xl border-border bg-background text-[15px] font-medium text-foreground"
      >
        <GoogleLogo />
        {mode === "signup" ? "Registrarte con Google" : "Continuar con Google"}
      </Button>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-md gap-0 rounded-t-2xl p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <GoogleLogo />
              Elige una cuenta
            </SheetTitle>
            <SheetDescription>
              Google simulado (modo de prueba). Configura NEXT_PUBLIC_GOOGLE_CLIENT_ID para usar
              Google real.
            </SheetDescription>
          </SheetHeader>
          <ul className="flex flex-col py-2">
            {MOCK_GOOGLE_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  onClick={() => choose(account)}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                  >
                    {account.fullName.charAt(0)}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{account.fullName}</span>
                    <span className="text-xs text-muted-foreground">{account.email}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!isValidEmail) return;
              const normalized = normalizeEmail(email);
              choose({ email: normalized, fullName: getNameFromEmail(normalized) });
            }}
            className="flex gap-2 border-t border-border p-4"
          >
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Usar otra cuenta de Google"
              aria-label="Correo de otra cuenta de Google"
              className="h-10"
            />
            <Button type="submit" disabled={!isValidEmail} className="h-10">
              Continuar
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function GoogleSignInButton(props: GoogleSignInButtonProps) {
  return GOOGLE_CLIENT_ID ? <RealGoogleButton {...props} /> : <MockGoogleButton {...props} />;
}

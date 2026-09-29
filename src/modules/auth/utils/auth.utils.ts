import type { AuthUser } from "../types/auth.types";

const DEFAULT_REDIRECT = "/";

// Cuenta de prueba precargada (se muestra en /login).
export const DEMO_ACCOUNT = {
  fullName: "Cuenta Demo",
  email: "demo@ticketera.pe",
  password: "Demo1234",
};
// sha256("demo@ticketera.pe:Demo1234"), precalculado para sembrar el store sin esperar a Web Crypto.
export const DEMO_ACCOUNT_PASSWORD_HASH =
  "1edc57b5ece26556e5a0f4e7bc220697309bb1edd70d022971290424f633f5a7";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Hash SHA-256 (hex) de "correo:contraseña" con Web Crypto. No es un KDF de produccion
// (bcrypt/argon2 en backend), pero evita guardar la contraseña en texto plano.
export async function hashPassword(email: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${normalizeEmail(email)}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Lee nombre y correo del ID token (JWT) que devuelve Google Identity Services.
// Sin backend no se puede verificar la firma: sirve para probar, no para produccion.
export function decodeGoogleCredential(credential: string): AuthUser | null {
  const payload = credential.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes)) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    if (!data.email || data.email_verified === false) return null;
    return {
      email: normalizeEmail(data.email),
      fullName: data.name?.trim() || getNameFromEmail(data.email),
    };
  } catch {
    return null;
  }
}

// Solo rutas internas: evita usar ?redirect= para mandar al usuario a otro sitio (open redirect).
export function getSafeRedirect(
  value: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}

// "maria.perez_92@correo.com" -> "Maria Perez"
export function getNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const words = localPart
    .split(/[._\-+]+/)
    .map((word) => word.replace(/\d+/g, ""))
    .filter(Boolean);
  if (words.length === 0) return "Usuario";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

// "Maria Perez Lopez" -> "MP"
export function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export type AuthPath = "/login" | "/register" | "/forgot-password";

export function getAuthHref(path: AuthPath, redirect?: string | null): string {
  const safeRedirect = getSafeRedirect(redirect, "");
  return safeRedirect && safeRedirect !== DEFAULT_REDIRECT
    ? `${path}?redirect=${encodeURIComponent(safeRedirect)}`
    : path;
}

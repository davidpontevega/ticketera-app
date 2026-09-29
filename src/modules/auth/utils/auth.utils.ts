const DEFAULT_REDIRECT = "/";

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

export type AuthPath = "/login" | "/register";

export function getAuthHref(path: AuthPath, redirect?: string | null): string {
  const safeRedirect = getSafeRedirect(redirect, "");
  return safeRedirect && safeRedirect !== DEFAULT_REDIRECT
    ? `${path}?redirect=${encodeURIComponent(safeRedirect)}`
    : path;
}

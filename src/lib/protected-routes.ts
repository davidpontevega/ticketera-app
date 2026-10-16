import { createRouteMatcher } from "@clerk/nextjs/server";

/** Rutas que exigen sesion en el proxy (spec 026). El rol se verifica en servidor con `requireRole`. */
export const isProtectedRoute = createRouteMatcher([
  "/my-tickets(.*)",
  "/favorites(.*)",
  "/events/:slug/checkout(.*)",
  "/events/:slug/confirmation(.*)",
  "/organizer(/.*)?",
  "/admin(/.*)?",
]);

import Link from "next/link"
import { AtSign, Globe, Ticket, X } from "lucide-react"

import { Separator } from "@/components/ui/separator"

const FOOTER_COLUMNS = [
  {
    title: "Sobre nosotros",
    links: ["Quienes somos", "Trabaja con nosotros"],
  },
  {
    title: "Ayuda",
    links: ["Centro de ayuda", "Contacto", "Preguntas frecuentes"],
  },
  {
    title: "Legal",
    links: ["Terminos y condiciones", "Politica de privacidad"],
  },
] as const

// lucide-react 1.x removed brand/logo icons (Facebook, Instagram, Twitter);
// se usan iconos genericos equivalentes, con el aria-label indicando la red real.
const SOCIAL_LINKS = [
  { label: "Facebook", icon: Globe },
  { label: "Instagram", icon: AtSign },
  { label: "Twitter", icon: X },
] as const

export function SiteFooter() {
  return (
    <footer className="bg-foreground py-12 text-background md:py-16">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <Link
          href="/"
          className="mb-10 flex w-fit cursor-pointer items-center gap-2 text-lg font-semibold text-background"
        >
          <Ticket className="size-6 text-primary" aria-hidden />
          Ticketera
        </Link>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-background">
                {column.title}
              </h3>
              <ul className="mt-4 flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="cursor-pointer text-sm text-background/70 hover:text-primary"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="text-sm font-semibold text-background">
              Redes sociales
            </h3>
            <div className="mt-4 flex gap-3">
              {SOCIAL_LINKS.map(({ label, icon: Icon }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-background hover:bg-white/20"
                >
                  <Icon className="size-5" aria-hidden />
                </a>
              ))}
            </div>
          </div>
        </div>

        <Separator className="my-8 bg-background/20" />

        <p className="text-sm text-background/70">
          © 2026 Ticketera. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  )
}

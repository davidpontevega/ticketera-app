"use client"

import { Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function NewsletterSignup() {
  return (
    <section className="bg-primary/10 py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col items-center text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Mail className="size-6" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold">No te pierdas ningun evento</h2>
        <p className="mt-1 text-muted-foreground">
          Recibe novedades y preventas en tu correo
        </p>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex w-full max-w-md items-center gap-1 rounded-full bg-background p-1.5 shadow-sm mt-6"
        >
          <Input
            type="email"
            required
            placeholder="tu@email.com"
            aria-label="Correo electronico"
            className="h-9 rounded-full border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button type="submit" className="rounded-full shrink-0">
            Suscribirme
          </Button>
        </form>
      </div>
    </section>
  )
}

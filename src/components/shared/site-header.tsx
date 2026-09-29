"use client"

import Link from "next/link"
import { Menu } from "lucide-react"

import { BrandLogo } from "@/components/shared/brand-logo"
import { UserMenu } from "@/modules/auth"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const NAV_LINKS = [
  { href: "/events", label: "Eventos" },
  { href: "#", label: "Categorias" },
] as const

function NavLinks({ className }: { className?: string }) {
  return (
    <>
      {NAV_LINKS.map((link) => (
        <a
          key={link.label}
          href={link.href}
          className={`hover:text-primary transition-colors ${className ?? ""}`}
        >
          {link.label}
        </a>
      ))}
    </>
  )
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border shadow-sm bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <BrandLogo />

        <nav className="hidden items-center gap-6 md:flex">
          <NavLinks className="cursor-pointer text-sm font-medium text-foreground" />
        </nav>

        <div className="hidden shrink-0 items-center gap-4 md:flex">
          <UserMenu />
          <Button
            variant="outline"
            render={<Link href="#" />}
            nativeButton={false}
            className="cursor-pointer border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            Vender entradas
          </Button>
        </div>

        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="cursor-pointer md:hidden"
              />
            }
          >
            <Menu />
            <span className="sr-only">Abrir menu</span>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Ticketera</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-4 px-4">
              <NavLinks className="cursor-pointer text-sm font-medium text-foreground" />
            </nav>
            <div className="mt-auto flex flex-col gap-4 p-4">
              <UserMenu layout="sheet" />
              <Button
                variant="outline"
                render={<Link href="#" />}
                nativeButton={false}
                className="w-full cursor-pointer border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                Vender entradas
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

import { BrandLogo } from "@/components/shared/brand-logo";
import { cn } from "@/lib/utils";

const PURCHASE_STEPS = ["Entradas", "Datos y pago", "Confirmacion"] as const;

export type PurchaseStep = 1 | 2 | 3;

export interface PurchaseHeaderProps {
  currentStep: PurchaseStep;
  title: string; // titulo del paso en mobile, ej. "Elige tus entradas"
  backHref: string;
  backLabel: string;
}

export function PurchaseHeader({ currentStep, title, backHref, backLabel }: PurchaseHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      {/* Desktop */}
      <div className="mx-auto hidden h-16 max-w-7xl items-center justify-between gap-4 px-6 lg:flex">
        <div className="w-48">
          <BrandLogo />
        </div>
        <ol aria-label="Pasos de la compra" className="flex items-center gap-3 text-sm">
          {PURCHASE_STEPS.map((step, index) => {
            const stepNumber = index + 1;
            const isCurrent = stepNumber === currentStep;
            const isDone = stepNumber < currentStep;
            return (
              <li
                key={step}
                aria-current={isCurrent ? "step" : undefined}
                className="flex items-center gap-3"
              >
                {index > 0 && <span aria-hidden className="h-px w-10 bg-border" />}
                <span
                  className={cn(
                    "flex items-center gap-2",
                    isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-xs",
                      isCurrent || isDone
                        ? "bg-foreground text-background"
                        : "border border-border",
                    )}
                  >
                    {stepNumber}
                  </span>
                  {step}
                </span>
              </li>
            );
          })}
        </ol>
        <span className="flex w-48 items-center justify-end gap-2 text-sm text-muted-foreground">
          <Lock className="size-4" aria-hidden />
          Compra segura
        </span>
      </div>

      {/* Mobile */}
      <div className="lg:hidden">
        <div className="flex h-15 items-center gap-1 px-2">
          <Link
            href={backHref}
            aria-label={backLabel}
            className="flex size-11 cursor-pointer items-center justify-center rounded-lg text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <div className="flex flex-1 flex-col">
            <span className="text-xs text-muted-foreground">
              Paso {currentStep} de {PURCHASE_STEPS.length}
            </span>
            <span className="font-semibold">{title}</span>
          </div>
          <Lock className="mr-2 size-4 text-muted-foreground" aria-label="Compra segura" />
        </div>
        <div aria-hidden className="h-0.5 bg-border">
          <div
            className="h-full bg-primary"
            style={{ width: `${(currentStep / PURCHASE_STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </header>
  );
}

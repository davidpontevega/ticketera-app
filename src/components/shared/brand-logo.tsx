import Link from "next/link";
import { Ticket } from "lucide-react";

import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-2 text-lg font-semibold text-foreground",
        className,
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Ticket className="size-5" aria-hidden />
      </span>
      Ticketera
    </Link>
  );
}

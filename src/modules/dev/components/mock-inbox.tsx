"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, Inbox, Mail } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";
import { cn } from "@/lib/utils";

import { useDevMailStore } from "../store/dev-mail.store";

export const DEV_INBOX_PATH = "/dev/inbox";

const DATE_FORMAT = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const getEmailHref = (id: string) => `${DEV_INBOX_PATH}?id=${id}`;

export function MockInbox() {
  const isClient = useIsClient();
  const selectedId = useSearchParams().get("id");
  const emails = useDevMailStore((state) => state.emails);
  const markRead = useDevMailStore((state) => state.markRead);
  const selected = emails.find((email) => email.id === selectedId);

  useEffect(() => {
    if (selected && !selected.read) markRead(selected.id);
  }, [selected, markRead]);

  if (!isClient) return <div aria-busy className="h-96 animate-pulse rounded-2xl bg-muted" />;

  if (emails.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        titleAs="h2"
        title="Tu bandeja esta vacia"
        description="Aqui llegan los correos simulados de la app, como el enlace para restablecer tu contraseña."
        action={
          <Button render={<Link href="/forgot-password" />} nativeButton={false}>
            Recuperar contraseña
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <ul
        aria-label="Correos"
        className={cn(
          "flex flex-col divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10",
          selected && "hidden lg:flex",
        )}
      >
        {emails.map((email) => (
          <li key={email.id}>
            <Link
              href={getEmailHref(email.id)}
              aria-current={email.id === selected?.id ? "true" : undefined}
              className="flex gap-3 px-4 py-3 outline-none hover:bg-muted focus-visible:bg-muted aria-[current=true]:bg-primary/5"
            >
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  email.read ? "bg-transparent" : "bg-primary",
                )}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={cn("truncate text-sm", !email.read && "font-semibold")}>
                  {email.subject}
                  {!email.read && <span className="sr-only"> (no leido)</span>}
                </span>
                <span className="truncate text-xs text-muted-foreground">Para: {email.to}</span>
                <span className="text-xs text-muted-foreground">
                  {DATE_FORMAT.format(new Date(email.createdAt))}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {selected ? (
        <article className="flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 md:p-8">
          <Link
            href={DEV_INBOX_PATH}
            className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Volver a la bandeja
          </Link>
          <header className="flex flex-col gap-1 border-b pb-4">
            <h2 className="font-heading text-xl font-semibold">{selected.subject}</h2>
            <p className="text-sm text-muted-foreground">
              De: Ticketera &lt;no-reply@ticketera.pe&gt; · Para: {selected.to}
            </p>
            <p className="text-xs text-muted-foreground">
              {DATE_FORMAT.format(new Date(selected.createdAt))}
            </p>
          </header>
          <p className="leading-relaxed">{selected.body}</p>
          <Button
            size="lg"
            render={<Link href={selected.actionHref} />}
            nativeButton={false}
            className="h-11 w-full sm:w-fit"
          >
            {selected.actionLabel}
          </Button>
        </article>
      ) : (
        <div className="hidden flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-10 text-center text-muted-foreground lg:flex">
          <Mail className="size-6" aria-hidden />
          <p className="text-sm">Elige un correo para leerlo</p>
        </div>
      )}
    </div>
  );
}

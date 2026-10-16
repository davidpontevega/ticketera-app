"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getEventHref } from "@/modules/event";

import { changeEventStatusAction, deleteEventAction } from "../actions/organizer-event.actions";
import { getOrganizerEditEventPath } from "../constants/organizer.constants";
import type { EventAdminActionState, OrganizerDbEventStatus, OrganizerEventSummary } from "../types/organizer.types";

export interface OrganizerEventActionsProps {
  event: Pick<OrganizerEventSummary, "id" | "slug" | "title" | "status">;
}

type DialogMode = "publish" | "unpublish" | "cancel" | "delete";

const STATUS_CHANGE_CONTENT: Record<
  Exclude<DialogMode, "delete">,
  { title: string; description: string; confirmLabel: string; targetStatus: OrganizerDbEventStatus }
> = {
  publish: {
    title: "Publicar evento",
    description: "¿Publicar este evento? Sera visible para el publico.",
    confirmLabel: "Publicar",
    targetStatus: "published",
  },
  unpublish: {
    title: "Despublicar evento",
    description: "¿Despublicar este evento? Dejara de ser visible para el publico.",
    confirmLabel: "Despublicar",
    targetStatus: "draft",
  },
  cancel: {
    title: "Cancelar evento",
    description:
      "¿Cancelar este evento? Se reembolsara automaticamente a todos los compradores y sus entradas quedaran anuladas. No se puede revertir.",
    confirmLabel: "Cancelar evento",
    targetStatus: "cancelled",
  },
};

const DELETE_CONTENT = {
  title: "Eliminar evento",
  description: "¿Eliminar este evento? Esta accion no se puede deshacer.",
  confirmLabel: "Eliminar",
};

export function OrganizerEventActions({ event }: OrganizerEventActionsProps) {
  const [mode, setMode] = useState<DialogMode | null>(null);
  // Guarda el ultimo modo no nulo para que el dialogo no se vacie durante la animacion de
  // cierre (cuando `mode` ya es null pero el Dialog todavia esta animando su salida).
  const [content, setContent] = useState<DialogMode>(mode ?? "delete");
  if (mode && mode !== content) {
    setContent(mode);
  }

  const close = () => setMode(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Acciones de ${event.title}`}
          render={<Button type="button" variant="ghost" size="icon-sm" />}
        >
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {event.status === "published" && (
            <DropdownMenuItem render={<Link href={getEventHref(event.slug)} />}>
              Ver evento
            </DropdownMenuItem>
          )}
          {event.status !== "cancelled" && (
            <DropdownMenuItem render={<Link href={getOrganizerEditEventPath(event.id)} />}>
              Editar
            </DropdownMenuItem>
          )}
          {event.status === "draft" && (
            <DropdownMenuItem onClick={() => setMode("publish")}>Publicar</DropdownMenuItem>
          )}
          {event.status === "published" && (
            <DropdownMenuItem onClick={() => setMode("unpublish")}>Despublicar</DropdownMenuItem>
          )}
          {event.status !== "cancelled" && (
            <DropdownMenuItem variant="destructive" onClick={() => setMode("cancel")}>
              Cancelar evento
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onClick={() => setMode("delete")}>
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) close(); }}>
        <DialogContent className="sm:max-w-[420px]" showCloseButton={false}>
          {content === "delete" ? (
            <ConfirmDialogBody
              key={`delete-${event.id}`}
              action={deleteEventAction}
              hiddenFields={{ eventId: event.id }}
              variant="destructive"
              onClose={close}
              {...DELETE_CONTENT}
            />
          ) : (
            <ConfirmDialogBody
              key={`${content}-${event.id}`}
              action={changeEventStatusAction}
              hiddenFields={{ eventId: event.id, status: STATUS_CHANGE_CONTENT[content].targetStatus }}
              onClose={close}
              title={STATUS_CHANGE_CONTENT[content].title}
              description={STATUS_CHANGE_CONTENT[content].description}
              confirmLabel={STATUS_CHANGE_CONTENT[content].confirmLabel}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ConfirmDialogBodyProps {
  action: (prev: EventAdminActionState, formData: FormData) => Promise<EventAdminActionState>;
  hiddenFields: Record<string, string>;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "default" | "destructive";
  onClose: () => void;
}

function ConfirmDialogBody({
  action,
  hiddenFields,
  title,
  description,
  confirmLabel,
  variant = "default",
  onClose,
}: ConfirmDialogBodyProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" as const });

  // Cancelar devuelve un resumen de reembolsos: se muestra en vez de cerrar.
  const isCancelSummary = state.status === "success" && hiddenFields.status === "cancelled";

  useEffect(() => {
    if (state.status === "success" && !isCancelSummary) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (state.status === "success" && isCancelSummary) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p role="status" className="text-sm">
          {state.message}
        </p>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <form action={formAction} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {state.status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button type="submit" variant={variant} disabled={pending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

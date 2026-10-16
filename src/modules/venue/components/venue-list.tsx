"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { deleteVenueAction } from "../actions/venue.actions";
import type { VenueDto } from "../types/venue.types";

export interface VenueListProps {
  venues: VenueDto[];
}

const NEW_VENUE_PATH = "/organizer/venues/new";

export function VenueList({ venues }: VenueListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toDelete, setToDelete] = useState<VenueDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = () => {
    if (!toDelete) return;
    const venue = toDelete;
    startTransition(async () => {
      const result = await deleteVenueAction(venue.id);
      setToDelete(null);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setError(null);
      router.refresh();
    });
  };

  const newLink = (
    <Link href={NEW_VENUE_PATH} className={buttonVariants({ className: "h-11" })}>
      <Plus aria-hidden /> Nuevo recinto
    </Link>
  );

  if (venues.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Aun no tienes recintos"
        description="Crea un recinto con sus zonas para usarlo en tus eventos."
        action={newLink}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Recintos</h1>
        {newLink}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Ciudad</TableHead>
            <TableHead>Zonas</TableHead>
            <TableHead>Capacidad</TableHead>
            <TableHead>Eventos</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {venues.map((venue) => (
            <TableRow key={venue.id}>
              <TableCell className="font-medium">
                {venue.name}
                {!venue.isOwn && (
                  <Badge variant="secondary" className="ml-2">
                    De otro usuario
                  </Badge>
                )}
              </TableCell>
              <TableCell>{venue.city}</TableCell>
              <TableCell>{venue.zoneCount}</TableCell>
              <TableCell>{venue.capacity}</TableCell>
              <TableCell>{venue.eventCount}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/organizer/venues/${venue.id}`}
                    aria-label={`Editar ${venue.name}`}
                    className={buttonVariants({ variant: "outline", className: "h-11" })}
                  >
                    <Pencil aria-hidden /> Editar
                  </Link>
                  {venue.eventCount === 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11"
                      aria-label={`Eliminar ${venue.name}`}
                      onClick={() => setToDelete(venue)}
                    >
                      <Trash2 aria-hidden /> Eliminar
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Eliminar recinto ${toDelete?.name ?? ""}`}
        description="Se eliminaran el recinto, sus zonas y asientos. Esta accion no se puede deshacer."
        confirmLabel="Eliminar recinto"
        pending={isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

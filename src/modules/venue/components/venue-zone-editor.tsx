"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Grid3x3, Pencil, Plus, Trash2, Users } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { deleteZoneAction } from "../actions/venue.actions";
import type { VenueForEdit, VenueZoneDto } from "../types/venue.types";
import { MAX_ZONES_PER_VENUE } from "../utils/venue.utils";
import { VenuePreview } from "./venue-preview";
import { VenueZoneForm } from "./venue-zone-form";

export interface VenueZoneEditorProps {
  venue: VenueForEdit;
}

function describeZone(zone: VenueZoneDto): string {
  return zone.kind === "general"
    ? `General, capacidad ${zone.capacity}`
    : `Numerada, ${zone.rows} filas x ${zone.seatsPerRow} asientos (${zone.capacity})`;
}

export function VenueZoneEditor({ venue }: VenueZoneEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<VenueZoneDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = () => {
    if (!toDelete) return;
    const zone = toDelete;
    startTransition(async () => {
      const result = await deleteZoneAction(zone.id);
      setToDelete(null);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setError(null);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">
            Zonas ({venue.zones.length}/{MAX_ZONES_PER_VENUE})
          </CardTitle>
          <Button
            type="button"
            className="h-11"
            disabled={adding || venue.zones.length >= MAX_ZONES_PER_VENUE}
            onClick={() => setAdding(true)}
          >
            <Plus aria-hidden />
            Agregar zona
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {adding && (
            <div className="rounded-xl border p-4">
              <VenueZoneForm venueId={venue.id} onDone={() => setAdding(false)} />
            </div>
          )}
          {venue.zones.length === 0 && !adding && (
            <EmptyState
              icon={Grid3x3}
              titleAs="h2"
              title="Sin zonas"
              description="Agrega una zona numerada o general para poder usar este recinto en un evento."
            />
          )}
          <ul className="flex flex-col gap-3">
            {venue.zones.map((zone) => (
              <li key={zone.id} className="rounded-xl border p-4">
                {editingId === zone.id ? (
                  <VenueZoneForm venueId={venue.id} zone={zone} onDone={() => setEditingId(null)} />
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-2 font-semibold">
                        {zone.name}
                        {zone.inUse && (
                          <Badge variant="secondary">
                            <Users aria-hidden /> En uso
                          </Badge>
                        )}
                      </span>
                      <span className="text-sm text-muted-foreground">{describeZone(zone)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        aria-label={`Editar ${zone.name}`}
                        onClick={() => setEditingId(zone.id)}
                      >
                        <Pencil aria-hidden /> Editar
                      </Button>
                      {!zone.inUse && (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11"
                          aria-label={`Eliminar ${zone.name}`}
                          onClick={() => setToDelete(zone)}
                        >
                          <Trash2 aria-hidden /> Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {venue.zones.length > 0 && <VenuePreview venueName={venue.name} zones={venue.zones} />}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Eliminar zona ${toDelete?.name ?? ""}`}
        description="Se eliminara la zona y sus asientos. Esta accion no se puede deshacer."
        confirmLabel="Eliminar zona"
        pending={isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

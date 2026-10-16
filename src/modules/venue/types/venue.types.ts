export type VenueZoneKind = "general" | "numbered";

// Strings tal como llegan del form.
export interface VenueZoneInput {
  name: string;
  kind: VenueZoneKind;
  capacity?: string;
  rows?: string;
  seatsPerRow?: string;
}

export interface VenueInput {
  name: string;
  address: string;
  city: string;
  latitude?: string;
  longitude?: string;
}

export interface VenueZoneDto {
  id: string;
  name: string;
  kind: VenueZoneKind;
  /** Numeradas: numero de asientos. */
  capacity: number;
  rows: number;
  seatsPerRow: number;
  inUse: boolean;
  usedByEvents: number;
}

export interface VenueDto {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: string | null;
  longitude: string | null;
  zoneCount: number;
  capacity: number;
  eventCount: number;
  isOwn: boolean;
}

export interface VenueForEdit extends VenueDto {
  zones: VenueZoneDto[];
}

export interface VenueOption {
  id: string;
  name: string;
  city: string;
  zones: { id: string; name: string; kind: VenueZoneKind; capacity: number }[];
}

export type VenueError = "not-found" | "zone-locked" | "in-use" | "limit" | "unknown";

export type VenueActionState =
  | { status: "success"; id?: string }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<string, string>> };

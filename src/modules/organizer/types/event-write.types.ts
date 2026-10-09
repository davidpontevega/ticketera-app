import type {
  EventFormErrors,
  EventFormMode,
  EventFormValues,
  OrganizerDbEventStatus,
} from "./organizer.types";

export type SaveEventError =
  | "not-found"
  | "tiers-locked"
  | "past-date"
  | "no-tiers"
  | "invalid-transition"
  | "unknown";

export interface SaveEventInput {
  values: EventFormValues;
  intent: EventFormMode;
}

export type SaveEventActionState =
  | { status: "success"; eventId: string }
  | { status: "error"; message: string; fieldErrors?: EventFormErrors };

export interface EventForEdit {
  values: EventFormValues;
  status: OrganizerDbEventStatus;
  hasOrders: boolean;
}

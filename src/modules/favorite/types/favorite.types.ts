export type FavoriteActionState =
  | { status: "success" }
  | { status: "unauthenticated" }
  | { status: "not-found" }
  | { status: "error" };

export type SetFavoriteResult = "ok" | "not-found";

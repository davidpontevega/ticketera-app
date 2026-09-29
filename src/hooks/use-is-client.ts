import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// true solo en el cliente. En el HTML estatico/SSR y durante la hidratacion devuelve false,
// asi un componente que lee estado del navegador (localStorage) no genera hydration mismatch.
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

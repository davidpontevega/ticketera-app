import type { StorageArea, StorageEntry } from "../types/dev.types";

export const DEMO_STORAGE_PREFIX = "ticketera-";

function getArea(area: StorageArea): Storage {
  return area === "local" ? localStorage : sessionStorage;
}

// Claves de la app (ticketera-*) en localStorage y sessionStorage, con su tamaño en bytes.
export function listStorageEntries(): StorageEntry[] {
  const entries: StorageEntry[] = [];
  for (const area of ["local", "session"] as const) {
    const storage = getArea(area);
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(DEMO_STORAGE_PREFIX)) continue;
      const value = storage.getItem(key) ?? "";
      entries.push({ key, area, value, bytes: new Blob([value]).size });
    }
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

export function clearStorageEntry(key: string, area: StorageArea): void {
  getArea(area).removeItem(key);
}

// Borra todos los datos de prueba de la app (sesion, pedidos, eventos, bandeja...).
export function resetDemoData(): void {
  for (const entry of listStorageEntries()) clearStorageEntry(entry.key, entry.area);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

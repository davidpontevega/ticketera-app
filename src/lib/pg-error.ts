// postgres-js lanza con `code`; Drizzle puede envolverlo en `cause`.
export function pgErrorCode(error: unknown): string | undefined {
  const err = error as { code?: string; cause?: { code?: string } } | null;
  return err?.code ?? err?.cause?.code;
}

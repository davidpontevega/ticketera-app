export function AuthDivider({ label = "o" }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-3 text-xs text-muted-foreground uppercase"
      role="separator"
    >
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

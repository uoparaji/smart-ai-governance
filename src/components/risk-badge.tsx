export function RiskBadge({ level }: { level: "low" | "medium" | "high" | null | undefined }) {
  if (!level) return <span className="text-xs text-muted-foreground">—</span>;
  const map = {
    low: "bg-success/15 text-success border-success/30",
    medium: "bg-warning/15 text-warning border-warning/30",
    high: "bg-destructive/15 text-destructive border-destructive/30",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${map[level]}`}>
      {level}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tones: Record<string, string> = {
    production: "bg-success/15 text-success border-success/30",
    testing: "bg-warning/15 text-warning border-warning/30",
    proposed: "bg-muted text-muted-foreground border-border",
    retired: "bg-muted text-muted-foreground border-border",
    open: "bg-destructive/15 text-destructive border-destructive/30",
    investigating: "bg-warning/15 text-warning border-warning/30",
    resolved: "bg-success/15 text-success border-success/30",
    pending: "bg-muted text-muted-foreground border-border",
    approved: "bg-success/15 text-success border-success/30",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
    changes_requested: "bg-warning/15 text-warning border-warning/30",
    critical: "bg-destructive/15 text-destructive border-destructive/30",
    high: "bg-destructive/15 text-destructive border-destructive/30",
    medium: "bg-warning/15 text-warning border-warning/30",
    low: "bg-success/15 text-success border-success/30",
  };
  const cls = tones[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

import { clsx } from "clsx";

const TONES: Record<string, string> = {
  draft: "bg-muted/10 text-muted",
  confirmed: "bg-success/10 text-success",
  cancelled: "bg-danger/10 text-danger",
  lead: "bg-alert/10 text-alert",
  active: "bg-success/10 text-success",
  inactive: "bg-muted/10 text-muted",
  low: "bg-alert/10 text-alert",
  ok: "bg-success/10 text-success",
};

export function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center rounded-sm px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide", TONES[tone] ?? "bg-muted/10 text-muted")}>
      {children}
    </span>
  );
}

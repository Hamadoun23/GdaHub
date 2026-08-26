import { cn } from "@/jus/lib/utils";

export type Activity = {
  id: string | number;
  title: string;
  subtitle: string;
  amount?: string;
  initials: string;
  tone?: "primary" | "emerald" | "blue" | "amber" | "red";
};

const toneBg: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  red: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export function ActivityFeed({ items }: { items: Activity[] }) {
  return (
    <ul className="space-y-1">
      {items.map((a) => (
        <li
          key={a.id}
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50"
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              toneBg[a.tone ?? "primary"]
            )}
          >
            {a.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{a.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {a.subtitle}
            </p>
          </div>
          {a.amount && (
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {a.amount}
            </span>
          )}
        </li>
      ))}
      {items.length === 0 && (
        <li className="py-6 text-center text-sm text-muted-foreground">
          Aucune activité récente.
        </li>
      )}
    </ul>
  );
}

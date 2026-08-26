import { Badge } from "@/jus/composants/ui/badge";
import { cn } from "@/jus/lib/utils";

export type Tone =
  | "green"
  | "blue"
  | "amber"
  | "red"
  | "gray"
  | "orange"
  | "violet";

const tones: Record<Tone, string> = {
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  red: "bg-red-500/15 text-red-600 dark:text-red-400",
  gray: "bg-muted text-muted-foreground",
  orange: "bg-primary/15 text-primary",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
};

export function StatusBadge({
  label,
  tone = "gray",
  className,
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Badge className={cn("border-0 font-medium", tones[tone], className)}>
      {label}
    </Badge>
  );
}

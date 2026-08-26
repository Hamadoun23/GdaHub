import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ComponentType } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/jus/composants/ui/card";
import { cn } from "@/jus/lib/utils";

export type Stat = {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
};

export function StatCard({ stat }: { stat: Stat }) {
  const positive = stat.trend === "up";
  const Arrow = positive ? ArrowUpRight : ArrowDownRight;
  const Icon = stat.icon;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription>{stat.label}</CardDescription>
          {Icon && (
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
          )}
        </div>
        <CardTitle className="text-2xl">{stat.value}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-2 text-sm">
        {stat.delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium",
              positive
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/15 text-red-600 dark:text-red-400"
            )}
          >
            <Arrow className="size-3.5" />
            {stat.delta}
          </span>
        )}
        {stat.hint && <span className="text-muted-foreground">{stat.hint}</span>}
      </CardContent>
    </Card>
  );
}

export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((s) => (
        <StatCard key={s.label} stat={s} />
      ))}
    </div>
  );
}

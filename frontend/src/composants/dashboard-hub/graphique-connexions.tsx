"use client";

/**
 * Le graphique de connexions du tableau de bord du hub — a partir du vrai
 * journal d'identity (`/api/identity/connexions`), jamais de donnees
 * inventees : un hub sans activite recente affiche un graphique presque
 * plat, et c'est la verite.
 */

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/ui/chart";

const config = {
  reussies: { label: "Connexions reussies", color: "var(--chart-1)" },
  echouees: { label: "Tentatives echouees", color: "var(--chart-4)" },
} satisfies ChartConfig;

export function GraphiqueConnexions({
  data,
}: {
  data: { jour: string; reussies: number; echouees: number }[];
}) {
  const totalReussies = data.reduce((s, d) => s + d.reussies, 0);
  const totalEchouees = data.reduce((s, d) => s + d.echouees, 0);

  return (
    <Card className="relative h-full overflow-hidden rounded-3xl">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--chart-1)] via-[var(--chart-1)] to-transparent" />
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Connexions au hub</CardTitle>
          <CardDescription>
            {data.length > 0 ? `${data[0].jour} → ${data[data.length - 1].jour}` : "Aucune donnee"}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-ardoise-600 dark:text-ardoise-300">
            <span className="size-2 rounded-full" style={{ background: "var(--chart-1)" }} />
            {totalReussies}
          </span>
          <span className="flex items-center gap-1.5 font-medium text-ardoise-600 dark:text-ardoise-300">
            <span className="size-2 rounded-full" style={{ background: "var(--chart-4)" }} />
            {totalEchouees}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[260px] w-full">
          <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="fReussies" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-reussies)" stopOpacity={0.75} />
                <stop offset="95%" stopColor="var(--color-reussies)" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="fEchouees" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-echouees)" stopOpacity={0.65} />
                <stop offset="95%" stopColor="var(--color-echouees)" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" className="text-ardoise-200 dark:text-ardoise-700" />
            <XAxis dataKey="jour" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={{ stroke: "var(--color-reussies)", strokeWidth: 1, strokeDasharray: "3 3" }} content={<ChartTooltipContent indicator="dot" />} />
            <Area
              dataKey="reussies"
              type="monotone"
              fill="url(#fReussies)"
              stroke="var(--color-reussies)"
              strokeWidth={2.5}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
            />
            <Area
              dataKey="echouees"
              type="monotone"
              fill="url(#fEchouees)"
              stroke="var(--color-echouees)"
              strokeWidth={2}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

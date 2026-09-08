"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/ui/chart";

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ---- Aire : récolte + production ----
const prodConfig = {
  production: { label: "Jus produit (L)", color: "var(--chart-1)" },
  recolte: { label: "Récolte (t)", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function ProductionAreaChart({
  title = "Production & récolte",
  description = "7 derniers jours",
  data,
}: {
  title?: string;
  description?: string;
  /** Série { jour, recolte, production }. Obligatoire : le graphique doit
   *  refléter les données réelles, pas un jeu d'exemple. */
  data: { jour: string; recolte: number; production: number }[];
}) {
  return (
    <ChartCard title={title} description={description}>
      <ChartContainer config={prodConfig} className="h-[280px] w-full">
        <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="fP" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-production)" stopOpacity={0.7} />
              <stop offset="95%" stopColor="var(--color-production)" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="fR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-recolte)" stopOpacity={0.6} />
              <stop offset="95%" stopColor="var(--color-recolte)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="jour" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Area dataKey="recolte" type="natural" fill="url(#fR)" stroke="var(--color-recolte)" strokeWidth={2} stackId="a" />
          <Area dataKey="production" type="natural" fill="url(#fP)" stroke="var(--color-production)" strokeWidth={2} stackId="b" />
        </AreaChart>
      </ChartContainer>
    </ChartCard>
  );
}

// ---- Barres génériques ----
export function BarChartCard({
  title,
  description,
  data,
  xKey,
  barKey,
  label,
  unit = "",
}: {
  title: string;
  description?: string;
  data: Record<string, string | number>[];
  xKey: string;
  barKey: string;
  label: string;
  unit?: string;
}) {
  const config = { [barKey]: { label, color: "var(--chart-1)" } } satisfies ChartConfig;
  return (
    <ChartCard title={title} description={description}>
      <ChartContainer config={config} className="h-[280px] w-full">
        <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={36} unit={unit} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey={barKey} fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

// ---- Barres comparées système/seuil (stock) ----
const stockConfig = {
  stock: { label: "Stock", color: "var(--chart-1)" },
  seuil: { label: "Seuil", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function StockBarChart({
  data,
  title,
  description,
}: {
  data: { article: string; stock: number; seuil: number }[];
  title: string;
  description?: string;
}) {
  return (
    <ChartCard title={title} description={description}>
      <ChartContainer config={stockConfig} className="h-[280px] w-full">
        <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="article" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="stock" fill="var(--color-stock)" radius={[6, 6, 0, 0]} />
          <Bar dataKey="seuil" fill="var(--color-seuil)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

// ---- Donut générique ----
export function DonutChartCard({
  title,
  description,
  data,
}: {
  title: string;
  description?: string;
  data: { name: string; value: number; fill: string }[];
}) {
  const config = Object.fromEntries(
    data.map((d) => [d.name, { label: d.name, color: d.fill }])
  ) satisfies ChartConfig;
  return (
    <ChartCard title={title} description={description}>
      <ChartContainer config={config} className="mx-auto h-[280px] w-full">
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={4}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey="name" />} className="flex-wrap" />
        </PieChart>
      </ChartContainer>
    </ChartCard>
  );
}

// ---- Barres empilées qualité ----
const qualiteConfig = {
  excellent: { label: "Excellent", color: "var(--chart-1)" },
  bon: { label: "Bon", color: "var(--chart-2)" },
  mauvais: { label: "Mauvais", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function QualiteBarChart({
  data,
  title,
  description,
}: {
  data: { semaine: string; excellent: number; bon: number; mauvais: number }[];
  title: string;
  description?: string;
}) {
  return (
    <ChartCard title={title} description={description}>
      <ChartContainer config={qualiteConfig} className="h-[280px] w-full">
        <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="semaine" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="excellent" stackId="q" fill="var(--color-excellent)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="bon" stackId="q" fill="var(--color-bon)" />
          <Bar dataKey="mauvais" stackId="q" fill="var(--color-mauvais)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

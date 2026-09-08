"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Info,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Card } from "@/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/ui/chart";
import { cn } from "@/lib/cn";

/**
 * Briques analytiques des rapports.
 *
 * Un total seul ne se lit pas : il faut un point de comparaison, un sens de
 * variation et une répartition. Ces composants apportent les trois, à partir
 * des chiffres calculés par le serveur — rien n'est recalculé ici.
 */

// =========================================================
//  Types renvoyés par /api/reporting/<module>/
// =========================================================
export type Comparaison = {
  valeur: number;
  precedent: number;
  /** Écart en %, ou null quand la période précédente était à zéro. */
  variation: number | null;
};

export type Fait = {
  texte: string;
  ton: "positif" | "attention" | "alerte" | "neutre";
};

export type Indicateur = {
  label: string;
  valeur: number | null;
  unite: string;
  aide?: string;
  /** false quand une hausse est une mauvaise nouvelle (pertes, retards…). */
  sens_positif?: boolean;
};

export type Concentration = {
  total: number;
  lignes: { libelle: string; valeur: number; part: number; cumul: number }[];
  reste: number;
  nb_acteurs: number;
  acteurs_80pct: number;
  part_top3: number | null;
};

export type Analyse = {
  comparaison: Record<string, Comparaison>;
  periode_precedente: { date_debut: string; date_fin: string };
  serie: Record<string, string | number>[];
  serie_mesures: { cle: string; label: string }[];
  concentration: Concentration;
  concentration_titre: string;
  concentration_unite: string;
  indicateurs: Indicateur[];
  faits: Fait[];
};

// =========================================================
//  Variation : la flèche et le pourcentage
// =========================================================
/**
 * Écart par rapport à la période précédente.
 *
 * La couleur suit le *sens métier*, pas le signe : +30 % de pertes est rouge,
 * −30 % de pertes est vert. Elle n'est jamais seule — la flèche et le texte
 * portent la même information.
 */
export function Variation({
  comparaison,
  sensPositif = true,
  className,
}: {
  comparaison?: Comparaison;
  sensPositif?: boolean;
  className?: string;
}) {
  if (!comparaison) return null;
  const v = comparaison.variation;

  if (v === null) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        {comparaison.valeur ? "nouveau sur la période" : "aucun antécédent"}
      </span>
    );
  }

  const stable = Math.abs(v) < 0.05;
  const hausse = v > 0;
  const bon = hausse === sensPositif;
  const Fleche = stable ? ArrowRight : hausse ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        stable
          ? "text-muted-foreground"
          : bon
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400",
        className
      )}
      title={`Période précédente : ${new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 0,
      }).format(comparaison.precedent)}`}
    >
      <Fleche className="size-3.5" aria-hidden />
      {stable ? "stable" : `${v > 0 ? "+" : ""}${v.toFixed(1)} %`}
    </span>
  );
}

// =========================================================
//  Faits marquants
// =========================================================
const TONS = {
  positif: {
    Icone: Sparkles,
    classe: "border-l-emerald-500 bg-emerald-500/5",
    icone: "text-emerald-600 dark:text-emerald-400",
    libelle: "Bonne nouvelle",
  },
  attention: {
    Icone: Info,
    classe: "border-l-amber-500 bg-amber-500/5",
    icone: "text-amber-600 dark:text-amber-400",
    libelle: "À surveiller",
  },
  alerte: {
    Icone: TriangleAlert,
    classe: "border-l-red-500 bg-red-500/5",
    icone: "text-red-600 dark:text-red-400",
    libelle: "Alerte",
  },
  neutre: {
    Icone: Info,
    classe: "border-l-border bg-muted/30",
    icone: "text-muted-foreground",
    libelle: "Constat",
  },
} as const;

/**
 * Ce qu'il faut retenir de la période, en une phrase par constat.
 *
 * Chaque ton porte une icône ET un libellé : la couleur ne doit jamais être le
 * seul indice de gravité.
 */
export function FaitsMarquants({ faits }: { faits: Fait[] }) {
  if (faits.length === 0) return null;
  return (
    <section className="space-y-2" aria-label="Faits marquants de la période">
      <h2 className="text-sm font-semibold">Ce qu&apos;il faut retenir</h2>
      <div className="grid gap-2 md:grid-cols-2">
        {faits.map((f, i) => {
          const ton = TONS[f.ton] ?? TONS.neutre;
          const { Icone } = ton;
          return (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 rounded-xl border border-l-4 px-4 py-3",
                ton.classe
              )}
            >
              <Icone className={cn("mt-0.5 size-4 shrink-0", ton.icone)} aria-hidden />
              <p className="text-sm">
                <span className="sr-only">{ton.libelle} : </span>
                {f.texte}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// =========================================================
//  Indicateurs dérivés
// =========================================================
export function Indicateurs({ indicateurs }: { indicateurs: Indicateur[] }) {
  const utiles = indicateurs.filter((i) => i.valeur !== null);
  if (utiles.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {utiles.map((i) => (
        <Card key={i.label} className="gap-1 p-4">
          <p className="text-xs text-muted-foreground">{i.label}</p>
          <p className="text-2xl font-semibold tabular-nums">
            {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(
              i.valeur as number
            )}
            <span className="ml-0.5 text-base font-normal text-muted-foreground">
              {i.unite}
            </span>
          </p>
          {i.aide && <p className="text-xs text-muted-foreground">{i.aide}</p>}
        </Card>
      ))}
    </div>
  );
}

// =========================================================
//  Tendance
// =========================================================
const COULEURS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/**
 * Évolution dans le temps, à la granularité choisie par le serveur.
 *
 * Une seule échelle : deux mesures d'ordres de grandeur différents ne partagent
 * jamais un graphique à deux axes — la comparaison visuelle y serait fausse.
 */
export function Tendance({
  serie,
  mesures,
  titre = "Évolution sur la période",
  description,
}: {
  serie: Record<string, string | number>[];
  mesures: { cle: string; label: string }[];
  titre?: string;
  description?: string;
}) {
  if (serie.length === 0 || mesures.length === 0) return null;

  const config = Object.fromEntries(
    mesures.map((m, i) => [
      m.cle,
      { label: m.label, color: COULEURS[i % COULEURS.length] },
    ])
  ) satisfies ChartConfig;

  const vide = serie.every((p) =>
    mesures.every((m) => Number(p[m.cle] ?? 0) === 0)
  );

  return (
    <Card className="p-5">
      <div className="mb-1">
        <h3 className="font-semibold">{titre}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {vide ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Aucun mouvement enregistré sur cette période.
        </p>
      ) : (
        <ChartContainer config={config} className="h-[260px] w-full">
          <AreaChart data={serie} margin={{ left: 4, right: 8, top: 8 }}>
            <defs>
              {mesures.map((m, i) => (
                <linearGradient key={m.cle} id={`grad-${m.cle}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COULEURS[i % COULEURS.length]} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={COULEURS[i % COULEURS.length]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
            <XAxis
              dataKey="periode"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              className="text-xs"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              className="text-xs"
              tickFormatter={(v: number) => abrege(v)}
            />
            {/* Le survol est la couche de lecture par défaut d'un graphique
                web : sans elle, on ne peut pas lire une valeur précise. */}
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            {mesures.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
            {mesures.map((m, i) => (
              <Area
                key={m.cle}
                dataKey={m.cle}
                type="monotone"
                fill={`url(#grad-${m.cle})`}
                stroke={COULEURS[i % COULEURS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      )}
    </Card>
  );
}

// =========================================================
//  Concentration (Pareto)
// =========================================================
/**
 * Qui pèse quoi. Barres horizontales : les libellés sont des noms de
 * producteurs ou de clients, illisibles à la verticale.
 *
 * Une seule teinte — les barres mesurent la même grandeur, la couleur ne code
 * donc aucune identité. La part en % est écrite au bout de chaque barre, ce qui
 * dispense de lire l'axe.
 */
export function Repartition({
  concentration,
  titre,
  unite = "",
}: {
  concentration: Concentration;
  titre: string;
  unite?: string;
}) {
  const { lignes, nb_acteurs, acteurs_80pct, part_top3, reste } = concentration;
  if (lignes.length === 0) return null;

  // Une barre unique à 100 % n'est pas une répartition : elle occupe une carte
  // entière pour dire ce qu'une phrase dit mieux.
  if (lignes.length === 1) {
    return (
      <Card className="flex flex-col justify-center p-5">
        <h3 className="font-semibold">{titre}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Un seul contributeur sur la période :
        </p>
        <p className="mt-1 text-2xl font-semibold">{lignes[0].libelle}</p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
            lignes[0].valeur
          )}
          {unite} — la totalité du volume.
        </p>
      </Card>
    );
  }

  const config = {
    valeur: { label: titre, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  const hauteur = Math.max(180, lignes.length * 38 + 40);

  return (
    <Card className="p-5">
      <div className="mb-3">
        <h3 className="font-semibold">{titre}</h3>
        <p className="text-sm text-muted-foreground">
          {nb_acteurs > 1 ? (
            <>
              {acteurs_80pct} sur {nb_acteurs} font 80 % du total
              {part_top3 !== null && <> — les 3 premiers en font {part_top3.toFixed(0)} %</>}
            </>
          ) : (
            <>Un seul contributeur sur la période</>
          )}
          {reste > 0 && <> · {reste} autre(s) non affiché(s)</>}
        </p>
      </div>

      <ChartContainer config={config} style={{ height: hauteur }} className="w-full">
        <BarChart
          data={lignes}
          layout="vertical"
          margin={{ left: 4, right: 44, top: 4, bottom: 4 }}
          barCategoryGap="22%"
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.5} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="libelle"
            tickLine={false}
            axisLine={false}
            width={140}
            className="text-xs"
            tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(valeur) =>
                  `${new Intl.NumberFormat("fr-FR", {
                    maximumFractionDigits: 0,
                  }).format(Number(valeur))}${unite}`
                }
              />
            }
          />
          <Bar dataKey="valeur" radius={[0, 4, 4, 0]}>
            {lignes.map((l) => (
              <Cell key={l.libelle} fill="var(--chart-1)" />
            ))}
            {/* Étiquette directe : la part se lit sans revenir à un axe. */}
            <LabelList
              dataKey="part"
              position="right"
              offset={8}
              className="fill-muted-foreground text-xs tabular-nums"
              formatter={(v) => `${Number(v ?? 0).toFixed(0)} %`}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </Card>
  );
}

/** 1 250 000 → « 1,25 M ». Un axe encombré de zéros ne se lit pas. */
function abrege(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".0", "")} M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1).replace(".0", "")} k`;
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);
}

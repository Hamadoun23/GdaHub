"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table";
import { PageHeader } from "@/jus/composants/app/page-header";
import {
  FaitsMarquants,
  Indicateurs,
  Repartition,
  Tendance,
  Variation,
  type Analyse,
} from "@/jus/composants/app/analytique";
import { cn } from "@/lib/cn";
import {
  ApiError,
  fetchRapport,
  telechargerExportRapport,
  type Periode,
} from "@/jus/lib/api";

/**
 * Page de rapport détaillé.
 *
 * Les chiffres viennent de /api/reporting/<module>/, qui appelle les mêmes
 * services Django que les rapports HTML : les deux interfaces affichent donc
 * strictement les mêmes valeurs. Le bouton d'export réutilise également le
 * générateur Excel existant.
 */

export type ColonneRapport = {
  key: string;
  header: string;
  cell: (row: Record<string, unknown>) => React.ReactNode;
  align?: "left" | "right";
};

export type ConfigRapport = {
  module: string;
  titre: string;
  description: string;
  /** Indicateurs calculés depuis le payload de l'API. */
  kpis: (data: Record<string, unknown>) => {
    label: string;
    value: string | number;
    hint?: string;
    /**
     * Clé du bloc `analyse.comparaison` à afficher sous le chiffre. Sans elle,
     * l'indicateur reste un nombre sans point de comparaison.
     */
    compare?: string;
    /** false quand une hausse est une mauvaise nouvelle (pertes, retards…). */
    sensPositif?: boolean;
  }[];
  /** Clé du payload contenant la liste principale à afficher. */
  listeKey: string;
  colonnes: ColonneRapport[];
  /** Tableaux d'agrégats secondaires (par zone, par statut…). */
  agregats?: {
    titre: string;
    key: string;
    colonnes: ColonneRapport[];
  }[];
};

const PERIODES: { value: Periode; label: string }[] = [
  { value: "semaine", label: "7 derniers jours" },
  { value: "mois", label: "Mois en cours" },
  { value: "trimestre", label: "3 derniers mois" },
];

export function RapportPage({ config }: { config: ConfigRapport }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  // « mois » est la période par défaut côté serveur : on l'affiche comme telle.
  const [periode, setPeriode] = useState<Periode>("mois");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  const params = useCallback(
    () =>
      dateDebut && dateFin
        ? { date_debut: dateDebut, date_fin: dateFin }
        : { periode },
    [dateDebut, dateFin, periode]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchRapport(config.module, params()));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [config.module, params]);

  useEffect(() => {
    load();
  }, [load]);

  async function exporter() {
    setExporting(true);
    try {
      await telechargerExportRapport(config.module, params());
      toast.success("Export Excel téléchargé");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Export impossible");
    } finally {
      setExporting(false);
    }
  }

  const periodeAffichee = data?.periode as
    | { date_debut: string; date_fin: string }
    | undefined;
  const liste = (data?.[config.listeKey] as Record<string, unknown>[]) ?? [];
  // Bloc analytique calculé par le serveur : comparaison, tendance, Pareto.
  const analyse = data?.analyse as Analyse | undefined;
  const periodePrecedente = analyse?.periode_precedente;

  return (
    <div className="space-y-6">
      <PageHeader title={config.titre} description={config.description}>
        <Button onClick={exporter} disabled={exporting || loading} className="gap-2">
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Exporter en Excel
        </Button>
      </PageHeader>

      {/* Sélection de la période : périodes prédéfinies ou dates libres.
          `flex-row` est explicite : Card est en flex-col par défaut, et sans
          cela `items-end` alignait tous les contrôles à droite de la carte. */}
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-wrap gap-2">
          {PERIODES.map((p) => (
            <Button
              key={p.value}
              variant={!dateDebut && periode === p.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateDebut("");
                setDateFin("");
                setPeriode(p.value);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            Du
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="block h-9 rounded-md border bg-background px-2 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Au
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="block h-9 rounded-md border bg-background px-2 text-sm text-foreground"
            />
          </label>
        </div>
        {periodeAffichee && (
          <p className="ml-auto text-xs text-muted-foreground">
            Période analysée : {periodeAffichee.date_debut} → {periodeAffichee.date_fin}
          </p>
        )}
      </Card>

      {loading && (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && error && (
        <Card className="p-6 text-center text-destructive">{error}</Card>
      )}

      {!loading && !error && data && (
        <>
          {/* Les indicateurs de tête portent leur écart avec la période
              précédente de même durée : « 12 400 kg » ne dit rien, « 12 400 kg,
              +18 % » dit quelque chose. */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {config.kpis(data).map((k) => (
              <Card key={k.label} className="gap-1 p-4">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-xl font-semibold tabular-nums">{String(k.value)}</p>
                {k.compare && analyse?.comparaison?.[k.compare] ? (
                  <Variation
                    comparaison={analyse.comparaison[k.compare]}
                    sensPositif={k.sensPositif ?? true}
                  />
                ) : (
                  k.hint && (
                    <p className="text-xs text-muted-foreground">{k.hint}</p>
                  )
                )}
              </Card>
            ))}
          </div>

          {analyse && (
            <>
              <FaitsMarquants faits={analyse.faits} />

              <Indicateurs indicateurs={analyse.indicateurs} />

              <div className="grid gap-4 xl:grid-cols-2">
                <Tendance
                  serie={analyse.serie}
                  mesures={analyse.serie_mesures}
                  description={
                    periodePrecedente
                      ? `Comparé à ${periodePrecedente.date_debut} → ${periodePrecedente.date_fin}`
                      : undefined
                  }
                />
                <Repartition
                  concentration={analyse.concentration}
                  titre={analyse.concentration_titre}
                  unite={analyse.concentration_unite}
                />
              </div>
            </>
          )}

          {(config.agregats ?? []).map((agg) => {
            const lignes = (data[agg.key] as Record<string, unknown>[]) ?? [];
            if (lignes.length === 0) return null;
            return (
              <TableauRapport
                key={agg.key}
                titre={agg.titre}
                colonnes={agg.colonnes}
                lignes={lignes}
              />
            );
          })}

          <TableauRapport
            titre={`Détail (${liste.length})`}
            colonnes={config.colonnes}
            lignes={liste}
          />
        </>
      )}
    </div>
  );
}

function TableauRapport({
  titre,
  colonnes,
  lignes,
}: {
  titre: string;
  colonnes: ColonneRapport[];
  lignes: Record<string, unknown>[];
}) {
  return (
    <Card className="overflow-hidden rounded-2xl py-0 shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{titre}</h3>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="border-b bg-muted/60 backdrop-blur hover:bg-muted/60">
              {colonnes.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(
                    "h-11 whitespace-nowrap border-r border-border/40 px-4 font-medium text-foreground last:border-r-0",
                    c.align === "right" && "text-right"
                  )}
                >
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((row, i) => (
              <TableRow key={i}>
                {colonnes.map((c) => (
                  <TableCell
                    key={c.key}
                    className={cn(
                      "border-r border-border/30 px-4 py-3 last:border-r-0",
                      c.align === "right" && "text-right tabular-nums"
                    )}
                  >
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {lignes.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colonnes.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Aucune donnée sur cette période.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

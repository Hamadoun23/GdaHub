"use client";

import { Sprout, Droplets, Gauge, Boxes } from "lucide-react";
import { PageHeader } from "@/jus/composants/app/page-header";
import { StatGrid } from "@/jus/composants/app/stat-card";
import { MiniTable } from "@/jus/composants/app/mini-table";
import { StockBarChart, DonutChartCard } from "@/jus/composants/app/charts";
import { productions } from "@/jus/lib/data/production";
import { num, pct } from "@/jus/lib/format";
import { useRapports, valeur, liste } from "@/jus/lib/use-rapports";
import { repartitionEnDonut } from "@/jus/lib/data/donut";

/**
 * Agrège les rapports Récolte, Appro, Fabrication, Emballage et Entrepôt sur
 * l'année civile. Les cinq appels partent en parallèle ; un rapport refusé
 * selon le rôle n'empêche pas l'affichage des autres.
 *
 * Période annuelle et non mensuelle : sur un mois sans activité, tous les
 * indicateurs tomberaient à zéro et le tableau de bord semblerait en panne.
 */
export default function ProductionDashboard() {
  const annee = new Date().getFullYear();
  const { data, loading } = useRapports(
    ["recolte", "appro", "fabrication", "emballage", "entrepot"],
    { date_debut: `${annee}-01-01`, date_fin: `${annee}-12-31` }
  );

  const recolteKg = valeur(data, "recolte", "qte_total_kg");
  const volumeL = valeur(data, "fabrication", "volume_total_l");
  // Rendement : litres de jus obtenus par kilo d'orange réceptionné.
  const orangesRecues = valeur(data, "appro", "qte_bon_kg");
  const rendement = orangesRecues > 0 ? (volumeL / orangesRecues) * 100 : 0;

  const stock = liste<{ type_art_display: string; qte_art: number; seuil_alerte: number }>(
    data,
    "appro",
    "stock_actuel"
  ).map((a) => ({
    article: a.type_art_display,
    stock: Number(a.qte_art),
    seuil: Number(a.seuil_alerte),
  }));

  const bouteilles = liste<{ label: string; count: number }>(
    data,
    "emballage",
    "bouteilles_par_statut"
  );

  const periode = data.recolte?.periode as
    | { date_debut: string; date_fin: string }
    | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord — Production"
        description={
          periode
            ? `Récolte, fabrication et stocks · année ${annee}`
            : "Récolte, fabrication et stocks"
        }
      />

      <StatGrid
        stats={[
          {
            label: "Récolte",
            value: loading ? "…" : `${num(recolteKg)} kg`,
            hint: `${valeur(data, "recolte", "nb_cueillettes")} cueillette(s)`,
            icon: Sprout,
          },
          {
            label: "Jus produit",
            value: loading ? "…" : `${num(volumeL)} L`,
            hint: `${valeur(data, "fabrication", "nb_terminees")} production(s) terminée(s)`,
            icon: Droplets,
          },
          {
            label: "Rendement",
            value: loading ? "…" : orangesRecues > 0 ? pct(rendement) : "—",
            hint: "litres par kg d'orange reçue",
            icon: Gauge,
          },
          {
            label: "Alertes stock",
            value: loading ? "…" : String(valeur(data, "appro", "nb_articles_alerte")),
            hint: "articles sous le seuil",
            icon: Boxes,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {stock.length > 0 && (
            <StockBarChart
              data={stock}
              title="Niveaux de stock vs seuils d'alerte"
              description="Tous les articles suivis"
            />
          )}
        </div>
        {bouteilles.length > 0 && (
          <DonutChartCard
            title="Parc de bouteilles"
            description="Répartition par statut"
            data={repartitionEnDonut(bouteilles)}
          />
        )}
      </div>

      <MiniTable resource={productions} href="/jus/production/productions" />
    </div>
  );
}

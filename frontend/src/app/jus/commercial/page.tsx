"use client";

import { Banknote, ShoppingCart, Users, ReceiptText } from "lucide-react";
import { PageHeader } from "@/jus/composants/app/page-header";
import { StatGrid } from "@/jus/composants/app/stat-card";
import { MiniTable } from "@/jus/composants/app/mini-table";
import { DonutChartCard } from "@/jus/composants/app/charts";
import { ventes, factures } from "@/jus/lib/data/commercial";
import { xof } from "@/jus/lib/format";
import { useRapports, valeur, liste } from "@/jus/lib/use-rapports";
import { modesEnDonut } from "@/jus/lib/data/donut";

/**
 * Tous les chiffres proviennent de /api/reporting/distribution/ — les mêmes
 * agrégats que le rapport Distribution de l'interface Django.
 *
 * Période : l'année civile. Le rapport Django partait du mois en cours, mais un
 * tableau de bord vide pendant les mois creux se lit comme une panne. Les
 * périodes fines restent disponibles dans le rapport Distribution.
 */
export default function CommercialDashboard() {
  const annee = new Date().getFullYear();
  const { data, loading } = useRapports(["distribution"], {
    date_debut: `${annee}-01-01`,
    date_fin: `${annee}-12-31`,
  });

  const factureLignes = liste(data, "distribution", "factures");
  const impayes = factureLignes.reduce(
    (total, f) => total + Math.max(0, Number(f.reste_a_payer ?? 0)),
    0
  );
  const nbImpayees = factureLignes.filter(
    (f) => Number(f.reste_a_payer ?? 0) > 0
  ).length;

  const paiements = liste(data, "distribution", "paiements");
  const clientsServis = new Set(
    liste(data, "distribution", "ventes").map((v) => v.client_nom)
  ).size;

  const periode = data.distribution?.periode as
    | { date_debut: string; date_fin: string }
    | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord — Commercial"
        description={
          periode
            ? `Ventes, commandes et facturation · année ${annee}`
            : "Ventes, commandes et facturation"
        }
      />

      <StatGrid
        stats={[
          {
            label: "Chiffre d'affaires",
            value: loading ? "…" : xof(valeur(data, "distribution", "ca_total")),
            hint: "sur la période",
            icon: Banknote,
          },
          {
            label: "Commandes en attente",
            value: loading ? "…" : String(valeur(data, "distribution", "commandes_en_attente")),
            hint: `${valeur(data, "distribution", "nb_commandes")} au total`,
            icon: ShoppingCart,
          },
          {
            label: "Clients servis",
            value: loading ? "…" : String(clientsServis),
            hint: `${valeur(data, "distribution", "nb_ventes")} ventes`,
            icon: Users,
          },
          {
            label: "Reste à recouvrer",
            value: loading ? "…" : xof(impayes),
            hint: `${nbImpayees} facture(s) non soldée(s)`,
            icon: ReceiptText,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <DonutChartCard
          title="Modes de paiement"
          description="Répartition des encaissements de la période"
          data={modesEnDonut(paiements)}
        />
        <MiniTable resource={factures} href="/jus/commercial/factures" limit={6} />
      </div>

      <MiniTable resource={ventes} href="/jus/commercial/ventes" />
    </div>
  );
}

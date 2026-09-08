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

import { AFaire } from "@/composants/dashboard-hub/a-faire";
import { Total } from "@/composants/dashboard-hub/total";
import { Urgent } from "@/composants/dashboard-hub/urgent";
import type { ElementAFaire } from "@/composants/dashboard-hub/utiliser-a-faire";

const COULEUR_PAR_CODE = { facture: "#eb6834" };

type LigneFacture = {
  id: number;
  num_fact: string;
  client_nom: string;
  reste_a_payer: number;
  jours_avant_echeance: number | null;
};

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

  const factureLignes = liste<LigneFacture>(data, "distribution", "factures");
  const impayes = factureLignes.reduce(
    (total, f) => total + Math.max(0, Number(f.reste_a_payer ?? 0)),
    0
  );
  const facturesImpayees = factureLignes.filter((f) => Number(f.reste_a_payer ?? 0) > 0);
  const nbImpayees = facturesImpayees.length;

  // Factures non soldees -> ElementAFaire, pour reutiliser Total/Urgent/AFaire
  // (deja alignes sur la reference "Virtus") plutot qu'une liste bespoke.
  const elements: ElementAFaire[] | null = loading
    ? null
    : facturesImpayees.map((f) => ({
        cle: `facture-${f.id}`,
        code: "facture",
        app: "Facture",
        href: "/jus/commercial/factures",
        titre: `Facture ${f.num_fact}`,
        sousTitre: xof(f.reste_a_payer),
        personne: f.client_nom,
        etat: (f.jours_avant_echeance ?? 0) < 0 ? "retard" : "a_venir",
        urgent: (f.jours_avant_echeance ?? 0) < 0,
      }));

  const paiements = liste(data, "distribution", "paiements");
  const clientsServis = new Set(
    liste(data, "distribution", "ventes").map((v) => v.client_nom)
  ).size;

  const periode = data.distribution?.periode as
    | { date_debut: string; date_fin: string }
    | undefined;

  return (
    <div className="dark relative -m-4 min-h-[calc(100svh-4rem)] bg-background text-foreground md:-m-6">
      <div className="space-y-6 p-4 md:p-8">
        <PageHeader
          title="Tableau de bord — Commercial"
          description={
            periode
              ? `Ventes, commandes et facturation · année ${annee}`
              : "Ventes, commandes et facturation"
          }
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:items-stretch">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Total elements={elements} />
            <Urgent elements={elements} />
          </div>
          <div className="lg:col-span-3">
            <AFaire elements={elements} couleurParCode={COULEUR_PAR_CODE} />
          </div>
        </div>

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
    </div>
  );
}

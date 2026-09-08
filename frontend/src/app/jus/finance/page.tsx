"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Banknote,
  CheckCircle2,
  CircleAlert,
  Landmark,
  Receipt,
} from "lucide-react";
import { PageHeader } from "@/jus/composants/app/page-header";
import { StatGrid } from "@/jus/composants/app/stat-card";
import { DonutChartCard } from "@/jus/composants/app/charts";
import { Card } from "@/ui/card";
import { xof } from "@/jus/lib/format";
import {
  fetchRapprochementTresorerie,
  type LigneRapprochement,
} from "@/jus/lib/api";
import { useRapports, liste, valeur } from "@/jus/lib/use-rapports";
import { modesEnDonut } from "@/jus/lib/data/donut";

import { AFaire } from "@/composants/dashboard-hub/a-faire";
import { Total } from "@/composants/dashboard-hub/total";
import { Urgent } from "@/composants/dashboard-hub/urgent";
import type { ElementAFaire } from "@/composants/dashboard-hub/utiliser-a-faire";

const COULEUR_PAR_CODE = { ecart: "#eb6834" };

/**
 * Les indicateurs viennent du rapprochement de trésorerie (paiements déclarés
 * vs encaisses reçues) : ce sont les mêmes totaux que la page Trésorerie.
 */
export default function FinanceDashboard() {
  const [lignes, setLignes] = useState<LigneRapprochement[]>([]);
  const [totaux, setTotaux] = useState<{
    total_commercial: number;
    total_recu: number;
    ecart_global: number;
    nb_en_attente: number;
    nb_ecarts_non_traites: number;
  } | null>(null);

  // Année civile : sur un mois sans encaissement, tous les graphiques seraient
  // vides et le tableau de bord semblerait en panne.
  const annee = new Date().getFullYear();
  const { data } = useRapports(["distribution"], {
    date_debut: `${annee}-01-01`,
    date_fin: `${annee}-12-31`,
  });

  useEffect(() => {
    let annule = false;
    fetchRapprochementTresorerie()
      .then((r) => {
        if (annule) return;
        setLignes(r.lignes);
        setTotaux(r.totaux);
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, []);

  const caFacture = valeur(data, "distribution", "ca_total");
  const factures = liste(data, "distribution", "factures");
  const resteARecouvrer = factures.reduce(
    (total, f) => total + Math.max(0, Number(f.reste_a_payer ?? 0)),
    0
  );
  const facturesNonSoldees = factures.filter(
    (f) => Number(f.reste_a_payer ?? 0) > 0
  ).length;

  // Les trois maillons : ce qui a été facturé, ce que les commerciaux ont
  // encaissé, ce qui est effectivement arrivé en trésorerie.
  const etapes = [
    {
      label: "Chiffre d'affaires facturé",
      montant: caFacture,
      couleur: "bg-gradient-to-r from-primary to-[color-mix(in_oklch,var(--primary),black_15%)]",
      detail: "Total des ventes enregistrées sur la période.",
    },
    {
      label: "Encaissé par les commerciaux",
      montant: totaux?.total_commercial ?? 0,
      couleur: "bg-blue-500",
      detail: `${xof(resteARecouvrer)} restent à recouvrer auprès des clients.`,
    },
    {
      label: "Reçu en trésorerie",
      montant: totaux?.total_recu ?? 0,
      couleur: "bg-emerald-500",
      detail:
        totaux && totaux.ecart_global !== 0
          ? `Écart de ${xof(totaux.ecart_global)} avec les montants déclarés.`
          : "Conforme aux montants déclarés par les commerciaux.",
    },
  ];

  const conformes = lignes.filter((l) => l.statut_reception === "CONFORME").length;
  const receptionnes = lignes.filter((l) => l.reception_id !== null).length;
  const tauxConforme = receptionnes > 0 ? Math.round((conformes / receptionnes) * 100) : 0;

  // Écarts constatés et non encore justifiés : la file de travail du trésorier.
  const ecartsAJustifier = lignes.filter(
    (l) => l.reception_id !== null && !l.ecart_traite && (l.ecart ?? 0) !== 0
  );

  // Ecarts non traites -> ElementAFaire, pour reutiliser Total/Urgent/AFaire
  // plutot qu'une liste bespoke.
  const elements: ElementAFaire[] | null = totaux === null
    ? null
    : ecartsAJustifier.map((l) => ({
        cle: `ecart-${l.paiement_id}`,
        code: "ecart",
        app: "Écart",
        href: "/jus/finance/tresorerie",
        titre: l.num_fact ?? `Paiement #${l.paiement_id}`,
        sousTitre: xof(l.ecart ?? 0),
        personne: l.num_fact ?? `Paiement #${l.paiement_id}`,
        etat: "a_valider",
        urgent: (l.ecart ?? 0) < 0,
      }));

  return (
    <div className="dark relative -m-4 min-h-[calc(100svh-4rem)] bg-background text-foreground md:-m-6">
      <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Tableau de bord — Finance"
        description={`Chiffre d'affaires, encaissements et écarts · année ${annee}`}
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
            label: "Chiffre d'affaires facturé",
            value: caFacture ? xof(caFacture) : "…",
            hint: `${valeur(data, "distribution", "nb_ventes")} vente(s)`,
            icon: Receipt,
          },
          {
            label: "Encaissé par les commerciaux",
            value: totaux ? xof(totaux.total_commercial) : "…",
            hint: caFacture
              ? `${Math.round((totaux?.total_commercial ?? 0) / caFacture * 100)} % du CA`
              : undefined,
            icon: Banknote,
          },
          {
            label: "Reçu en trésorerie",
            value: totaux ? xof(totaux.total_recu) : "…",
            hint: `${receptionnes} réception(s) saisie(s)`,
            icon: Landmark,
          },
          {
            label: "Écart trésorerie",
            value: totaux ? xof(totaux.ecart_global) : "…",
            hint: "reçu − déclaré par les commerciaux",
            icon: ArrowLeftRight,
          },
        ]}
      />

      {/* La chaîne de l'argent, du CA facturé jusqu'à la caisse : c'est là que
          se lisent les manques — non encaissé par les commerciaux, puis non
          remonté en trésorerie. */}
      <Card className="p-5">
        <h3 className="font-semibold">Du chiffre d&apos;affaires à la caisse</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Chaque étape doit se retrouver dans la suivante. Un écart signale un
          encaissement manquant ou une remise en trésorerie incomplète.
        </p>
        <div className="mt-5 space-y-4">
          {etapes.map((e) => (
            <div key={e.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{e.label}</span>
                <span className="tabular-nums font-semibold">{xof(e.montant)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${e.couleur}`}
                  style={{
                    width: `${caFacture > 0 ? Math.min(100, (e.montant / caFacture) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{e.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <StatGrid
        stats={[
          {
            label: "Reste à recouvrer",
            value: xof(resteARecouvrer),
            hint: `${facturesNonSoldees} facture(s) non soldée(s)`,
            icon: CircleAlert,
          },
          {
            label: "Écarts à justifier",
            value: totaux ? String(totaux.nb_ecarts_non_traites) : "…",
            hint: `${totaux?.nb_en_attente ?? 0} réception(s) en attente`,
            icon: ArrowLeftRight,
          },
          {
            label: "Réceptions conformes",
            value: receptionnes > 0 ? `${tauxConforme} %` : "—",
            hint: `${conformes} sur ${receptionnes}`,
            icon: CheckCircle2,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <DonutChartCard
          title="Modes de paiement"
          description={`Répartition des encaissements · année ${annee}`}
          data={modesEnDonut(liste(data, "distribution", "paiements"))}
        />

        <Card className="p-6">
          <h3 className="font-semibold">Écarts en attente de justification</h3>
          {ecartsAJustifier.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Aucun écart à traiter : toutes les réceptions saisies sont conformes
              ou déjà justifiées.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                {ecartsAJustifier.length} réception(s) présentent un écart entre le
                montant déclaré et le montant encaissé.
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                {ecartsAJustifier.slice(0, 5).map((l) => {
                  const negatif = (l.ecart ?? 0) < 0;
                  return (
                    <li
                      key={l.paiement_id}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                        negatif ? "bg-red-500/10" : "bg-blue-500/10"
                      }`}
                    >
                      <span className="font-mono text-xs">
                        {l.num_fact ?? `Paiement #${l.paiement_id}`}
                      </span>
                      <span
                        className={
                          negatif
                            ? "font-medium text-red-600 dark:text-red-400"
                            : "font-medium text-blue-600 dark:text-blue-400"
                        }
                      >
                        {(l.ecart ?? 0) > 0 ? "+" : ""}
                        {xof(l.ecart ?? 0)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <Link
            href="/jus/finance/tresorerie"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Ouvrir la trésorerie →
          </Link>
        </Card>
      </div>
      </div>
    </div>
  );
}

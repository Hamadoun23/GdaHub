"use client";

import { useEffect, useState } from "react";
import { Banknote, Droplets, Sprout, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/jus/composants/app/page-header";
import { StatGrid, type Stat } from "@/jus/composants/app/stat-card";
import { ProductionAreaChart } from "@/jus/composants/app/charts";
import { RadialGauge } from "@/jus/composants/app/radial-gauge";
import { ActivityFeed, type Activity } from "@/jus/composants/app/activity-feed";
import { InvoiceCard } from "@/jus/composants/app/invoice-card";
import { ZonesPanel, type Zone } from "@/jus/composants/app/zones-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/jus/composants/ui/card";
import { Badge } from "@/jus/composants/ui/badge";
import { fetchList, fetchSummary } from "@/jus/lib/api";
import { xof, num } from "@/jus/lib/format";
import { ventes as ventesRes, factures as facturesRes } from "@/jus/lib/data/commercial";
import { useRapports, liste } from "@/jus/lib/use-rapports";
import { serieRecolteProduction } from "@/jus/lib/data/series";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

type Row = { id: string | number; [k: string]: unknown };

export default function DirectionDashboard() {
  const [kpi, setKpi] = useState<Record<string, number>>({});
  const [zones, setZones] = useState<Zone[]>([]);
  const [stockCount, setStockCount] = useState(0);
  const [feed, setFeed] = useState<Activity[]>([]);
  const [invoice, setInvoice] = useState<{
    numero: string;
    client: string;
    montant: string;
    echeance: string;
    statut: string;
    paidPct: number;
  } | null>(null);

  useEffect(() => {
    fetchSummary()
      .then((s) => {
        setKpi(s.kpi);
        setZones(s.recolte_zone.filter((z) => z.tonnage));
        setStockCount(s.stock_articles.length);
      })
      .catch(() => {});

    fetchList<Record<string, unknown>>("ventes")
      .then((data) => {
        const rows = data.map(ventesRes.fromApi!);
        setFeed(
          rows.slice(0, 6).map((v) => ({
            id: v.id,
            title: v.client_nom,
            subtitle: `Vente #${v.id} · ${v.date_vente}`,
            amount: xof(v.montant_total),
            initials: initials(v.client_nom || "?"),
            tone: "primary" as const,
          }))
        );
      })
      .catch(() => {});

    fetchList<Record<string, unknown>>("factures")
      .then((data) => {
        const rows = data.map(facturesRes.fromApi!);
        const f = rows[0];
        if (f) {
          const paidPct =
            f.statut === "ACHAT_VENTE" ? 100 : f.statut === "PARTIELLE" ? 50 : 0;
          setInvoice({
            numero: f.num_fact,
            client: f.client_nom,
            montant: xof(f.montant),
            echeance: f.date_echeance,
            statut:
              f.statut === "ACHAT_VENTE"
                ? "Payée"
                : f.statut === "PARTIELLE"
                ? "Partielle"
                : f.statut === "ANNULEE"
                ? "Annulée"
                : "Émise",
            paidPct,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Série récolte / production sur l'année civile, construite depuis les
  // rapports détaillés (l'API n'expose pas de série temporelle prête à l'emploi).
  const annee = new Date().getFullYear();
  const { data: rapports } = useRapports(["recolte", "fabrication"], {
    date_debut: `${annee}-01-01`,
    date_fin: `${annee}-12-31`,
  });
  const serie = serieRecolteProduction(
    liste(rapports, "recolte", "cueillettes"),
    liste(rapports, "fabrication", "productions")
  );

  // Objectif de CA indicatif, faute d'objectif stocké en base.
  const caObjectif = 1_000_000;
  const caPct = kpi.ca_total ? (kpi.ca_total / caObjectif) * 100 : 0;
  const stockSainPct = stockCount
    ? ((stockCount - (kpi.articles_sous_seuil ?? 0)) / stockCount) * 100
    : 0;

  // Aucune variation affichée : l'API ne fournit pas de comparaison avec la
  // période précédente, et un pourcentage inventé induirait en erreur.
  const stats: Stat[] = [
    { label: "Chiffre d'affaires", value: kpi.ca_total != null ? xof(kpi.ca_total) : "—", hint: "cumul", icon: Banknote },
    { label: "Stock de jus", value: kpi.jus_stock != null ? num(kpi.jus_stock) : "—", hint: "bouteilles 33cl + 1L", icon: Droplets },
    { label: "Récolte cumulée", value: kpi.recolte_total != null ? num(kpi.recolte_total, "kg") : "—", hint: "toutes campagnes", icon: Sprout },
    { label: "Alertes stock", value: String(kpi.articles_sous_seuil ?? "—"), hint: "articles sous seuil", icon: TriangleAlert },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord — Direction"
        description="Vue consolidée de l'activité JusOrange"
      >
        <Badge variant="outline" className="gap-1.5 py-1">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          Chaîne opérationnelle
        </Badge>
      </PageHeader>

      <StatGrid stats={stats} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Objectifs & santé</CardTitle>
            <CardDescription>Indicateurs clés</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-around gap-4">
            <RadialGauge value={caPct} label="Objectif CA" tone="primary" sub="du mois" />
            <RadialGauge value={stockSainPct} label="Stock sain" tone="emerald" sub="articles OK" />
          </CardContent>
        </Card>

        <ZonesPanel zones={zones} />

        {invoice ? (
          <InvoiceCard
            numero={invoice.numero}
            client={invoice.client}
            montant={invoice.montant}
            echeance={invoice.echeance}
            statutLabel={invoice.statut}
            statutTone="blue"
            paidPct={invoice.paidPct}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Dernière facture</CardTitle>
              <CardDescription>Chargement…</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProductionAreaChart
            description={`Par date · année ${annee}`}
            data={serie}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
            <CardDescription>Dernières ventes</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={feed} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

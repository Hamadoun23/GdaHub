"use client";

import Link from "next/link";
import {
  Sprout,
  PackageOpen,
  FlaskConical,
  Package,
  Boxes,
  FileText,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/jus/composants/app/page-header";
import { StatGrid } from "@/jus/composants/app/stat-card";
import { BarChartCard, ProductionAreaChart } from "@/jus/composants/app/charts";
import { Card, CardContent } from "@/ui/card";
import { num, xof } from "@/jus/lib/format";
import { useRapports, valeur, liste } from "@/jus/lib/use-rapports";
import { serieRecolteProduction } from "@/jus/lib/data/series";

const rapports = [
  { label: "Récolte", href: "/jus/reporting/recolte", icon: Sprout, desc: "Cueillettes & qualité" },
  { label: "Approvisionnement", href: "/jus/reporting/appro", icon: PackageOpen, desc: "Réceptions & stock" },
  { label: "Fabrication", href: "/jus/reporting/fabrication", icon: FlaskConical, desc: "Ordres de production" },
  { label: "Emballage", href: "/jus/reporting/emballage", icon: Package, desc: "Conditionnements" },
  { label: "Entrepôt", href: "/jus/reporting/entrepot", icon: Boxes, desc: "Inventaires & écarts" },
  { label: "Distribution", href: "/jus/reporting/distribution", icon: FileText, desc: "Ventes & paiements" },
];

export default function ReportingOverview() {
  // Vue consolidée sur l'année civile : ce tableau de bord sert de synthèse,
  // les périodes fines se règlent dans chaque rapport.
  const annee = new Date().getFullYear();
  const { data, loading } = useRapports(
    ["recolte", "fabrication", "emballage", "distribution"],
    { date_debut: `${annee}-01-01`, date_fin: `${annee}-12-31` }
  );

  const bouteillesDispo = valeur(data, "emballage", "bouteilles_dispo");
  const recolteParZone = liste<{
    producteur__zone: string;
    qte_total: number;
  }>(data, "recolte", "par_zone").map((z) => ({
    zone: z.producteur__zone || "Non renseignée",
    tonnage: Number(z.qte_total),
  }));

  const serie = serieRecolteProduction(
    liste(data, "recolte", "cueillettes"),
    liste(data, "fabrication", "productions")
  );

  return (
    <div className="">
      <div className="space-y-6 p-4 md:p-8">
        <PageHeader
          title="Reporting — Vue d'ensemble"
          description={`Indicateurs consolidés de toute la chaîne de valeur · année ${annee}`}
        />

        <StatGrid
          stats={[
            {
              label: "Récolte cumulée",
              value: loading ? "…" : `${num(valeur(data, "recolte", "qte_total_kg"))} kg`,
              hint: `${valeur(data, "recolte", "nb_cueillettes")} cueillette(s)`,
            },
            {
              label: "Jus produit",
              value: loading ? "…" : `${num(valeur(data, "fabrication", "volume_total_l"))} L`,
              hint: `${valeur(data, "fabrication", "nb_productions")} production(s)`,
            },
            {
              label: "Bouteilles disponibles",
              value: loading ? "…" : num(bouteillesDispo),
              hint: "33cl + 1L en stock",
            },
            {
              label: "Chiffre d'affaires",
              value: loading ? "…" : xof(valeur(data, "distribution", "ca_total")),
              hint: `${valeur(data, "distribution", "nb_ventes")} vente(s)`,
            },
          ]}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <ProductionAreaChart
            title="Production & récolte"
            description={`Par date · année ${annee}`}
            data={serie}
          />
          {recolteParZone.length > 0 && (
            <BarChartCard
              title="Récolte par zone"
              description="Tonnage cumulé sur l'année (kg)"
              data={recolteParZone}
              xKey="zone"
              barKey="tonnage"
              label="Récolte (kg)"
              unit="kg"
            />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rapports.map((r) => {
            const Icon = r.icon;
            return (
              <Link key={r.href} href={r.href}>
                <Card className="group h-full transition-colors hover:border-primary/50">
                  <CardContent className="flex items-center gap-4">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold">{r.label}</p>
                      <p className="text-sm text-muted-foreground">{r.desc}</p>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
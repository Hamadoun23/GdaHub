import { Landmark } from "lucide-react";
import { StatusBadge, type Tone } from "@/jus/composants/app/status-badge";
import { frDate, xof } from "@/jus/lib/format";
import { buildToApi, nb, str } from "@/jus/lib/data/helpers";
import type { Resource } from "@/jus/lib/types";

type Tresorerie = {
  id: number;
  facture: string;
  montant_declare: number;
  montant_recu: number;
  date_reception: string;
  ecart_traite: boolean;
};

function statutReception(ecart: number): { label: string; tone: Tone } {
  if (Math.abs(ecart) < 0.01) return { label: "Conforme", tone: "green" };
  return ecart > 0
    ? { label: "Écart positif", tone: "blue" }
    : { label: "Écart négatif", tone: "red" };
}

/**
 * Aperçu en lecture seule, utilisé par le tableau de bord Finance.
 *
 * La saisie et la gestion des écarts se font sur la page dédiée
 * (`TresoreriePage`) : elle affiche le rapprochement complet, y compris les
 * paiements encore sans réception, que ce listing ne peut pas montrer.
 */
export const tresorerie: Resource<Tresorerie> = {
  key: "tresorerie",
  title: "Trésorerie",
  singular: "Réception",
  description:
    "Réceptions de paiements côté trésorier et écarts avec les montants déclarés.",
  icon: Landmark,
  endpoint: "tresorerie",
  canCreate: false,
  canEdit: false,
  fromApi: (o) => ({
    id: o.id as number,
    facture: str(o, "num_fact"),
    montant_declare: nb(o, "montant_declare"),
    montant_recu: nb(o, "montant_recu"),
    date_reception: str(o, "date_reception"),
    ecart_traite: Boolean(o.ecart_traite),
  }),
  toApi: buildToApi({ numbers: ["paiement", "montant_recu"] }),
  searchable: (r) => r.facture,
  columns: [
    { key: "fact", header: "Facture", cell: (r) => <span className="font-mono text-xs font-medium">{r.facture}</span> },
    { key: "declare", header: "Déclaré", align: "right", cell: (r) => <span className="tabular-nums text-muted-foreground">{xof(r.montant_declare)}</span> },
    { key: "recu", header: "Reçu", align: "right", cell: (r) => <span className="tabular-nums font-medium">{xof(r.montant_recu)}</span> },
    { key: "ecart", header: "Écart", align: "right", cell: (r) => {
      const e = r.montant_recu - r.montant_declare;
      if (e === 0) return <span className="text-muted-foreground">0</span>;
      return <span className={e > 0 ? "text-blue-600 dark:text-blue-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>{e > 0 ? "+" : ""}{xof(e)}</span>;
    } },
    { key: "statut", header: "Statut", cell: (r) => { const s = statutReception(r.montant_recu - r.montant_declare); return <StatusBadge label={s.label} tone={s.tone} />; } },
    { key: "traite", header: "Écart traité", cell: (r) => r.ecart_traite ? <StatusBadge label="Oui" tone="green" /> : <StatusBadge label="À traiter" tone="amber" /> },
    { key: "date", header: "Date", cell: (r) => frDate(r.date_reception) },
  ],
  // Aucun champ : la saisie passe par la page Trésorerie, où le montant reçu
  // est confronté au montant déclaré et où l'écart se justifie explicitement.
  fields: [],
};

export const financeResources = { tresorerie };

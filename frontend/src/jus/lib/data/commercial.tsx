import {
  BadgeCheck,
  Citrus,
  FileText,
  HandCoins,
  ReceiptText,
  ShoppingCart,
  UserRound,
  Wallet,
} from "lucide-react";
import { StatusBadge, type Tone } from "@/jus/composants/app/status-badge";
import { frDate, num, xof } from "@/jus/lib/format";
import { buildToApi, nb, str } from "@/jus/lib/data/helpers";
import type { Resource } from "@/jus/lib/types";

// Les clés étrangères portent l'identifiant (valeur attendue par les listes
// déroulantes en modification) ; le libellé lisible va dans un champ `*_nom`.

// ---------- Clients ----------
type Client = {
  id: number;
  nom_complet: string;
  tel_client: string;
  email: string;
  adresse: string;
};

export const clients: Resource<Client> = {
  key: "clients",
  title: "Clients",
  singular: "Client",
  description: "Acheteurs de jus (boutiques, grossistes, particuliers).",
  icon: UserRound,
  endpoint: "clients",
  fromApi: (o) => o as unknown as Client,
  toApi: buildToApi({}),
  searchable: (r) => `${r.nom_complet} ${r.tel_client} ${r.email}`,
  stats: (rows) => [
    { label: "Clients", value: rows.length },
    { label: "Avec téléphone", value: rows.filter((r) => r.tel_client).length },
    { label: "Avec email", value: rows.filter((r) => r.email).length },
  ],
  columns: [
    { key: "nom", header: "Nom complet", cell: (r) => <span className="font-medium">{r.nom_complet}</span> },
    { key: "tel", header: "Téléphone", cell: (r) => <span className="text-muted-foreground">{r.tel_client || "—"}</span> },
    { key: "email", header: "Email", cell: (r) => <span className="text-muted-foreground">{r.email || "—"}</span> },
    { key: "adresse", header: "Adresse", cell: (r) => r.adresse || "—" },
  ],
  fields: [
    { name: "nom_complet", label: "Nom complet", type: "text", required: true, colSpan: 2 },
    // Un client doit rester joignable : au moins l'un des deux.
    { name: "tel_client", label: "Téléphone", type: "tel", hint: "Téléphone ou email obligatoire." },
    { name: "email", label: "Email", type: "email" },
    { name: "adresse", label: "Adresse", type: "textarea" },
  ],
};

// ---------- Ventes ----------
type Vente = {
  id: number;
  client: number | null;
  client_nom: string;
  date_vente: string;
  montant_total: number;
  statut_paiement: string;
  total_paye: number;
  reste_a_payer: number;
};

const venteStatut = (s: string): { label: string; tone: Tone } =>
  s === "ACHAT_VENTE" ? { label: "Achat-vente", tone: "green" }
  : s === "PARTIELLE" ? { label: "Partielle", tone: "amber" }
  : { label: "Dépôt-vente", tone: "blue" };

export const ventes: Resource<Vente> = {
  key: "ventes",
  title: "Ventes",
  singular: "Vente",
  newLabel: "Nouvelle vente",
  description: "Transactions commerciales avec les clients.",
  icon: Citrus,
  endpoint: "ventes",
  fromApi: (o) => ({
    id: o.id as number,
    client: (o.client as number) ?? null,
    client_nom: str(o, "client_nom"),
    date_vente: str(o, "date_vente"),
    montant_total: nb(o, "montant_total"),
    statut_paiement: str(o, "statut_paiement"),
    total_paye: nb(o, "total_paye"),
    reste_a_payer: nb(o, "reste_a_payer"),
  }),
  toApi: buildToApi({ numbers: ["client", "montant_total"] }),
  searchable: (r) => `${r.client_nom} #${r.id}`,
  stats: (rows) => [
    { label: "Ventes", value: rows.length },
    { label: "Chiffre d'affaires", value: xof(rows.reduce((s, r) => s + r.montant_total, 0)) },
    { label: "Encaissé", value: xof(rows.reduce((s, r) => s + r.total_paye, 0)) },
    { label: "Reste à encaisser", value: xof(rows.reduce((s, r) => s + r.reste_a_payer, 0)) },
  ],
  columns: [
    { key: "id", header: "N°", cell: (r) => <span className="font-mono text-xs">#{r.id}</span> },
    { key: "client", header: "Client", cell: (r) => <span className="font-medium">{r.client_nom}</span> },
    { key: "date", header: "Date", cell: (r) => frDate(r.date_vente) },
    { key: "montant", header: "Montant", align: "right", cell: (r) => <span className="font-medium tabular-nums">{xof(r.montant_total)}</span> },
    { key: "paye", header: "Payé", align: "right", cell: (r) => <span className="tabular-nums text-muted-foreground">{xof(r.total_paye)}</span> },
    { key: "reste", header: "Reste", align: "right", cell: (r) => r.reste_a_payer > 0
      ? <span className="tabular-nums font-medium text-amber-600 dark:text-amber-400">{xof(r.reste_a_payer)}</span>
      : <StatusBadge label="Soldée" tone="green" /> },
    { key: "statut", header: "Paiement", cell: (r) => { const s = venteStatut(r.statut_paiement); return <StatusBadge label={s.label} tone={s.tone} />; } },
  ],
  fields: [
    { name: "client", label: "Client", type: "select", optionsFrom: "clients", required: true, colSpan: 2 },
    { name: "date_vente", label: "Date de vente", type: "date", required: true },
    { name: "montant_total", label: "Montant total (XOF)", type: "number", required: true },
    { name: "statut_paiement", label: "Statut paiement", type: "select", options: [
      { value: "ACHAT_VENTE", label: "Achat-vente" },
      { value: "PARTIELLE", label: "Partielle" },
      { value: "DEPOT_VENTE", label: "Dépôt-vente" },
    ] },
  ],
};

// ---------- Commandes ----------
type Commande = {
  id: number;
  client: number | null;
  client_nom: string;
  date_cmd: string;
  quantite_33cl: number;
  quantite_1l: number;
  total: number;
  complete: boolean;
};

/**
 * « Compléter » est le workflow central du module : il transforme la commande
 * en vente facturée, sort les bouteilles du stock en FIFO sur la DLC et
 * enregistre le paiement selon le statut choisi. Tout est fait côté serveur
 * dans une transaction — le formulaire ne recueille que la décision de paiement.
 */
export const commandes: Resource<Commande> = {
  key: "commandes",
  title: "Commandes",
  singular: "Commande",
  newLabel: "Nouvelle commande",
  description: "Demandes clients (quantités 33cl / 1L) à compléter en vente.",
  icon: ShoppingCart,
  endpoint: "commandes",
  fromApi: (o) => ({
    id: o.id as number,
    client: (o.client as number) ?? null,
    client_nom: str(o, "client_nom"),
    date_cmd: str(o, "date_cmd"),
    quantite_33cl: nb(o, "quantite_33cl"),
    quantite_1l: nb(o, "quantite_1l"),
    total: nb(o, "total"),
    complete: Boolean(o.est_completee),
  }),
  toApi: buildToApi({ numbers: ["client", "quantite_33cl", "quantite_1l"] }),
  searchable: (r) => `${r.client_nom} #${r.id}`,
  stats: (rows) => [
    { label: "Commandes", value: rows.length },
    { label: "En attente", value: rows.filter((r) => !r.complete).length },
    { label: "Complétées", value: rows.filter((r) => r.complete).length },
  ],
  columns: [
    { key: "id", header: "N°", cell: (r) => <span className="font-mono text-xs">#{r.id}</span> },
    { key: "client", header: "Client", cell: (r) => <span className="font-medium">{r.client_nom}</span> },
    { key: "date", header: "Date", cell: (r) => frDate(r.date_cmd) },
    { key: "q33", header: "33cl", align: "right", cell: (r) => num(r.quantite_33cl) },
    { key: "q1l", header: "1L", align: "right", cell: (r) => num(r.quantite_1l) },
    { key: "total", header: "Total", align: "right", cell: (r) => <span className="tabular-nums">{xof(r.total)}</span> },
    { key: "statut", header: "État", cell: (r) => <StatusBadge label={r.complete ? "Complétée" : "En attente"} tone={r.complete ? "green" : "amber"} /> },
  ],
  fields: [
    { name: "client", label: "Client", type: "select", optionsFrom: "clients", required: true, colSpan: 2 },
    { name: "date_cmd", label: "Date de commande", type: "date", required: true },
    { name: "quantite_33cl", label: "Quantité 33cl", type: "number", hint: "Au moins une des deux quantités." },
    { name: "quantite_1l", label: "Quantité 1L", type: "number" },
  ],
  actions: [
    {
      key: "completer",
      label: "Compléter en vente",
      icon: BadgeCheck,
      // Une commande déjà liée à une vente ne se complète pas deux fois.
      available: (r) => !r.complete,
      action: "completer",
      title: (r) => `Compléter la commande #${r.id} — ${xof(r.total)}`,
      description:
        "Crée la vente, la facture (échéance à 30 jours) et sort les bouteilles du stock. Les prix des jus doivent être paramétrés et le stock suffisant.",
      successMessage: "Vente et facture créées",
      initial: () => ({ statut_paiement: "DEPOT_VENTE" }),
      fields: [
        { name: "statut_paiement", label: "Statut du paiement", type: "select", required: true, colSpan: 2, options: [
          { value: "DEPOT_VENTE", label: "Dépôt-vente (rien de payé)" },
          { value: "PARTIELLE", label: "Partielle (acompte)" },
          { value: "ACHAT_VENTE", label: "Achat-vente (payé intégralement)" },
        ] },
        { name: "montant_paye", label: "Montant déjà payé (XOF)", type: "number", colSpan: 2, hint: "Uniquement si « Partielle » : doit être inférieur au montant total." },
      ],
      toApi: buildToApi({ numbers: ["montant_paye"] }),
    },
  ],
};

// ---------- Factures ----------
type Facture = {
  id: number;
  num_fact: string;
  vente: number | null;
  client_nom: string;
  date_fact: string;
  montant: number;
  statut: string;
  date_echeance: string;
  total_paye: number;
  reste_a_payer: number;
  // Calculé par le serveur depuis l'échéance et le reste dû.
  recouvrement: { statut: string; libelle: string };
};

const tonRecouvrement = (statut: string): Tone =>
  statut === "SOLDEE" ? "green"
  : statut === "RECOUVREMENT" ? "red"
  : statut === "RELANCE" ? "amber"
  : statut === "A_ECHOIR" ? "blue"
  : "gray";

const factStatut = (s: string): { label: string; tone: Tone } =>
  s === "ACHAT_VENTE" ? { label: "Payée", tone: "green" }
  : s === "PARTIELLE" ? { label: "Partielle", tone: "amber" }
  : s === "ANNULEE" ? { label: "Annulée", tone: "red" }
  : { label: "Émise", tone: "blue" };

export const factures: Resource<Facture> = {
  key: "factures",
  title: "Factures",
  singular: "Facture",
  newLabel: "Nouvelle facture",
  description: "Documents de facturation liés aux ventes.",
  icon: ReceiptText,
  endpoint: "factures",
  fromApi: (o) => ({
    id: o.id as number,
    num_fact: str(o, "num_fact"),
    vente: (o.vente as number) ?? null,
    client_nom: str(o, "client_nom"),
    date_fact: str(o, "date_fact"),
    montant: nb(o, "montant"),
    statut: str(o, "statut"),
    date_echeance: str(o, "date_echeance"),
    total_paye: nb(o, "total_paye"),
    reste_a_payer: nb(o, "reste_a_payer"),
    recouvrement: (o.recouvrement as { statut: string; libelle: string }) ?? {
      statut: "SANS_ECHEANCE",
      libelle: "—",
    },
  }),
  toApi: buildToApi({ numbers: ["vente", "montant"] }),
  searchable: (r) => `${r.num_fact} ${r.client_nom}`,
  // Le numéro de facture ouvre la fiche de recouvrement.
  rowHref: (r) => `/jus/commercial/factures/${r.id}`,
  stats: (rows) => [
    { label: "Factures", value: rows.length },
    { label: "Soldées", value: rows.filter((r) => r.reste_a_payer <= 0).length },
    { label: "À recouvrer", value: rows.filter((r) => r.recouvrement.statut === "RECOUVREMENT").length },
    { label: "Montant à recouvrer", value: xof(rows.reduce((s, r) => s + Math.max(0, r.reste_a_payer), 0)) },
  ],
  columns: [
    { key: "num", header: "N° facture", cell: (r) => <span className="font-mono text-xs font-medium">{r.num_fact}</span> },
    { key: "client", header: "Client", cell: (r) => <span className="font-medium">{r.client_nom}</span> },
    { key: "date", header: "Émise le", cell: (r) => frDate(r.date_fact) },
    { key: "montant", header: "Montant", align: "right", cell: (r) => <span className="tabular-nums">{xof(r.montant)}</span> },
    { key: "reste", header: "Reste à payer", align: "right", cell: (r) => r.reste_a_payer > 0
      ? <span className="tabular-nums font-medium text-amber-600 dark:text-amber-400">{xof(r.reste_a_payer)}</span>
      : <StatusBadge label="Soldée" tone="green" /> },
    { key: "ech", header: "Échéance", cell: (r) => frDate(r.date_echeance) },
    { key: "recouvrement", header: "Recouvrement", cell: (r) => (
      <StatusBadge label={r.recouvrement.libelle} tone={tonRecouvrement(r.recouvrement.statut)} />
    ) },
    { key: "statut", header: "Statut", cell: (r) => { const s = factStatut(r.statut); return <StatusBadge label={s.label} tone={s.tone} />; } },
  ],
  fields: [
    { name: "vente", label: "Vente", type: "select", optionsFrom: "ventes", required: true, colSpan: 2 },
    { name: "date_fact", label: "Date facture", type: "date", required: true },
    { name: "montant", label: "Montant (XOF)", type: "number", required: true },
    { name: "date_echeance", label: "Date d'échéance", type: "date", required: true },
    { name: "statut", label: "Statut", type: "select", options: [
      { value: "EMIS", label: "Émise" },
      { value: "ACHAT_VENTE", label: "Payée" },
      { value: "PARTIELLE", label: "Partielle" },
      { value: "ANNULEE", label: "Annulée" },
    ] },
  ],
  actions: [
    {
      key: "paiement",
      label: "Enregistrer un paiement",
      icon: HandCoins,
      // Inutile de proposer un encaissement sur une facture déjà soldée.
      available: (r) => r.reste_a_payer > 0,
      action: "paiement",
      title: (r) => `Paiement — ${r.num_fact} (reste ${xof(r.reste_a_payer)})`,
      description:
        "Le montant ne peut pas dépasser le reste à payer. Les statuts de la facture et de la vente sont mis à jour automatiquement.",
      successMessage: "Paiement enregistré",
      initial: () => ({ mode_paie: "ESPECE" }),
      fields: [
        { name: "date_paie", label: "Date de paiement", type: "date", required: true },
        { name: "montant", label: "Montant (XOF)", type: "number", required: true },
        { name: "mode_paie", label: "Mode de paiement", type: "select", required: true, options: [
          { value: "ESPECE", label: "Espèce" },
          { value: "CHEQUE", label: "Chèque" },
          { value: "VIREMENT", label: "Virement" },
          { value: "MOBILE", label: "Mobile" },
        ] },
        { name: "reference", label: "Référence", type: "text", hint: "N° de chèque, de virement… (optionnel)" },
      ],
      toApi: buildToApi({ numbers: ["montant"] }),
    },
  ],
};

// ---------- Paiements ----------
type Paiement = {
  id: number;
  facture: number | null;
  facture_num: string;
  date_paie: string;
  montant: number;
  mode_paie: string;
  reference: string;
};

const modeLabel = (m: string): { label: string; tone: Tone } =>
  m === "ESPECE" ? { label: "Espèce", tone: "green" }
  : m === "CHEQUE" ? { label: "Chèque", tone: "blue" }
  : m === "VIREMENT" ? { label: "Virement", tone: "violet" }
  : { label: "Mobile", tone: "orange" };

export const paiements: Resource<Paiement> = {
  key: "paiements",
  title: "Paiements",
  singular: "Paiement",
  description: "Paiements partiels ou totaux des factures.",
  icon: Wallet,
  endpoint: "paiements",
  fromApi: (o) => ({
    id: o.id as number,
    facture: (o.facture as number) ?? null,
    facture_num: str(o, "num_fact"),
    date_paie: str(o, "date_paie"),
    montant: nb(o, "montant"),
    mode_paie: str(o, "mode_paie"),
    reference: str(o, "reference"),
  }),
  toApi: buildToApi({ numbers: ["facture", "montant"] }),
  searchable: (r) => `${r.facture_num} ${r.reference}`,
  stats: (rows) => [
    { label: "Paiements", value: rows.length },
    { label: "Total encaissé", value: xof(rows.reduce((s, r) => s + r.montant, 0)) },
  ],
  columns: [
    { key: "fact", header: "Facture", cell: (r) => <span className="font-mono text-xs">{r.facture_num}</span> },
    { key: "date", header: "Date", cell: (r) => frDate(r.date_paie) },
    { key: "montant", header: "Montant", align: "right", cell: (r) => <span className="tabular-nums font-medium">{xof(r.montant)}</span> },
    { key: "mode", header: "Mode", cell: (r) => { const s = modeLabel(r.mode_paie); return <StatusBadge label={s.label} tone={s.tone} />; } },
    { key: "ref", header: "Référence", cell: (r) => r.reference ? <span className="font-mono text-xs text-muted-foreground">{r.reference}</span> : "—" },
  ],
  fields: [
    { name: "facture", label: "Facture", type: "select", optionsFrom: "factures", required: true, colSpan: 2 },
    { name: "date_paie", label: "Date de paiement", type: "date", required: true },
    { name: "montant", label: "Montant (XOF)", type: "number", required: true },
    { name: "mode_paie", label: "Mode de paiement", type: "select", required: true, options: [
      { value: "ESPECE", label: "Espèce" },
      { value: "CHEQUE", label: "Chèque" },
      { value: "VIREMENT", label: "Virement" },
      { value: "MOBILE", label: "Mobile" },
    ] },
    { name: "reference", label: "Référence", type: "text" },
  ],
};

export const commercialResources = {
  clients,
  ventes,
  commandes,
  factures,
  paiements,
};

export const distributionIcon = FileText;

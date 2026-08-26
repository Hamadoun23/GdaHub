import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  MessageSquare,
  Package,
  PackageOpen,
  PlusCircle,
  Sprout,
  UserRound,
  Wine,
} from "lucide-react";
import { StatusBadge, type Tone } from "@/jus/composants/app/status-badge";
import { frDate, num, pct, xof } from "@/jus/lib/format";
import { buildToApi, nb, str } from "@/jus/lib/data/helpers";
import type { Field, Resource } from "@/jus/lib/types";

// ---------- Producteurs ----------
type Producteur = {
  id: number;
  nom_complet: string;
  // INTERNE : nos vergers, dont on suit les cueillettes.
  // EXTERNE : fournisseur tiers, dont on ne fait que réceptionner les livraisons.
  type_prod: string;
  zone: string;
  contact: string;
  adresse: string;
  actif: boolean;
  date_creation: string;
};

export const producteurs: Resource<Producteur> = {
  key: "producteurs",
  title: "Producteurs",
  singular: "Producteur",
  description: "Producteurs d'oranges partenaires et leurs zones de récolte.",
  icon: UserRound,
  endpoint: "producteurs",
  fromApi: (o) => o as unknown as Producteur,
  toApi: buildToApi({}),
  searchable: (r) => `${r.nom_complet} ${r.zone} ${r.contact}`,
  stats: (rows) => [
    { label: "Total", value: rows.length },
    { label: "Internes", value: rows.filter((r) => r.type_prod === "INTERNE").length },
    { label: "Externes", value: rows.filter((r) => r.type_prod === "EXTERNE").length },
    { label: "Actifs", value: rows.filter((r) => r.actif).length },
  ],
  columns: [
    { key: "nom", header: "Nom complet", cell: (r) => <span className="font-medium">{r.nom_complet}</span> },
    { key: "type", header: "Type", cell: (r) => r.type_prod === "EXTERNE"
      ? <StatusBadge label="Externe" tone="violet" />
      : <StatusBadge label="Interne" tone="blue" /> },
    { key: "zone", header: "Zone", cell: (r) => r.zone },
    { key: "contact", header: "Contact", cell: (r) => <span className="text-muted-foreground">{r.contact}</span> },
    { key: "statut", header: "Statut", cell: (r) => <StatusBadge label={r.actif ? "Actif" : "Inactif"} tone={r.actif ? "green" : "gray"} /> },
    { key: "date", header: "Créé le", cell: (r) => frDate(r.date_creation) },
  ],
  fields: [
    { name: "nom_complet", label: "Nom complet", type: "text", required: true, colSpan: 2 },
    { name: "type_prod", label: "Type de producteur", type: "select", required: true, colSpan: 2,
      hint: "Interne : nos vergers, dont on enregistre les cueillettes. Externe : fournisseur qui livre directement, sans cueillette.",
      options: [
        { value: "INTERNE", label: "Interne (cueillettes suivies)" },
        { value: "EXTERNE", label: "Externe (livraison directe)" },
      ] },
    { name: "zone", label: "Zone", type: "text", required: true },
    { name: "contact", label: "Contact", type: "tel", required: true },
    { name: "adresse", label: "Adresse", type: "textarea" },
    { name: "actif", label: "Producteur actif", type: "checkbox", hint: "Décochez pour désactiver ce producteur." },
  ],
};

// ---------- Cueillettes ----------
type Cueillette = {
  id: number;
  // `producteur` porte l'identifiant : c'est la valeur attendue par la liste
  // déroulante lors d'une modification. Le libellé va dans `producteur_nom`.
  producteur: number | null;
  producteur_nom: string;
  date_cueil: string;
  qte_total: number;
  qte_bon: number;
  taux_qualite: number;
  observation: string;
};

const tauxTone = (t: number): Tone => (t >= 80 ? "green" : t >= 50 ? "amber" : "red");

export const cueillettes: Resource<Cueillette> = {
  key: "cueillettes",
  title: "Cueillettes",
  singular: "Cueillette",
  newLabel: "Nouvelle cueillette",
  description: "Récoltes d'oranges enregistrées par producteur.",
  icon: Sprout,
  endpoint: "cueillettes",
  fromApi: (o) => ({
    id: o.id as number,
    producteur: (o.producteur as number) ?? null,
    producteur_nom: str(o, "producteur_display"),
    date_cueil: str(o, "date_cueil"),
    qte_total: nb(o, "qte_total"),
    qte_bon: nb(o, "qte_bon"),
    taux_qualite: nb(o, "taux_qualite"),
    observation: str(o, "observation"),
  }),
  toApi: buildToApi({ numbers: ["producteur", "qte_total", "qte_bon"] }),
  searchable: (r) => `${r.producteur_nom} ${r.date_cueil}`,
  stats: (rows) => {
    const total = rows.reduce((s, r) => s + r.qte_total, 0);
    const bon = rows.reduce((s, r) => s + r.qte_bon, 0);
    return [
      { label: "Cueillettes", value: rows.length },
      { label: "Total récolté", value: `${num(total)} kg` },
      { label: "Dont bonnes", value: `${num(bon)} kg` },
      { label: "Taux de qualité", value: total > 0 ? pct((bon / total) * 100) : "—" },
    ];
  },
  columns: [
    { key: "prod", header: "Producteur", cell: (r) => <span className="font-medium">{r.producteur_nom}</span> },
    { key: "date", header: "Date", cell: (r) => frDate(r.date_cueil) },
    { key: "total", header: "Total", align: "right", cell: (r) => num(r.qte_total, "kg") },
    { key: "bon", header: "Bon", align: "right", cell: (r) => num(r.qte_bon, "kg") },
    { key: "mauvais", header: "Perte", align: "right", cell: (r) => <span className="text-muted-foreground">{num(r.qte_total - r.qte_bon, "kg")}</span> },
    { key: "taux", header: "Qualité", align: "right", cell: (r) => <StatusBadge label={pct(r.taux_qualite)} tone={tauxTone(r.taux_qualite)} /> },
  ],
  fields: [
    // Seuls les producteurs internes apparaissent : la récolte d'un producteur
    // externe ne nous concerne pas, on ne fait que réceptionner ses livraisons.
    { name: "producteur", label: "Producteur", type: "select", optionsFrom: "producteurs_internes", required: true, colSpan: 2, hint: "Producteurs internes uniquement." },
    { name: "date_cueil", label: "Date de cueillette", type: "date", required: true },
    { name: "qte_total", label: "Quantité totale (kg)", type: "number", required: true },
    { name: "qte_bon", label: "Quantité bonne (kg)", type: "number", required: true, hint: "Ne peut pas dépasser la quantité totale." },
    { name: "observation", label: "Observation", type: "textarea" },
  ],
};

// ---------- Articles / Stock ----------
type Article = {
  id: number;
  type_art: string;
  type_art_display: string;
  qte_art: number;
  seuil_alerte: number;
  prix_33cl: number | null;
  prix_1l: number | null;
  actualisable: boolean;
};

/**
 * Deux process distincts, comme dans l'interface Django :
 * - « paramétrer » : définir le type, le seuil d'alerte et, pour les jus, le prix ;
 * - « actualiser » : AJOUTER une quantité au stock.
 * La quantité n'est jamais saisie directement — sinon un stock pourrait être
 * écrasé par erreur au lieu d'être incrémenté.
 */
export const articles: Resource<Article> = {
  key: "articles",
  title: "Articles / Stock",
  singular: "Article",
  description: "Paramétrage et niveaux de stock des articles.",
  icon: Boxes,
  endpoint: "articles",
  newLabel: "Paramétrer un article",
  fromApi: (o) => o as unknown as Article,
  toApi: buildToApi({ numbers: ["seuil_alerte", "prix_33cl", "prix_1l"] }),
  searchable: (r) => r.type_art_display ?? r.type_art,
  stats: (rows) => [
    { label: "Articles", value: rows.length },
    { label: "Sous le seuil", value: rows.filter((r) => r.qte_art <= r.seuil_alerte).length },
    { label: "Niveau correct", value: rows.filter((r) => r.qte_art > r.seuil_alerte).length },
  ],
  columns: [
    { key: "type", header: "Article", cell: (r) => <span className="font-medium">{r.type_art_display}</span> },
    { key: "qte", header: "Stock", align: "right", cell: (r) => num(r.qte_art) },
    { key: "seuil", header: "Seuil", align: "right", cell: (r) => <span className="text-muted-foreground">{num(r.seuil_alerte)}</span> },
    { key: "alerte", header: "État", cell: (r) => r.qte_art <= r.seuil_alerte ? <StatusBadge label="Sous le seuil" tone="red" /> : <StatusBadge label="OK" tone="green" /> },
    { key: "gestion", header: "Gestion", cell: (r) => r.actualisable ? <StatusBadge label="Manuelle" tone="blue" /> : <StatusBadge label="Automatique" tone="gray" /> },
    { key: "prix", header: "Prix", align: "right", cell: (r) => r.prix_33cl ? xof(r.prix_33cl) + " / 33cl" : r.prix_1l ? xof(r.prix_1l) + " / 1L" : "—" },
  ],
  // À la création, seuls les types non gérés automatiquement sont proposés
  // (orange_dispo, jus_33cl et jus_1l sont alimentés par l'application).
  createFields: [
    { name: "type_art", label: "Type d'article", type: "select", optionsFrom: "types_article_creables", required: true, colSpan: 2 },
    { name: "seuil_alerte", label: "Seuil d'alerte", type: "number", required: true, colSpan: 2, hint: "Une alerte s'affiche dès que le stock descend à ce niveau." },
  ],
  fields: [
    { name: "seuil_alerte", label: "Seuil d'alerte", type: "number", required: true, colSpan: 2 },
    { name: "prix_33cl", label: "Prix 33cl (XOF)", type: "number", hint: "Article Jus 33cl uniquement." },
    { name: "prix_1l", label: "Prix 1L (XOF)", type: "number", hint: "Article Jus 1L uniquement." },
  ],
  actions: [
    {
      key: "actualiser",
      label: "Actualiser le stock",
      icon: PlusCircle,
      // Les jus et les oranges disponibles sont recalculés par l'application.
      available: (r) => r.actualisable,
      action: "actualiser",
      title: (r) => `Actualiser le stock : ${r.type_art_display}`,
      description: "La quantité saisie s'ajoute au stock existant.",
      successMessage: "Stock actualisé",
      fields: [
        { name: "qte_ajout", label: "Quantité à ajouter", type: "number", required: true, colSpan: 2, hint: "Quantité reçue à ajouter au stock actuel." },
      ],
      toApi: buildToApi({ numbers: ["qte_ajout"] }),
    },
  ],
};

// ---------- Réceptions ----------
type Reception = {
  id: number;
  num_recp: string;
  date_recp: string;
  cueillette: number | null;
  producteur_externe: number | null;
  cueillette_nom: string;
  qte_recue: number;
  qte_bon: number;
  lieu_depot: string;
  etat: string;
  cause_perte: string;
};

const etatTone = (e: string): Tone => (e === "EXCELLENT" ? "green" : e === "BON" ? "amber" : "red");

export const receptions: Resource<Reception> = {
  key: "receptions",
  title: "Réceptions",
  singular: "Réception",
  newLabel: "Nouvelle réception",
  description: "Réception des oranges après cueillette au dépôt.",
  icon: PackageOpen,
  endpoint: "receptions",
  fromApi: (o) => ({
    id: o.id as number,
    num_recp: str(o, "num_recp"),
    date_recp: str(o, "date_recp"),
    cueillette: (o.cueillette as number) ?? null,
    producteur_externe: (o.producteur_externe as number) ?? null,
    cueillette_nom: str(o, "cueillette_display"),
    qte_recue: nb(o, "qte_recue"),
    qte_bon: nb(o, "qte_bon"),
    lieu_depot: str(o, "lieu_depot"),
    etat: str(o, "etat_qualite"),
    cause_perte: str(o, "cause_perte"),
  }),
  toApi: buildToApi({ numbers: ["cueillette", "producteur_externe", "qte_recue", "qte_bon"] }),
  searchable: (r) => `${r.num_recp} ${r.cueillette_nom} ${r.lieu_depot}`,
  columns: [
    { key: "num", header: "N° réception", cell: (r) => <span className="font-mono text-xs font-medium">{r.num_recp}</span> },
    { key: "date", header: "Date", cell: (r) => frDate(r.date_recp) },
    { key: "cueil", header: "Cueillette", cell: (r) => r.cueillette_nom },
    { key: "recue", header: "Reçue", align: "right", cell: (r) => num(r.qte_recue, "kg") },
    { key: "bon", header: "Bonne", align: "right", cell: (r) => num(r.qte_bon, "kg") },
    { key: "etat", header: "État", cell: (r) => <StatusBadge label={r.etat} tone={etatTone(r.etat)} /> },
  ],
  stats: (rows) => [
    { label: "Réceptions", value: rows.length },
    { label: "Total reçu", value: `${num(rows.reduce((s, r) => s + r.qte_recue, 0))} kg` },
    { label: "Dont bonnes", value: `${num(rows.reduce((s, r) => s + r.qte_bon, 0))} kg` },
  ],
  fields: [
    // Deux origines possibles, exclusives l'une de l'autre :
    // — une cueillette, pour un producteur interne (avec son quota restant) ;
    // — un producteur externe, qui livre directement sans cueillette.
    { name: "cueillette", label: "Cueillette (producteur interne)", type: "select", optionsFrom: "cueillettes_disponibles", colSpan: 2, hint: "Seules les cueillettes non entièrement réceptionnées sont proposées." },
    { name: "producteur_externe", label: "ou Producteur externe", type: "select", optionsFrom: "producteurs_externes", colSpan: 2, hint: "Livraison directe : renseignez ce champ à la place de la cueillette." },
    { name: "date_recp", label: "Date de réception", type: "date", required: true },
    { name: "lieu_depot", label: "Lieu de dépôt", type: "text", required: true },
    { name: "qte_recue", label: "Quantité reçue (kg)", type: "number", required: true, hint: "Ne peut pas dépasser le restant de la cueillette." },
    { name: "qte_bon", label: "Quantité bonne (kg)", type: "number", required: true },
    { name: "cause_perte", label: "Cause de perte", type: "textarea" },
  ],
};

// ---------- Productions ----------
type Prod = {
  id: number;
  numero_of: string;
  date_of: string;
  recette: string;
  volume_final_l: number;
  test_qualite: string | null;
  statut: string;
};

// Paramètres relevés en fin de fabrication. Partagés entre l'action
// « Compléter » et le formulaire de modification, comme ProductionCompleteForm
// et ProductionModifierForm partagent les mêmes champs côté Django.
const OUI_NON = [
  { value: "true", label: "Oui" },
  { value: "false", label: "Non" },
];

const MESURES_PRODUCTION: Field[] = [
  { name: "lavage_effectue", label: "Lavage effectué", type: "select", required: true, options: OUI_NON },
  { name: "filtration_effectuee", label: "Filtration effectuée", type: "select", required: true, options: OUI_NON },
  { name: "pasteurisation_80c", label: "Pasteurisation 80°C", type: "select", required: true, options: OUI_NON },
  { name: "eau_ajoutee_l", label: "Eau ajoutée (L)", type: "number", placeholder: "ex: 500" },
  { name: "sucre_ajoute_kg", label: "Sucre ajouté (kg)", type: "number", placeholder: "ex: 50" },
  { name: "sorbate_ajoute_g", label: "Sorbate ajouté (g)", type: "number", placeholder: "ex: 100" },
  { name: "ph", label: "pH", type: "number", placeholder: "0 à 10", hint: "Entier entre 0 et 10." },
  { name: "refractometre", label: "Réfractomètre", type: "number", placeholder: "0 à 20", hint: "Entier entre 0 et 20." },
  { name: "volume_final_l", label: "Volume final (L)", type: "number", placeholder: "ex: 1000" },
  { name: "test_qualite", label: "Test qualité", type: "select", options: [{ value: "CONFORME", label: "Conforme" }, { value: "NON_CONFORME", label: "Non conforme" }] },
];

const prodStatut = (s: string): { label: string; tone: Tone } =>
  s === "TERMINEE" ? { label: "Terminée", tone: "green" }
  : s === "ANNULLEE" ? { label: "Annulée", tone: "red" }
  : { label: "En cours", tone: "blue" };

export const productions: Resource<Prod> = {
  key: "productions",
  title: "Productions",
  singular: "Production",
  newLabel: "Programmer une production",
  description: "Ordres de fabrication (OF) du jus d'orange.",
  icon: FlaskConical,
  endpoint: "productions",
  fromApi: (o) => ({
    id: o.id as number,
    numero_of: str(o, "numero_of"),
    date_of: str(o, "date_of"),
    recette: str(o, "recette"),
    volume_final_l: nb(o, "volume_final_l"),
    test_qualite: (o.test_qualite as string) || null,
    statut: str(o, "statut_production"),
  }),
  toApi: buildToApi({
    numbers: ["eau_ajoutee_l", "sucre_ajoute_kg", "ph", "refractometre", "volume_final_l"],
    rename: { statut: "statut_production" },
  }),
  searchable: (r) => `${r.numero_of} ${r.recette}`,
  stats: (rows) => [
    { label: "Productions", value: rows.length },
    { label: "En cours", value: rows.filter((r) => r.statut === "EN_COURS").length },
    { label: "Terminées", value: rows.filter((r) => r.statut === "TERMINEE").length },
    { label: "Volume total", value: `${num(rows.reduce((s, r) => s + r.volume_final_l, 0))} L` },
  ],
  columns: [
    { key: "of", header: "N° OF", cell: (r) => <span className="font-mono text-xs font-medium">{r.numero_of}</span> },
    { key: "date", header: "Date", cell: (r) => frDate(r.date_of) },
    { key: "recette", header: "Recette", cell: (r) => r.recette === "R80_20" ? "80/20" : "75/25" },
    { key: "vol", header: "Volume final", align: "right", cell: (r) => r.volume_final_l ? num(r.volume_final_l, "L") : "—" },
    { key: "test", header: "Test", cell: (r) => r.test_qualite ? <StatusBadge label={r.test_qualite === "CONFORME" ? "Conforme" : "Non conforme"} tone={r.test_qualite === "CONFORME" ? "green" : "red"} /> : <span className="text-muted-foreground">—</span> },
    { key: "statut", header: "Statut", cell: (r) => { const s = prodStatut(r.statut); return <StatusBadge label={s.label} tone={s.tone} />; } },
  ],
  // Étape 1 — programmer : on ne connaît que la date et la recette.
  createFields: [
    { name: "date_of", label: "Date de production", type: "date", required: true },
    { name: "recette", label: "Recette", type: "select", required: true, options: [{ value: "R80_20", label: "80/20" }, { value: "R75_25", label: "75/25" }] },
  ],
  // Modification d'une production existante (tous les champs).
  fields: [
    { name: "date_of", label: "Date de production", type: "date", required: true },
    { name: "recette", label: "Recette", type: "select", required: true, options: [{ value: "R80_20", label: "80/20" }, { value: "R75_25", label: "75/25" }] },
    { name: "statut_production", label: "Statut", type: "select", required: true, options: [
      { value: "EN_COURS", label: "En cours" },
      { value: "TERMINEE", label: "Terminée" },
      { value: "ANNULLEE", label: "Annulée" },
    ] },
    ...MESURES_PRODUCTION,
  ],
  actions: [
    {
      key: "completer",
      label: "Compléter",
      icon: CheckCircle2,
      // Une production déjà terminée ou annulée ne se complète plus.
      available: (r) => r.statut === "EN_COURS",
      action: "completer",
      title: (r) => `Compléter la production ${r.numero_of}`,
      description: "Saisie des paramètres de fabrication. La production passera au statut « Terminée ».",
      successMessage: "Production terminée",
      fields: MESURES_PRODUCTION,
      toApi: buildToApi({
        numbers: ["eau_ajoutee_l", "sucre_ajoute_kg", "sorbate_ajoute_g", "ph", "refractometre", "volume_final_l"],
        booleans: ["lavage_effectue", "filtration_effectuee", "pasteurisation_80c"],
      }),
    },
  ],
};

// ---------- Conditionnements ----------
type Cond = {
  id: number;
  numero_cond: string;
  date_cond: string;
  qte_33cl: number;
  qte_1l: number;
  volume_utilisee: number;
  dlc: string;
};

/**
 * Créer un conditionnement fabrique réellement les bouteilles et décrémente le
 * stock de bouteilles vides : ce n'est pas une simple ligne de tableau.
 * La DLC n'est jamais saisie — on donne un délai en jours OU en mois.
 */
export const conditionnements: Resource<Cond> = {
  key: "conditionnements",
  title: "Conditionnements",
  singular: "Conditionnement",
  description: "Mise en bouteille des productions terminées.",
  icon: Package,
  endpoint: "conditionnements",
  fromApi: (o) => o as unknown as Cond,
  toApi: buildToApi({ numbers: ["production", "qte_33cl", "qte_1l", "volume_utilisee", "nb_jours", "nb_mois"] }),
  searchable: (r) => r.numero_cond,
  stats: (rows) => [
    { label: "Conditionnements", value: rows.length },
    { label: "Bouteilles 33cl", value: num(rows.reduce((s, r) => s + r.qte_33cl, 0)) },
    { label: "Bouteilles 1L", value: num(rows.reduce((s, r) => s + r.qte_1l, 0)) },
    { label: "Volume utilisé", value: `${num(rows.reduce((s, r) => s + r.volume_utilisee, 0))} L` },
  ],
  columns: [
    { key: "num", header: "N° cond.", cell: (r) => <span className="font-mono text-xs font-medium">{r.numero_cond}</span> },
    { key: "date", header: "Date", cell: (r) => frDate(r.date_cond) },
    { key: "q33", header: "33cl", align: "right", cell: (r) => num(r.qte_33cl) },
    { key: "q1l", header: "1L", align: "right", cell: (r) => num(r.qte_1l) },
    { key: "vol", header: "Volume", align: "right", cell: (r) => num(r.volume_utilisee, "L") },
    { key: "dlc", header: "DLC", cell: (r) => frDate(r.dlc) },
  ],
  fields: [
    { name: "date_cond", label: "Date de conditionnement", type: "date", required: true },
    // Seules les productions terminées et pas encore conditionnées apparaissent.
    { name: "production", label: "Production (OF)", type: "select", optionsFrom: "productions_disponibles", required: true, hint: "Productions terminées non encore conditionnées." },
    { name: "qte_33cl", label: "Quantité 33cl", type: "number", hint: "Au moins une des deux quantités." },
    { name: "qte_1l", label: "Quantité 1L", type: "number", hint: "Limitée au stock de bouteilles vides." },
    { name: "volume_utilisee", label: "Volume utilisé (L)", type: "number", required: true },
    // La DLC est calculée par le serveur à partir de l'un de ces deux délais.
    { name: "nb_jours", label: "DLC : nombre de jours", type: "number", placeholder: "ex: 90", hint: "Jours après la date de conditionnement." },
    { name: "nb_mois", label: "DLC : nombre de mois", type: "number", placeholder: "ex: 6", hint: "À renseigner à la place des jours." },
    { name: "observation", label: "Observation", type: "textarea", required: true },
  ],
};

// ---------- Bouteilles ----------
type Bouteille = {
  id: number;
  codebar: string;
  format: string;
  dlc: string;
  statut: string;
  date_creation: string;
};

const boutStatut = (s: string): { label: string; tone: Tone } =>
  s === "DISPO" ? { label: "Disponible", tone: "green" }
  : s === "VENDUE" ? { label: "Vendue", tone: "blue" }
  : s === "PERIMEE" ? { label: "Périmée", tone: "amber" }
  : { label: "Rebut", tone: "red" };

/**
 * Une bouteille naît toujours d'un conditionnement : pas de création directe,
 * exactement comme dans l'interface Django (aucune vue « ajouter_bouteille »).
 */
export const bouteilles: Resource<Bouteille> = {
  key: "bouteilles",
  title: "Bouteilles",
  singular: "Bouteille",
  description: "Unités physiques issues des conditionnements. Créées par les conditionnements.",
  icon: Wine,
  endpoint: "bouteilles",
  canCreate: false,
  stats: (rows) => [
    { label: "Total", value: rows.length },
    { label: "Disponibles", value: rows.filter((r) => r.statut === "DISPO").length },
    { label: "Vendues", value: rows.filter((r) => r.statut === "VENDUE").length },
  ],
  fromApi: (o) => ({
    id: o.id as number,
    codebar: str(o, "codebar"),
    format: str(o, "format_display"),
    dlc: str(o, "dlc"),
    statut: str(o, "statut_stock"),
    date_creation: str(o, "date_creation"),
  }),
  toApi: buildToApi({ rename: { statut: "statut_stock" } }),
  searchable: (r) => `${r.codebar} ${r.format}`,
  columns: [
    { key: "cb", header: "Code-barres", cell: (r) => <span className="font-mono text-xs">{r.codebar || "—"}</span> },
    { key: "fmt", header: "Format", cell: (r) => <span className="font-medium">{r.format}</span> },
    { key: "dlc", header: "DLC", cell: (r) => frDate(r.dlc) },
    { key: "statut", header: "Statut", cell: (r) => { const s = boutStatut(r.statut); return <StatusBadge label={s.label} tone={s.tone} />; } },
    { key: "cree", header: "Créée le", cell: (r) => frDate(r.date_creation) },
  ],
  fields: [
    { name: "codebar", label: "Code-barres", type: "text", colSpan: 2 },
    { name: "dlc", label: "DLC", type: "date", required: true },
    { name: "statut", label: "Statut stock", type: "select", required: true, options: [
      { value: "DISPO", label: "Disponible" },
      { value: "VENDUE", label: "Vendue" },
      { value: "PERIMEE", label: "Périmée" },
      { value: "REBUT", label: "Rebut" },
    ] },
  ],
};

// ---------- Inventaires ----------
type Inventaire = {
  id: number;
  date_inv: string;
  article: number | null;
  article_nom: string;
  qte_systeme: number;
  qte_depot: number;
  ecart: number;
  statut: string;
  qualite: string;
  observation: string;
};

const invStatut = (s: string): { label: string; tone: Tone } =>
  s === "TERMINE" ? { label: "Terminé", tone: "green" }
  : s === "BLOQUE" ? { label: "Bloqué", tone: "red" }
  : { label: "En cours", tone: "blue" };
const qualTone = (q: string): Tone => (q === "BON" ? "green" : q === "MOYEN" ? "amber" : "red");

export const inventaires: Resource<Inventaire> = {
  key: "inventaires",
  title: "Inventaires",
  singular: "Inventaire",
  newLabel: "Nouvel inventaire",
  description: "Comptages physiques et écarts de stock.",
  icon: ClipboardList,
  endpoint: "inventaires",
  fromApi: (o) => ({
    id: o.id as number,
    date_inv: str(o, "date_inv"),
    article: (o.article as number) ?? null,
    article_nom: str(o, "article_display"),
    qte_systeme: nb(o, "qte_systeme"),
    qte_depot: nb(o, "qte_depot"),
    ecart: nb(o, "ecart"),
    statut: str(o, "statut"),
    qualite: str(o, "qualite"),
    observation: str(o, "observation"),
  }),
  toApi: buildToApi({ numbers: ["article", "qte_depot"] }),
  searchable: (r) => `${r.article_nom} ${r.date_inv}`,
  stats: (rows) => [
    { label: "Inventaires", value: rows.length },
    { label: "Terminés", value: rows.filter((r) => r.statut === "TERMINE").length },
    { label: "En cours", value: rows.filter((r) => r.statut === "EN_COURS").length },
    { label: "Avec écart", value: rows.filter((r) => r.ecart !== 0).length },
  ],
  columns: [
    { key: "date", header: "Date", cell: (r) => frDate(r.date_inv) },
    { key: "art", header: "Article", cell: (r) => <span className="font-medium">{r.article_nom}</span> },
    { key: "sys", header: "Système", align: "right", cell: (r) => num(r.qte_systeme) },
    { key: "depot", header: "Dépôt", align: "right", cell: (r) => num(r.qte_depot) },
    { key: "ecart", header: "Écart", align: "right", cell: (r) => <span className={r.ecart < 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-emerald-600 dark:text-emerald-400 font-medium"}>{r.ecart > 0 ? "+" : ""}{num(r.ecart)}</span> },
    { key: "qual", header: "Qualité", cell: (r) => <StatusBadge label={r.qualite} tone={qualTone(r.qualite)} /> },
    { key: "statut", header: "Statut", cell: (r) => { const s = invStatut(r.statut); return <StatusBadge label={s.label} tone={s.tone} />; } },
  ],
  fields: [
    { name: "date_inv", label: "Date d'inventaire", type: "date", required: true },
    { name: "article", label: "Article", type: "select", optionsFrom: "articles", required: true, hideOnEdit: true },
    // La quantité système n'est pas saisie : elle est relevée sur l'article au
    // moment de la création, sinon l'écart mesuré ne prouverait rien.
    { name: "qte_depot", label: "Quantité au dépôt", type: "number", required: true, colSpan: 2, hint: "Résultat du comptage physique. L'écart et la qualité sont calculés automatiquement." },
    { name: "statut", label: "Statut", type: "select", required: true, options: [
      { value: "EN_COURS", label: "En cours" },
      { value: "TERMINE", label: "Terminé" },
      { value: "BLOQUE", label: "Bloqué" },
    ] },
    { name: "user", label: "Responsable", type: "select", optionsFrom: "utilisateurs" },
    { name: "observation", label: "Observation", type: "textarea", hint: "Obligatoire dès que l'inventaire est terminé." },
  ],
  actions: [
    {
      key: "observation",
      label: "Saisir l'observation",
      icon: MessageSquare,
      action: "observation",
      title: (r) => `Observation — inventaire du ${r.date_inv}`,
      description: "Remarques consignées après le comptage.",
      successMessage: "Observation enregistrée",
      initial: (r) => ({ observation: r.observation }),
      fields: [
        { name: "observation", label: "Observation", type: "textarea", required: true, colSpan: 2 },
      ],
    },
  ],
};

export const productionResources = {
  producteurs,
  cueillettes,
  articles,
  receptions,
  productions,
  conditionnements,
  bouteilles,
  inventaires,
};

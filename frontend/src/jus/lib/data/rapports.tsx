import { StatusBadge, type Tone } from "@/jus/composants/app/status-badge";
import { frDate, num, pct, xof } from "@/jus/lib/format";
import type { ColonneRapport, ConfigRapport } from "@/jus/composants/app/rapport-page";

/**
 * Configuration des six rapports.
 *
 * Les clés lues ici (`nb_cueillettes`, `qte_total_kg`…) sont exactement celles
 * renvoyées par les services Django : aucun calcul n'est refait côté client,
 * donc aucun risque de divergence avec les rapports HTML.
 */

const n = (row: Record<string, unknown>, k: string) => Number(row[k] ?? 0);
const t = (row: Record<string, unknown>, k: string) => String(row[k] ?? "");
const nombre = (d: Record<string, unknown>, k: string) => Number(d[k] ?? 0);

const colDate = (key: string, header = "Date"): ColonneRapport => ({
  key,
  header,
  cell: (r) => frDate(t(r, key)),
});

const colTexte = (key: string, header: string): ColonneRapport => ({
  key,
  header,
  cell: (r) => t(r, key) || "—",
});

const colNombre = (key: string, header: string, unite?: string): ColonneRapport => ({
  key,
  header,
  align: "right",
  cell: (r) => num(n(r, key), unite),
});

const colMontant = (key: string, header: string): ColonneRapport => ({
  key,
  header,
  align: "right",
  cell: (r) => xof(n(r, key)),
});

const tauxTone = (v: number): Tone => (v >= 80 ? "green" : v >= 50 ? "amber" : "red");

// ---------- Récolte ----------
export const rapportRecolte: ConfigRapport = {
  module: "recolte",
  titre: "Rapport — Récolte",
  description: "Cueillettes par producteur et par zone, qualité des oranges.",
  listeKey: "cueillettes",
  kpis: (d) => [
    { label: "Cueillettes", value: nombre(d, "nb_cueillettes"), compare: "nb_cueillettes" },
    { label: "Récolte totale", value: `${num(nombre(d, "qte_total_kg"))} kg`, compare: "qte_total_kg" },
    { label: "Dont bonnes", value: `${num(nombre(d, "qte_bon_kg"))} kg`, compare: "qte_bon_kg" },
    { label: "Pertes", value: `${num(nombre(d, "qte_mauvais_kg"))} kg`, compare: "qte_mauvais_kg", sensPositif: false },
    // Le taux de qualité vit désormais dans les indicateurs dérivés, avec son
    // explication : l'afficher deux fois n'ajoutait rien.
    { label: "Producteurs actifs", value: nombre(d, "producteurs_actifs") },
  ],
  agregats: [
    {
      titre: "Par zone",
      key: "par_zone",
      colonnes: [
        colTexte("producteur__zone", "Zone"),
        colNombre("nb", "Cueillettes"),
        colNombre("qte_total", "Total", "kg"),
        colNombre("qte_bon", "Bonnes", "kg"),
      ],
    },
    {
      titre: "Par producteur",
      key: "par_producteur",
      colonnes: [
        colTexte("producteur__nom_complet", "Producteur"),
        colNombre("nb", "Cueillettes"),
        colNombre("qte_total", "Total", "kg"),
        colNombre("qte_bon", "Bonnes", "kg"),
      ],
    },
  ],
  colonnes: [
    colTexte("producteur_display", "Producteur"),
    colDate("date_cueil"),
    colNombre("qte_total", "Total", "kg"),
    colNombre("qte_bon", "Bonnes", "kg"),
    colNombre("qte_mauvais", "Pertes", "kg"),
    {
      key: "taux_qualite",
      header: "Qualité",
      align: "right",
      cell: (r) => <StatusBadge label={pct(n(r, "taux_qualite"))} tone={tauxTone(n(r, "taux_qualite"))} />,
    },
  ],
};

// ---------- Approvisionnement ----------
export const rapportAppro: ConfigRapport = {
  module: "appro",
  titre: "Rapport — Approvisionnement",
  description: "Réceptions d'oranges au dépôt et niveaux de stock.",
  listeKey: "receptions",
  kpis: (d) => [
    { label: "Réceptions", value: nombre(d, "nb_receptions"), compare: "nb_receptions" },
    { label: "Quantité reçue", value: `${num(nombre(d, "qte_recue_kg"))} kg`, compare: "qte_recue_kg" },
    { label: "Dont bonnes", value: `${num(nombre(d, "qte_bon_kg"))} kg`, compare: "qte_bon_kg" },
    { label: "Pertes", value: `${num(nombre(d, "qte_mauvais_kg"))} kg`, compare: "qte_mauvais_kg", sensPositif: false },
    { label: "Articles sous le seuil", value: nombre(d, "nb_articles_alerte") },
  ],
  agregats: [
    {
      titre: "Stock actuel",
      key: "stock_actuel",
      colonnes: [
        colTexte("type_art_display", "Article"),
        colNombre("qte_art", "Stock"),
        colNombre("seuil_alerte", "Seuil"),
        {
          key: "etat",
          header: "État",
          cell: (r) =>
            n(r, "qte_art") <= n(r, "seuil_alerte") ? (
              <StatusBadge label="Sous le seuil" tone="red" />
            ) : (
              <StatusBadge label="OK" tone="green" />
            ),
        },
      ],
    },
  ],
  colonnes: [
    colTexte("num_recp", "N° réception"),
    colDate("date_recp"),
    colTexte("cueillette_display", "Cueillette"),
    colNombre("qte_recue", "Reçue", "kg"),
    colNombre("qte_bon", "Bonnes", "kg"),
    colTexte("lieu_depot", "Dépôt"),
    colTexte("etat_qualite", "État"),
  ],
};

// ---------- Fabrication ----------
export const rapportFabrication: ConfigRapport = {
  module: "fabrication",
  titre: "Rapport — Fabrication",
  description: "Ordres de fabrication et volumes de jus produits.",
  listeKey: "productions",
  kpis: (d) => [
    { label: "Productions", value: nombre(d, "nb_productions"), compare: "nb_productions" },
    { label: "Volume total", value: `${num(nombre(d, "volume_total_l"))} L`, compare: "volume_total_l" },
    { label: "Terminées", value: nombre(d, "nb_terminees"), compare: "nb_terminees" },
  ],
  colonnes: [
    colTexte("numero_of", "N° OF"),
    colDate("date_of"),
    colTexte("recette_display", "Recette"),
    colNombre("volume_final_l", "Volume final", "L"),
    colTexte("statut_display", "Statut"),
    colTexte("test_qualite", "Test qualité"),
  ],
};

// ---------- Emballage ----------
export const rapportEmballage: ConfigRapport = {
  module: "emballage",
  titre: "Rapport — Emballage",
  description: "Conditionnements réalisés et état du parc de bouteilles.",
  listeKey: "conditionnements",
  kpis: (d) => [
    { label: "Conditionnements", value: nombre(d, "nb_conditionnements"), compare: "nb_conditionnements" },
    { label: "Bouteilles 33cl", value: num(nombre(d, "qte_33cl")), compare: "qte_33cl" },
    { label: "Bouteilles 1L", value: num(nombre(d, "qte_1l")), compare: "qte_1l" },
    { label: "Volume utilisé", value: `${num(nombre(d, "volume_l"))} L`, compare: "volume_l" },
    { label: "Disponibles", value: num(nombre(d, "bouteilles_dispo")) },
  ],
  agregats: [
    {
      titre: "Bouteilles par statut",
      key: "bouteilles_par_statut",
      colonnes: [
        colTexte("label", "Statut"),
        colNombre("count", "Nombre"),
      ],
    },
  ],
  colonnes: [
    colTexte("numero_cond", "N° conditionnement"),
    colDate("date_cond"),
    colNombre("qte_33cl", "33cl"),
    colNombre("qte_1l", "1L"),
    colNombre("volume_utilisee", "Volume", "L"),
    colDate("dlc", "DLC"),
  ],
};

// ---------- Entrepôt ----------
export const rapportEntrepot: ConfigRapport = {
  module: "entrepot",
  titre: "Rapport — Entrepôt",
  description: "Inventaires physiques et écarts de stock constatés.",
  listeKey: "inventaires",
  kpis: (d) => [
    { label: "Inventaires", value: nombre(d, "nb_inventaires"), compare: "nb_inventaires" },
    { label: "Bloqués", value: nombre(d, "nb_bloque"), compare: "nb_bloque", sensPositif: false },
    { label: "Qualité mauvaise", value: nombre(d, "nb_qualite_mauvais"), compare: "nb_qualite_mauvais", sensPositif: false },
  ],
  colonnes: [
    colDate("date_inv"),
    colTexte("article_display", "Article"),
    colNombre("qte_systeme", "Système"),
    colNombre("qte_depot", "Dépôt"),
    {
      key: "ecart",
      header: "Écart",
      align: "right",
      cell: (r) => {
        const e = n(r, "ecart");
        if (e === 0) return <span className="text-muted-foreground">0</span>;
        return (
          <span className={e < 0 ? "font-medium text-red-600 dark:text-red-400" : "font-medium text-emerald-600 dark:text-emerald-400"}>
            {e > 0 ? "+" : ""}
            {num(e)}
          </span>
        );
      },
    },
    colTexte("qualite", "Qualité"),
    colTexte("statut_display", "Statut"),
  ],
};

// ---------- Distribution ----------
export const rapportDistribution: ConfigRapport = {
  module: "distribution",
  titre: "Rapport — Distribution",
  description: "Ventes, commandes, facturation et écarts de trésorerie.",
  listeKey: "ventes",
  kpis: (d) => [
    { label: "Ventes", value: nombre(d, "nb_ventes"), compare: "nb_ventes" },
    { label: "Chiffre d'affaires", value: xof(nombre(d, "ca_total")), compare: "ca_total" },
    { label: "Commandes", value: nombre(d, "nb_commandes"), compare: "nb_commandes" },
    { label: "En attente", value: nombre(d, "commandes_en_attente") },
    { label: "Écarts trésorerie", value: nombre(d, "nb_ecarts_tresorerie") },
  ],
  agregats: [
    {
      titre: "Factures",
      key: "factures",
      colonnes: [
        colTexte("num_fact", "N° facture"),
        colTexte("client_nom", "Client"),
        colMontant("montant", "Montant"),
        colMontant("reste_a_payer", "Reste à payer"),
        colTexte("statut_display", "Statut"),
      ],
    },
    {
      titre: "Paiements",
      key: "paiements",
      colonnes: [
        colTexte("num_fact", "Facture"),
        colDate("date_paie"),
        colMontant("montant", "Montant"),
        colTexte("mode_display", "Mode"),
      ],
    },
  ],
  colonnes: [
    { key: "id", header: "N°", cell: (r) => `#${n(r, "id")}` },
    colTexte("client_nom", "Client"),
    colDate("date_vente"),
    colMontant("montant_total", "Montant"),
    colMontant("total_paye", "Payé"),
    colMontant("reste_a_payer", "Reste"),
    colTexte("statut_display", "Paiement"),
  ],
};

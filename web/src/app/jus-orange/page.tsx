"use client";

/**
 * Module Jus d'Orange.
 *
 * Les onglets suivent la chaîne dans son ordre réel — récolte, approvisionnement,
 * fabrication, entrepôt, distribution, prospection — parce que c'est ainsi que
 * le responsable de production la parcourt, et que c'était le découpage de
 * l'application d'origine.
 *
 * Les alertes remontent en tête, hors des onglets : un stock sous seuil, un lot
 * périmé ou un écart de caisse ne peuvent pas attendre qu'on pense à aller les
 * chercher dans le bon onglet.
 */

import { useState } from "react";

import { Coquille } from "@/composants/Coquille";
import { GestionRessource, badgeStatut, type SpecRessource } from "@/composants/ressource";
import {
  Alerte,
  Chargement,
  EnTetePage,
  Grille,
  Onglets,
  Statistique,
} from "@/composants/ui";
import { date, montant, nombre } from "@/lib/format";
import { useRessource } from "@/lib/ressources";
import { useSession } from "@/lib/session";

type Onglet =
  | "recolte"
  | "appro"
  | "fabrication"
  | "entrepot"
  | "distribution"
  | "prospection";

type TableauOrange = {
  oranges_en_stock: number;
  receptions_du_mois: number;
  productions_en_cours: number;
  bouteilles_disponibles: number;
  bouteilles_perimees: number;
  factures_impayees: number;
  ecarts_de_caisse: number;
  articles_sous_alerte: number;
};

export default function PageJusOrange() {
  return (
    <Coquille>
      <Contenu />
    </Coquille>
  );
}

function Contenu() {
  const { profil } = useSession();
  const [onglet, setOnglet] = useState<Onglet>("recolte");

  const roles = profil?.habilitations.orange ?? [];
  const a = (...cherches: string[]) =>
    Boolean(profil?.utilisateur.est_superadmin) ||
    cherches.some((role) => roles.includes(role));

  // Les droits suivent la chaîne : un responsable de production ne touche pas
  // aux factures, un commercial ne modifie pas une recette.
  const production = a("admin", "direction", "responsable_production");
  const commerce = a("admin", "direction", "commercial");
  const finance = a("admin", "direction", "finance");

  const tableau = useRessource<TableauOrange>("/orange/tableau-de-bord");
  const chiffres = tableau.donnees;

  return (
    <>
      <EnTetePage
        titre="Jus d'Orange"
        description="De la cueillette à l'encaissement : récolte, production, distribution."
      />

      {chiffres &&
      (chiffres.articles_sous_alerte ||
        chiffres.bouteilles_perimees ||
        chiffres.ecarts_de_caisse) ? (
        <div className="mb-6 space-y-2">
          {chiffres.articles_sous_alerte ? (
            <Alerte ton="avertissement" titre="Stock sous seuil">
              {chiffres.articles_sous_alerte} article(s) à réapprovisionner.
            </Alerte>
          ) : null}
          {chiffres.bouteilles_perimees ? (
            <Alerte titre="Bouteilles périmées">
              {chiffres.bouteilles_perimees} bouteille(s) encore marquées
              disponibles avec une date limite dépassée : elles doivent être
              retirées du stock.
            </Alerte>
          ) : null}
          {chiffres.ecarts_de_caisse ? (
            <Alerte titre="Écarts de caisse non traités">
              {chiffres.ecarts_de_caisse} encaissement(s) où le montant reçu ne
              correspond pas au montant déclaré.
            </Alerte>
          ) : null}
        </div>
      ) : null}

      <div className="mb-6">
        {tableau.chargement ? (
          <Chargement />
        ) : (
          <Grille colonnes={4}>
            <Statistique
              libelle="Oranges en stock"
              valeur={nombre(chiffres?.oranges_en_stock)}
              unite="kg"
            />
            <Statistique
              libelle="Reçu ce mois-ci"
              valeur={nombre(chiffres?.receptions_du_mois)}
              unite="kg"
            />
            <Statistique
              libelle="Bouteilles disponibles"
              valeur={nombre(chiffres?.bouteilles_disponibles)}
            />
            <Statistique
              libelle="Factures impayées"
              valeur={chiffres?.factures_impayees ?? 0}
              ton={chiffres?.factures_impayees ? "alerte" : "succes"}
            />
          </Grille>
        )}
      </div>

      <Onglets
        onglets={[
          { cle: "recolte" as Onglet, libelle: "Récolte" },
          { cle: "appro" as Onglet, libelle: "Approvisionnement" },
          { cle: "fabrication" as Onglet, libelle: "Fabrication" },
          { cle: "entrepot" as Onglet, libelle: "Entrepôt" },
          { cle: "distribution" as Onglet, libelle: "Distribution" },
          { cle: "prospection" as Onglet, libelle: "Prospection" },
        ]}
        actif={onglet}
        onChange={setOnglet}
      />

      <div className="space-y-6">
        {onglet === "recolte"
          ? [producteurs(production), cueillettes(production)].map((spec) => (
              <GestionRessource key={spec.chemin} spec={spec} />
            ))
          : null}

        {onglet === "appro"
          ? [articles(production), receptions(production)].map((spec) => (
              <GestionRessource key={spec.chemin} spec={spec} />
            ))
          : null}

        {onglet === "fabrication"
          ? [productions(production), conditionnements(production), bouteilles(production)].map(
              (spec) => <GestionRessource key={spec.chemin} spec={spec} />,
            )
          : null}

        {onglet === "entrepot" ? <GestionRessource spec={inventaires(production)} /> : null}

        {onglet === "distribution"
          ? [
              clients(commerce),
              ventes(commerce),
              commandes(commerce),
              factures(finance),
              paiements(finance),
              receptionsPaiement(finance),
            ].map((spec) => <GestionRessource key={spec.chemin} spec={spec} />)
          : null}

        {onglet === "prospection"
          ? [pointsVente(commerce), visites(commerce)].map((spec) => (
              <GestionRessource key={spec.chemin} spec={spec} />
            ))
          : null}
      </div>
    </>
  );
}

// --- Récolte -----------------------------------------------------------------

const producteurs = (ecriture: boolean): SpecRessource => ({
  titre: "Producteurs",
  description:
    "Interne : nos vergers, dont on suit la cueillette. Externe : un fournisseur, dont on ne voit que ce qu'il livre.",
  chemin: "/orange/producteurs",
  recherche: true,
  ecriture,
  vide: "Aucun producteur enregistré.",
  colonnes: [
    { cle: "nom_complet", libelle: "Nom", principale: true },
    { cle: "zone", libelle: "Zone", detail: true },
    { cle: "contact", libelle: "Contact", detail: true },
    { cle: "type_producteur_libelle", libelle: "Type", valeur: true },
    {
      cle: "actif",
      libelle: "État",
      statut: true,
      rendu: (e) => (e.actif ? null : badgeStatut("Inactif")),
    },
  ],
  champs: [
    { nom: "nom_complet", libelle: "Nom complet", requis: true },
    {
      nom: "type_producteur",
      libelle: "Type",
      type: "liste",
      defaut: "INTERNE",
      options: [
        { valeur: "INTERNE", libelle: "Interne (nos vergers)" },
        { valeur: "EXTERNE", libelle: "Externe (fournisseur)" },
      ],
    },
    { nom: "zone", libelle: "Zone" },
    { nom: "contact", libelle: "Contact" },
    { nom: "adresse", libelle: "Adresse", type: "zone", large: true },
    { nom: "actif", libelle: "Producteur actif", type: "booleen", defaut: "true" },
  ],
});

const cueillettes = (ecriture: boolean): SpecRessource => ({
  titre: "Cueillettes",
  description:
    "La part perdue se déduit du total et du bon : c'est sur elle que se juge la qualité d'un producteur.",
  chemin: "/orange/cueillettes",
  ecriture,
  vide: "Aucune cueillette enregistrée.",
  colonnes: [
    { cle: "producteur_affiche", libelle: "Producteur", principale: true },
    {
      cle: "date_cueillette",
      libelle: "Date",
      detail: true,
      rendu: (e) => date(e.date_cueillette as string),
    },
    {
      cle: "quantite_mauvaise",
      libelle: "Perdu",
      detail: true,
      rendu: (e) => `${nombre(e.quantite_mauvaise as number)} kg perdus`,
    },
    {
      cle: "quantite_totale",
      libelle: "Total",
      valeur: true,
      rendu: (e) => `${nombre(e.quantite_totale as number)} kg`,
    },
    {
      cle: "taux_qualite",
      libelle: "Qualité",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          "q",
          { q: (e.taux_qualite as number) >= 80 ? "succes" : "alerte" },
          `${e.taux_qualite} %`,
        ),
    },
  ],
  champs: [
    {
      nom: "producteur",
      libelle: "Producteur",
      type: "liste",
      source: { chemin: "/orange/producteurs", libelle: "nom_complet" },
    },
    { nom: "date_cueillette", libelle: "Date", type: "date", requis: true },
    { nom: "quantite_totale", libelle: "Quantité totale (kg)", type: "nombre", requis: true },
    { nom: "quantite_bonne", libelle: "Quantité bonne (kg)", type: "nombre", requis: true },
    { nom: "observation", libelle: "Observation", type: "zone", large: true },
  ],
});

// --- Approvisionnement -------------------------------------------------------

const articles = (ecriture: boolean): SpecRessource => ({
  titre: "Stock",
  description:
    "Le stock d'oranges et de jus se recalcule depuis les mouvements : il ne se saisit pas.",
  chemin: "/orange/articles",
  ecriture,
  suppression: false,
  vide: "Aucun article paramétré.",
  colonnes: [
    { cle: "type_article_libelle", libelle: "Article", principale: true },
    {
      cle: "seuil_alerte",
      libelle: "Seuil",
      detail: true,
      rendu: (e) => `seuil ${nombre(e.seuil_alerte as number)}`,
    },
    {
      cle: "quantite",
      libelle: "Quantité",
      valeur: true,
      rendu: (e) => nombre(e.quantite as number),
    },
    {
      cle: "sous_alerte",
      libelle: "État",
      statut: true,
      rendu: (e) =>
        e.sous_alerte
          ? badgeStatut("a", { a: "alerte" }, "À réapprovisionner")
          : badgeStatut("s", { s: "succes" }, "Suffisant"),
    },
  ],
  champs: [
    {
      nom: "type_article",
      libelle: "Type d'article",
      type: "liste",
      requis: true,
      options: [
        { valeur: "BOUTEILLE_33", libelle: "Bouteille vide 33 cl" },
        { valeur: "BOUTEILLE_1L", libelle: "Bouteille vide 1 L" },
        { valeur: "PREFORME_33", libelle: "Préforme 33 cl" },
        { valeur: "PREFORME_1L", libelle: "Préforme 1 L" },
        { valeur: "ORANGE", libelle: "Orange disponible" },
        { valeur: "JUS_33", libelle: "Jus 33 cl" },
        { valeur: "JUS_1L", libelle: "Jus 1 L" },
      ],
    },
    { nom: "seuil_alerte", libelle: "Seuil d'alerte", type: "nombre" },
    { nom: "prix_33cl", libelle: "Prix 33 cl (XOF)", type: "nombre" },
    { nom: "prix_1l", libelle: "Prix 1 L (XOF)", type: "nombre" },
  ],
});

const receptions = (ecriture: boolean): SpecRessource => ({
  titre: "Réceptions",
  description:
    "Une réception vient d'une cueillette ou d'un producteur externe — jamais des deux.",
  chemin: "/orange/receptions",
  ecriture,
  vide: "Aucune réception enregistrée.",
  colonnes: [
    { cle: "numero", libelle: "Numéro", principale: true },
    { cle: "origine", libelle: "Origine", detail: true },
    {
      cle: "date_reception",
      libelle: "Date",
      detail: true,
      rendu: (e) => date(e.date_reception as string),
    },
    {
      cle: "quantite_bonne",
      libelle: "Retenu",
      valeur: true,
      rendu: (e) => `${nombre(e.quantite_bonne as number)} kg`,
    },
    {
      cle: "etat_qualite",
      libelle: "Qualité",
      statut: true,
      rendu: (e) =>
        badgeStatut(e.etat_qualite, {
          EXCELLENT: "succes",
          BON: "alerte",
          MAUVAIS: "danger",
        }),
    },
  ],
  champs: [
    {
      nom: "cueillette",
      libelle: "Cueillette (producteur interne)",
      type: "liste",
      source: { chemin: "/orange/cueillettes", libelle: "producteur_affiche", vide: "Aucune" },
    },
    {
      nom: "producteur_externe",
      libelle: "Ou producteur externe",
      type: "liste",
      source: { chemin: "/orange/producteurs", libelle: "nom_complet", vide: "Aucun" },
      aide: "L'un ou l'autre, pas les deux.",
    },
    { nom: "date_reception", libelle: "Date", type: "date", requis: true },
    { nom: "quantite_recue", libelle: "Quantité reçue (kg)", type: "nombre", requis: true },
    { nom: "quantite_bonne", libelle: "Quantité bonne (kg)", type: "nombre", requis: true },
    { nom: "lieu_depot", libelle: "Lieu de dépôt" },
    { nom: "cause_perte", libelle: "Cause de la perte", type: "zone", large: true },
  ],
});

// --- Fabrication -------------------------------------------------------------

const productions = (ecriture: boolean): SpecRessource => ({
  titre: "Ordres de fabrication",
  description:
    "Une production ne se termine pas sans ses trois contrôles sanitaires : lavage, filtration, pasteurisation.",
  chemin: "/orange/productions",
  recherche: true,
  ecriture,
  vide: "Aucune production enregistrée.",
  colonnes: [
    { cle: "numero", libelle: "Numéro", principale: true },
    { cle: "recette_libelle", libelle: "Recette", detail: true },
    {
      cle: "date_production",
      libelle: "Date",
      detail: true,
      rendu: (e) => date(e.date_production as string),
    },
    {
      cle: "volume_final_l",
      libelle: "Volume",
      valeur: true,
      rendu: (e) => `${nombre(e.volume_final_l as number)} L`,
    },
    {
      cle: "controles_complets",
      libelle: "Contrôles",
      statut: true,
      rendu: (e) =>
        e.controles_complets
          ? badgeStatut("c", { c: "succes" }, "Contrôles faits")
          : badgeStatut("i", { i: "alerte" }, "Contrôles incomplets"),
    },
  ],
  champs: [
    { nom: "date_production", libelle: "Date", type: "date", requis: true },
    {
      nom: "recette",
      libelle: "Recette",
      type: "liste",
      requis: true,
      options: [
        { valeur: "R80_20", libelle: "80/20" },
        { valeur: "R75_25", libelle: "75/25" },
      ],
    },
    { nom: "lavage_effectue", libelle: "Lavage effectué", type: "booleen" },
    { nom: "filtration_effectuee", libelle: "Filtration effectuée", type: "booleen" },
    { nom: "pasteurisation_80c", libelle: "Pasteurisation 80 °C", type: "booleen" },
    { nom: "eau_ajoutee_l", libelle: "Eau ajoutée (L)", type: "nombre" },
    { nom: "sucre_ajoute_kg", libelle: "Sucre ajouté (kg)", type: "nombre" },
    { nom: "sorbate_ajoute_g", libelle: "Sorbate ajouté (g)", type: "nombre" },
    { nom: "ph", libelle: "pH (0 à 10)", type: "nombre" },
    { nom: "refractometre", libelle: "Réfractomètre (0 à 20)", type: "nombre" },
    { nom: "volume_final_l", libelle: "Volume final (L)", type: "nombre" },
    {
      nom: "test_qualite",
      libelle: "Test qualité",
      type: "liste",
      options: [
        { valeur: "", libelle: "Non réalisé" },
        { valeur: "CONFORME", libelle: "Conforme" },
        { valeur: "NON_CONFORME", libelle: "Non conforme" },
      ],
    },
    {
      nom: "statut",
      libelle: "Statut",
      type: "liste",
      defaut: "EN_COURS",
      options: [
        { valeur: "EN_COURS", libelle: "En cours" },
        { valeur: "TERMINEE", libelle: "Terminée" },
        { valeur: "ANNULEE", libelle: "Annulée" },
      ],
    },
  ],
});

const conditionnements = (ecriture: boolean): SpecRessource => ({
  titre: "Conditionnements",
  description:
    "La mise en bouteille crée une ligne par bouteille : c'est la maille du rappel de lot.",
  chemin: "/orange/conditionnements",
  ecriture,
  vide: "Aucun conditionnement enregistré.",
  colonnes: [
    { cle: "numero", libelle: "Numéro", principale: true },
    { cle: "production_numero", libelle: "Production", detail: true },
    {
      cle: "date_conditionnement",
      libelle: "Date",
      detail: true,
      rendu: (e) => date(e.date_conditionnement as string),
    },
    {
      cle: "bouteilles_produites",
      libelle: "Bouteilles",
      valeur: true,
      rendu: (e) =>
        `${e.quantite_33cl} × 33 cl + ${e.quantite_1l} × 1 L = ${e.bouteilles_produites}`,
    },
  ],
  champs: [
    { nom: "date_conditionnement", libelle: "Date", type: "date", requis: true },
    {
      nom: "production",
      libelle: "Production",
      type: "liste",
      source: { chemin: "/orange/productions", libelle: "numero", vide: "Aucune" },
    },
    { nom: "quantite_33cl", libelle: "Bouteilles 33 cl", type: "nombre", defaut: "0" },
    { nom: "quantite_1l", libelle: "Bouteilles 1 L", type: "nombre", defaut: "0" },
  ],
});

const bouteilles = (ecriture: boolean): SpecRessource => ({
  titre: "Bouteilles",
  description: "Chaque bouteille est tracée de la production à la vente.",
  chemin: "/orange/bouteilles",
  parametres: "taille=50",
  recherche: true,
  ecriture,
  vide: "Aucune bouteille produite.",
  colonnes: [
    {
      cle: "code_barre",
      libelle: "Bouteille",
      principale: true,
      rendu: (e) => `${e.code_barre || `#${e.id}`} — ${e.format_affiche}`,
    },
    {
      cle: "date_limite",
      libelle: "DLC",
      detail: true,
      rendu: (e) => `DLC ${date(e.date_limite as string)}`,
    },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(e.statut, {
          DISPONIBLE: "succes",
          VENDUE: "info",
          PERIMEE: "danger",
          REBUT: "neutre",
        }),
    },
  ],
  champs: [
    { nom: "code_barre", libelle: "Code-barres" },
    {
      nom: "statut",
      libelle: "Statut",
      type: "liste",
      defaut: "DISPONIBLE",
      options: [
        { valeur: "DISPONIBLE", libelle: "Disponible" },
        { valeur: "VENDUE", libelle: "Vendue" },
        { valeur: "PERIMEE", libelle: "Périmée" },
        { valeur: "REBUT", libelle: "Rebut" },
      ],
    },
  ],
});

// --- Entrepôt ----------------------------------------------------------------

const inventaires = (ecriture: boolean): SpecRessource => ({
  titre: "Inventaires",
  description:
    "L'écart et sa gravité se calculent : cinq kilos sur une tonne n'ont pas le sens de cinq kilos sur dix.",
  chemin: "/orange/inventaires",
  ecriture,
  vide: "Aucun inventaire enregistré.",
  colonnes: [
    { cle: "article_libelle", libelle: "Article", principale: true },
    {
      cle: "date_inventaire",
      libelle: "Date",
      detail: true,
      rendu: (e) => date(e.date_inventaire as string),
    },
    {
      cle: "quantite_systeme",
      libelle: "Comptage",
      detail: true,
      rendu: (e) =>
        `système ${nombre(e.quantite_systeme as number)} · dépôt ${nombre(e.quantite_depot as number)}`,
    },
    {
      cle: "ecart",
      libelle: "Écart",
      valeur: true,
      rendu: (e) => nombre(e.ecart as number),
    },
    {
      cle: "qualite",
      libelle: "Qualité",
      statut: true,
      rendu: (e) =>
        badgeStatut(e.qualite, { BON: "succes", MOYEN: "alerte", MAUVAIS: "danger" }),
    },
  ],
  champs: [
    {
      nom: "article",
      libelle: "Article",
      type: "liste",
      requis: true,
      source: { chemin: "/orange/articles", libelle: "type_article_libelle" },
    },
    { nom: "date_inventaire", libelle: "Date", type: "date", requis: true },
    { nom: "quantite_systeme", libelle: "Quantité en système", type: "nombre" },
    { nom: "quantite_depot", libelle: "Quantité comptée", type: "nombre" },
    {
      nom: "statut",
      libelle: "Statut",
      type: "liste",
      defaut: "EN_COURS",
      options: [
        { valeur: "EN_COURS", libelle: "En cours" },
        { valeur: "TERMINE", libelle: "Terminé" },
        { valeur: "BLOQUE", libelle: "Bloqué" },
      ],
    },
    { nom: "observation", libelle: "Observation", type: "zone", large: true },
  ],
});

// --- Distribution ------------------------------------------------------------

const clients = (ecriture: boolean): SpecRessource => ({
  titre: "Clients",
  description: "Les acheteurs de jus.",
  chemin: "/orange/clients",
  recherche: true,
  ecriture,
  vide: "Aucun client enregistré.",
  colonnes: [
    { cle: "nom_complet", libelle: "Nom", principale: true },
    { cle: "telephone", libelle: "Téléphone", detail: true },
    { cle: "email", libelle: "Adresse", detail: true },
    {
      cle: "actif",
      libelle: "État",
      statut: true,
      rendu: (e) => (e.actif ? null : badgeStatut("Inactif")),
    },
  ],
  champs: [
    { nom: "nom_complet", libelle: "Nom", requis: true },
    { nom: "telephone", libelle: "Téléphone" },
    { nom: "email", libelle: "Adresse e-mail", type: "courriel" },
    { nom: "adresse", libelle: "Adresse", type: "zone", large: true },
    { nom: "actif", libelle: "Client actif", type: "booleen", defaut: "true" },
  ],
});

const ventes = (ecriture: boolean): SpecRessource => ({
  titre: "Ventes",
  chemin: "/orange/ventes",
  ecriture,
  vide: "Aucune vente enregistrée.",
  colonnes: [
    { cle: "client_nom", libelle: "Client", principale: true },
    {
      cle: "date_vente",
      libelle: "Date",
      detail: true,
      rendu: (e) => date(e.date_vente as string),
    },
    { cle: "mode_libelle", libelle: "Mode", detail: true },
    {
      cle: "montant_total",
      libelle: "Montant",
      valeur: true,
      rendu: (e) => montant(e.montant_total as number),
    },
    {
      cle: "reste_a_payer",
      libelle: "Reste",
      statut: true,
      rendu: (e) =>
        (e.reste_a_payer as number) > 0
          ? badgeStatut("r", { r: "alerte" }, `reste ${montant(e.reste_a_payer as number)}`)
          : badgeStatut("s", { s: "succes" }, "Soldée"),
    },
  ],
  champs: [
    {
      nom: "client",
      libelle: "Client",
      type: "liste",
      requis: true,
      source: { chemin: "/orange/clients", libelle: "nom_complet" },
    },
    { nom: "date_vente", libelle: "Date", type: "date", requis: true },
    { nom: "montant_total", libelle: "Montant total", type: "nombre", requis: true },
    {
      nom: "mode",
      libelle: "Mode",
      type: "liste",
      defaut: "ACHAT_VENTE",
      options: [
        { valeur: "ACHAT_VENTE", libelle: "Achat-vente" },
        { valeur: "PARTIELLE", libelle: "Partielle" },
        { valeur: "DEPOT_VENTE", libelle: "Dépôt-vente" },
      ],
    },
  ],
});

const commandes = (ecriture: boolean): SpecRessource => ({
  titre: "Commandes",
  chemin: "/orange/commandes",
  ecriture,
  vide: "Aucune commande enregistrée.",
  colonnes: [
    { cle: "client_nom", libelle: "Client", principale: true },
    {
      cle: "date_commande",
      libelle: "Date",
      detail: true,
      rendu: (e) => date(e.date_commande as string),
    },
    {
      cle: "quantite_33cl",
      libelle: "Quantités",
      valeur: true,
      rendu: (e) => `${e.quantite_33cl} × 33 cl · ${e.quantite_1l} × 1 L`,
    },
  ],
  champs: [
    {
      nom: "client",
      libelle: "Client",
      type: "liste",
      requis: true,
      source: { chemin: "/orange/clients", libelle: "nom_complet" },
    },
    {
      nom: "vente",
      libelle: "Vente rattachée",
      type: "liste",
      source: { chemin: "/orange/ventes", libelle: "client_nom", vide: "Aucune" },
    },
    { nom: "date_commande", libelle: "Date", type: "date", requis: true },
    { nom: "quantite_33cl", libelle: "Quantité 33 cl", type: "nombre", defaut: "0" },
    { nom: "quantite_1l", libelle: "Quantité 1 L", type: "nombre", defaut: "0" },
    { nom: "observation", libelle: "Observation", type: "zone", large: true },
  ],
});

const factures = (ecriture: boolean): SpecRessource => ({
  titre: "Factures",
  description: "Le statut suit les paiements : il ne se déclare pas.",
  chemin: "/orange/factures",
  recherche: true,
  ecriture,
  vide: "Aucune facture émise.",
  colonnes: [
    { cle: "numero", libelle: "Numéro", principale: true },
    {
      cle: "date_echeance",
      libelle: "Échéance",
      detail: true,
      rendu: (e) => `échéance ${date(e.date_echeance as string)}`,
    },
    {
      cle: "montant_regle",
      libelle: "Réglé",
      detail: true,
      rendu: (e) =>
        `réglé ${montant(e.montant_regle as number)} sur ${montant(e.montant as number)}`,
    },
    {
      cle: "reste_a_payer",
      libelle: "Reste",
      valeur: true,
      rendu: (e) => montant(e.reste_a_payer as number),
    },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.statut,
          { SOLDEE: "succes", PARTIELLE: "alerte", EMISE: "info", ANNULEE: "neutre" },
          e.statut_libelle as string,
        ),
    },
  ],
  champs: [
    {
      nom: "vente",
      libelle: "Vente",
      type: "liste",
      requis: true,
      source: { chemin: "/orange/ventes", libelle: "client_nom" },
    },
    { nom: "date_facture", libelle: "Date", type: "date", requis: true },
    { nom: "montant", libelle: "Montant", type: "nombre", requis: true },
    { nom: "date_echeance", libelle: "Échéance", type: "date", requis: true },
  ],
});

const paiements = (ecriture: boolean): SpecRessource => ({
  titre: "Paiements",
  chemin: "/orange/paiements",
  ecriture,
  vide: "Aucun paiement enregistré.",
  colonnes: [
    { cle: "facture_numero", libelle: "Facture", principale: true },
    {
      cle: "date_paiement",
      libelle: "Date",
      detail: true,
      rendu: (e) => date(e.date_paiement as string),
    },
    { cle: "mode_libelle", libelle: "Mode", detail: true },
    { cle: "reference", libelle: "Référence", detail: true },
    {
      cle: "montant",
      libelle: "Montant",
      valeur: true,
      rendu: (e) => montant(e.montant as number),
    },
  ],
  champs: [
    {
      nom: "facture",
      libelle: "Facture",
      type: "liste",
      requis: true,
      source: { chemin: "/orange/factures", libelle: "numero" },
    },
    { nom: "date_paiement", libelle: "Date", type: "date", requis: true },
    { nom: "montant", libelle: "Montant", type: "nombre", requis: true },
    {
      nom: "mode",
      libelle: "Mode",
      type: "liste",
      requis: true,
      defaut: "ESPECE",
      options: [
        { valeur: "ESPECE", libelle: "Espèce" },
        { valeur: "CHEQUE", libelle: "Chèque" },
        { valeur: "VIREMENT", libelle: "Virement" },
        { valeur: "MOBILE", libelle: "Mobile money" },
      ],
    },
    { nom: "reference", libelle: "Référence" },
  ],
});

const receptionsPaiement = (ecriture: boolean): SpecRessource => ({
  titre: "Réceptions de paiement",
  description:
    "Le commercial déclare, la trésorerie constate. L'écart entre les deux est le point de contrôle du domaine.",
  chemin: "/orange/receptions-paiement",
  ecriture,
  vide: "Aucun encaissement constaté.",
  colonnes: [
    {
      cle: "montant_declare",
      libelle: "Déclaré",
      principale: true,
      rendu: (e) =>
        `Déclaré ${montant(e.montant_declare as number)} · reçu ${montant(e.montant_recu as number)}`,
    },
    {
      cle: "date_reception",
      libelle: "Date",
      detail: true,
      rendu: (e) => date(e.date_reception as string),
    },
    { cle: "observation", libelle: "Observation", detail: true },
    {
      cle: "ecart",
      libelle: "Écart",
      valeur: true,
      rendu: (e) => montant(e.ecart as number),
    },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.statut,
          { CONFORME: "succes", ECART_POSITIF: "alerte", ECART_NEGATIF: "danger" },
          e.statut_libelle as string,
        ),
    },
  ],
  champs: [
    {
      nom: "paiement",
      libelle: "Paiement",
      type: "liste",
      requis: true,
      source: { chemin: "/orange/paiements", libelle: "facture_numero" },
    },
    { nom: "montant_recu", libelle: "Montant reçu", type: "nombre", requis: true },
    { nom: "date_reception", libelle: "Date", type: "date", requis: true },
    { nom: "ecart_traite", libelle: "Écart traité", type: "booleen" },
    { nom: "observation", libelle: "Observation", type: "zone", large: true },
  ],
});

// --- Prospection -------------------------------------------------------------

const pointsVente = (ecriture: boolean): SpecRessource => ({
  titre: "Points de vente",
  chemin: "/orange/points-vente",
  recherche: true,
  ecriture,
  vide: "Aucun point de vente prospecté.",
  colonnes: [
    { cle: "nom", libelle: "Nom", principale: true },
    { cle: "type_point_libelle", libelle: "Type", detail: true },
    { cle: "zone", libelle: "Zone", detail: true },
    { cle: "contact", libelle: "Contact", detail: true },
    {
      cle: "derniere_visite",
      libelle: "Dernière visite",
      valeur: true,
      rendu: (e) => (e.derniere_visite ? date(e.derniere_visite as string) : "jamais"),
    },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.statut,
          {
            CLIENT: "succes",
            PARTENAIRE: "succes",
            INTERESSE: "info",
            A_RELANCER: "alerte",
            REFUS: "danger",
          },
          e.statut_libelle as string,
        ),
    },
  ],
  champs: [
    { nom: "nom", libelle: "Nom", requis: true },
    {
      nom: "type_point",
      libelle: "Type",
      type: "liste",
      defaut: "BOUTIQUE",
      options: [
        { valeur: "BOUTIQUE", libelle: "Boutique" },
        { valeur: "SUPERMARCHE", libelle: "Supermarché" },
        { valeur: "EPICERIE", libelle: "Épicerie / alimentation" },
        { valeur: "RESTAURANT", libelle: "Restaurant / maquis" },
        { valeur: "HOTEL", libelle: "Hôtel" },
        { valeur: "KIOSQUE", libelle: "Kiosque" },
        { valeur: "AUTRE", libelle: "Autre" },
      ],
    },
    {
      nom: "statut",
      libelle: "Statut",
      type: "liste",
      defaut: "PROSPECTE",
      options: [
        { valeur: "PROSPECTE", libelle: "Prospecté" },
        { valeur: "INTERESSE", libelle: "Intéressé" },
        { valeur: "CLIENT", libelle: "Client" },
        { valeur: "PARTENAIRE", libelle: "Point de vente partenaire" },
        { valeur: "A_RELANCER", libelle: "À relancer" },
        { valeur: "REFUS", libelle: "Non intéressé" },
      ],
    },
    { nom: "zone", libelle: "Zone" },
    { nom: "contact", libelle: "Contact" },
    { nom: "telephone", libelle: "Téléphone" },
    { nom: "latitude", libelle: "Latitude", type: "nombre" },
    { nom: "longitude", libelle: "Longitude", type: "nombre" },
    { nom: "adresse", libelle: "Adresse", type: "zone", large: true },
  ],
});

const visites = (ecriture: boolean): SpecRessource => ({
  titre: "Visites",
  description:
    "Une visite qui change le statut du prospect le met à jour : sinon le commercial doit le faire deux fois, et il oublie.",
  chemin: "/orange/visites",
  ecriture,
  vide: "Aucune visite enregistrée.",
  colonnes: [
    { cle: "point_vente_nom", libelle: "Point de vente", principale: true },
    {
      cle: "date_visite",
      libelle: "Date",
      detail: true,
      rendu: (e) => date(e.date_visite as string),
    },
    { cle: "commercial_nom", libelle: "Commercial", detail: true },
    { cle: "compte_rendu", libelle: "Compte rendu", detail: true },
    {
      cle: "prochaine_visite",
      libelle: "Prochaine",
      valeur: true,
      rendu: (e) =>
        e.prochaine_visite ? `revoir le ${date(e.prochaine_visite as string)}` : "",
    },
  ],
  champs: [
    {
      nom: "point_vente",
      libelle: "Point de vente",
      type: "liste",
      requis: true,
      source: { chemin: "/orange/points-vente", libelle: "nom" },
    },
    { nom: "date_visite", libelle: "Date", type: "date", requis: true },
    {
      nom: "statut_apres",
      libelle: "Statut après visite",
      type: "liste",
      options: [
        { valeur: "", libelle: "Inchangé" },
        { valeur: "PROSPECTE", libelle: "Prospecté" },
        { valeur: "INTERESSE", libelle: "Intéressé" },
        { valeur: "CLIENT", libelle: "Client" },
        { valeur: "PARTENAIRE", libelle: "Point de vente partenaire" },
        { valeur: "A_RELANCER", libelle: "À relancer" },
        { valeur: "REFUS", libelle: "Non intéressé" },
      ],
    },
    { nom: "prochaine_visite", libelle: "Prochaine visite", type: "date" },
    { nom: "compte_rendu", libelle: "Compte rendu", type: "zone", large: true },
  ],
});

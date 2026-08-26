/**
 * Les écrans du service financier.
 *
 * Les trois gestes du quotidien — dépense, réquisition, mission — restent
 * écrits à la main dans la page : ils passent par le circuit de validation, et
 * un circuit ne se rend pas dans un tableau. Le reste du domaine, lui, est de
 * l'administration : consultations, bons de commande, caisse, forfaits,
 * référentiels.
 */

import { badgeStatut, type SpecRessource } from "@/composants/ressource";
import { date, montant } from "@/lib/format";

const DEVISES = [
  { valeur: "XOF", libelle: "FCFA" },
  { valeur: "EUR", libelle: "Euro" },
  { valeur: "USD", libelle: "Dollar" },
];

// --- Achats ----------------------------------------------------------------

export const demandesPrix = (ecriture: boolean): SpecRessource => ({
  titre: "Consultations fournisseurs",
  description:
    "Consulter n'engage rien : c'est le bon de commande qui engage. Une consultation ne passe donc par aucun circuit.",
  chemin: "/finance/demandes-prix",
  recherche: true,
  ecriture,
  vide: "Aucune consultation lancée.",
  colonnes: [
    { cle: "numero", libelle: "Numéro", principale: true },
    { cle: "objet", libelle: "Objet", detail: true },
    {
      cle: "date_limite",
      libelle: "Limite",
      detail: true,
      rendu: (e) => (e.date_limite ? `remise avant le ${date(e.date_limite as string)}` : ""),
    },
    {
      cle: "nb_offres",
      libelle: "Offres",
      valeur: true,
      rendu: (e) => `${e.nb_offres} offre(s)`,
    },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.statut,
          {
            OUVERTE: "info",
            EN_ANALYSE: "alerte",
            ATTRIBUEE: "succes",
            INFRUCTUEUSE: "danger",
          },
          e.statut_libelle as string,
        ),
    },
  ],
  champs: [
    { nom: "objet", libelle: "Objet", requis: true, large: true },
    {
      nom: "requisition",
      libelle: "Réquisition d'origine",
      type: "liste",
      source: { chemin: "/finance/requisitions", libelle: "objet", vide: "Aucune" },
    },
    { nom: "date_lancement", libelle: "Lancée le", type: "date", requis: true },
    { nom: "date_limite", libelle: "Remise des offres", type: "date" },
    {
      nom: "critere_attribution",
      libelle: "Critère d'attribution",
      aide: "Prix, délai, qualité technique... ce qui départagera les offres.",
    },
    {
      nom: "statut",
      libelle: "Statut",
      type: "liste",
      defaut: "OUVERTE",
      options: [
        { valeur: "OUVERTE", libelle: "Ouverte" },
        { valeur: "EN_ANALYSE", libelle: "En analyse" },
        { valeur: "ATTRIBUEE", libelle: "Attribuée" },
        { valeur: "INFRUCTUEUSE", libelle: "Infructueuse" },
      ],
    },
    { nom: "description", libelle: "Description", type: "zone", large: true },
  ],
});

export const offres = (ecriture: boolean): SpecRessource => ({
  titre: "Offres reçues",
  description: "Une seule offre retenue par consultation : c'est elle qui devient le bon de commande.",
  chemin: "/finance/offres",
  ecriture,
  vide: "Aucune offre enregistrée.",
  colonnes: [
    { cle: "fournisseur_nom", libelle: "Fournisseur", principale: true },
    {
      cle: "delai_livraison_jours",
      libelle: "Délai",
      detail: true,
      rendu: (e) => `${e.delai_livraison_jours} jour(s)`,
    },
    { cle: "conditions_paiement", libelle: "Paiement", detail: true },
    {
      cle: "montant",
      libelle: "Montant",
      valeur: true,
      rendu: (e) => montant(e.montant as string, e.devise as string),
    },
    {
      cle: "retenue",
      libelle: "Retenue",
      statut: true,
      rendu: (e) => (e.retenue ? badgeStatut("r", { r: "succes" }, "Retenue") : null),
    },
  ],
  champs: [
    {
      nom: "demande_prix",
      libelle: "Consultation",
      type: "liste",
      requis: true,
      source: { chemin: "/finance/demandes-prix", libelle: "objet" },
    },
    {
      nom: "fournisseur",
      libelle: "Fournisseur",
      type: "liste",
      requis: true,
      source: { chemin: "/finance/fournisseurs", libelle: "raison_sociale" },
    },
    { nom: "montant", libelle: "Montant proposé", type: "nombre", requis: true },
    { nom: "devise", libelle: "Devise", type: "liste", defaut: "XOF", options: DEVISES },
    { nom: "delai_livraison_jours", libelle: "Délai (jours)", type: "nombre", defaut: "0" },
    { nom: "conditions_paiement", libelle: "Conditions de paiement" },
    { nom: "note_technique", libelle: "Note technique", type: "nombre" },
    { nom: "retenue", libelle: "Offre retenue", type: "booleen" },
    { nom: "commentaire", libelle: "Commentaire", type: "zone", large: true },
  ],
});

export const bonsCommande = (ecriture: boolean): SpecRessource => ({
  titre: "Bons de commande",
  description: "Le document qui engage GDA. Il passe par le circuit de validation.",
  chemin: "/finance/bons-commande",
  recherche: true,
  ecriture,
  vide: "Aucun bon de commande.",
  colonnes: [
    { cle: "objet", libelle: "Objet", principale: true },
    { cle: "fournisseur_nom", libelle: "Fournisseur", detail: true },
    {
      cle: "date_livraison_prevue",
      libelle: "Livraison",
      detail: true,
      rendu: (e) =>
        e.date_livraison_reelle
          ? `livré le ${date(e.date_livraison_reelle as string)}`
          : e.date_livraison_prevue
            ? `attendue le ${date(e.date_livraison_prevue as string)}`
            : "",
    },
    {
      cle: "montant",
      libelle: "Montant",
      valeur: true,
      rendu: (e) => montant(e.montant as string, e.devise as string),
    },
    { cle: "statut", libelle: "Statut", statut: true },
  ],
  champs: [
    {
      nom: "fournisseur",
      libelle: "Fournisseur",
      type: "liste",
      requis: true,
      source: { chemin: "/finance/fournisseurs", libelle: "raison_sociale" },
    },
    { nom: "objet", libelle: "Objet", requis: true, large: true },
    {
      nom: "requisition",
      libelle: "Réquisition",
      type: "liste",
      source: { chemin: "/finance/requisitions", libelle: "objet", vide: "Aucune" },
    },
    {
      nom: "demande_prix",
      libelle: "Consultation",
      type: "liste",
      source: { chemin: "/finance/demandes-prix", libelle: "objet", vide: "Aucune" },
    },
    { nom: "montant", libelle: "Montant", type: "nombre", requis: true },
    { nom: "devise", libelle: "Devise", type: "liste", defaut: "XOF", options: DEVISES },
    { nom: "date_livraison_prevue", libelle: "Livraison prévue", type: "date" },
    { nom: "date_livraison_reelle", libelle: "Livraison réelle", type: "date" },
    { nom: "conditions", libelle: "Conditions", type: "zone", large: true },
  ],
});

export const prestations = (ecriture: boolean): SpecRessource => ({
  titre: "Prestations",
  description: "Un contrat de service suivi par son taux d'exécution.",
  chemin: "/finance/prestations",
  recherche: true,
  ecriture,
  vide: "Aucune prestation.",
  colonnes: [
    { cle: "objet", libelle: "Objet", principale: true },
    { cle: "prestataire_nom", libelle: "Prestataire", detail: true },
    {
      cle: "date_debut",
      libelle: "Période",
      detail: true,
      rendu: (e) => `${date(e.date_debut as string)} → ${date(e.date_fin as string)}`,
    },
    {
      cle: "montant",
      libelle: "Montant",
      valeur: true,
      rendu: (e) => `${montant(e.montant as string, e.devise as string)} · ${e.taux_execution} %`,
    },
    { cle: "statut", libelle: "Statut", statut: true },
  ],
  champs: [
    {
      nom: "prestataire",
      libelle: "Prestataire",
      type: "liste",
      requis: true,
      source: { chemin: "/finance/fournisseurs", libelle: "raison_sociale" },
    },
    { nom: "objet", libelle: "Objet", requis: true, large: true },
    { nom: "date_debut", libelle: "Début", type: "date", requis: true },
    { nom: "date_fin", libelle: "Fin", type: "date" },
    { nom: "montant", libelle: "Montant", type: "nombre", requis: true },
    { nom: "devise", libelle: "Devise", type: "liste", defaut: "XOF", options: DEVISES },
    { nom: "taux_execution", libelle: "Taux d'exécution (%)", type: "nombre", defaut: "0" },
    { nom: "livrables", libelle: "Livrables", type: "zone", large: true },
    { nom: "description", libelle: "Description", type: "zone", large: true },
  ],
});

// --- Caisse ----------------------------------------------------------------

export const caisses = (ecriture: boolean): SpecRessource => ({
  titre: "Caisses",
  chemin: "/finance/caisses",
  ecriture,
  vide: "Aucune caisse ouverte.",
  colonnes: [
    {
      cle: "libelle",
      libelle: "Caisse",
      principale: true,
      rendu: (e) => `${e.code} — ${e.libelle}`,
    },
    {
      cle: "responsable_nom",
      libelle: "Responsable",
      detail: true,
      rendu: (e) => (e.responsable_nom as string) || "Aucun responsable désigné",
    },
    {
      cle: "solde_actuel",
      libelle: "Solde",
      valeur: true,
      rendu: (e) => montant(e.solde_actuel as string, e.devise as string),
    },
    {
      cle: "sous_alerte",
      libelle: "État",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.sous_alerte ? "a" : "o",
          { a: "alerte", o: "succes" },
          e.sous_alerte ? "À réapprovisionner" : "Approvisionnée",
        ),
    },
  ],
  champs: [
    { nom: "code", libelle: "Code", requis: true },
    { nom: "libelle", libelle: "Libellé", requis: true },
    { nom: "responsable_identifiant", libelle: "Identifiant du responsable" },
    { nom: "responsable_nom", libelle: "Nom du responsable" },
    { nom: "devise", libelle: "Devise", type: "liste", defaut: "XOF", options: DEVISES },
    { nom: "solde_initial", libelle: "Solde initial", type: "nombre", defaut: "0" },
    {
      nom: "plafond_alerte",
      libelle: "Seuil d'alerte",
      type: "nombre",
      defaut: "0",
      aide: "En dessous de ce solde, la caisse est signalée à réapprovisionner.",
    },
    { nom: "actif", libelle: "Caisse ouverte", type: "booleen", defaut: "true" },
  ],
});

export const approvisionnements = (ecriture: boolean): SpecRessource => ({
  titre: "Approvisionnements",
  description: "Ce qui entre en caisse. Le solde s'en déduit, il ne se saisit pas.",
  chemin: "/finance/approvisionnements",
  ecriture,
  vide: "Aucun approvisionnement.",
  colonnes: [
    { cle: "caisse_libelle", libelle: "Caisse", principale: true },
    {
      cle: "date_operation",
      libelle: "Date",
      detail: true,
      rendu: (e) => date(e.date_operation as string),
    },
    { cle: "reference", libelle: "Référence", detail: true },
    {
      cle: "montant",
      libelle: "Montant",
      valeur: true,
      rendu: (e) => montant(e.montant as string),
    },
    { cle: "enregistre_par_nom", libelle: "Par", statut: true },
  ],
  champs: [
    {
      nom: "caisse",
      libelle: "Caisse",
      type: "liste",
      requis: true,
      source: { chemin: "/finance/caisses", libelle: "libelle" },
    },
    { nom: "montant", libelle: "Montant", type: "nombre", requis: true },
    { nom: "date_operation", libelle: "Date", type: "date", requis: true },
    { nom: "reference", libelle: "Référence" },
    { nom: "commentaire", libelle: "Commentaire", type: "zone", large: true },
  ],
});

export const sortiesCaisse = (ecriture: boolean): SpecRessource => ({
  titre: "Sorties de caisse",
  description: "Une sortie ne décaisse qu'une fois validée : c'est la validation qui pose la date de décaissement.",
  chemin: "/finance/sorties-caisse",
  recherche: true,
  ecriture,
  vide: "Aucune sortie de caisse.",
  colonnes: [
    { cle: "motif", libelle: "Motif", principale: true },
    {
      cle: "beneficiaire",
      libelle: "Bénéficiaire",
      detail: true,
      rendu: (e) => `${e.beneficiaire} · ${e.caisse_libelle}`,
    },
    {
      cle: "date_sortie",
      libelle: "Date",
      detail: true,
      rendu: (e) =>
        e.date_decaissement
          ? `décaissée le ${date(e.date_decaissement as string)}`
          : date(e.date_sortie as string),
    },
    {
      cle: "montant",
      libelle: "Montant",
      valeur: true,
      rendu: (e) => montant(e.montant as string, e.devise as string),
    },
    { cle: "statut", libelle: "Statut", statut: true },
  ],
  champs: [
    {
      nom: "caisse",
      libelle: "Caisse",
      type: "liste",
      requis: true,
      source: { chemin: "/finance/caisses", libelle: "libelle" },
    },
    {
      nom: "categorie",
      libelle: "Catégorie",
      type: "liste",
      source: { chemin: "/finance/categories", libelle: "libelle", vide: "Aucune" },
    },
    { nom: "beneficiaire", libelle: "Bénéficiaire", requis: true },
    { nom: "beneficiaire_identifiant", libelle: "Identifiant du bénéficiaire" },
    { nom: "motif", libelle: "Motif", requis: true, large: true },
    { nom: "montant", libelle: "Montant", type: "nombre", requis: true },
    { nom: "devise", libelle: "Devise", type: "liste", defaut: "XOF", options: DEVISES },
    { nom: "date_sortie", libelle: "Date de sortie", type: "date", requis: true },
  ],
});

// --- Communication ---------------------------------------------------------

export const forfaits = (ecriture: boolean): SpecRessource => ({
  titre: "Forfaits de communication",
  chemin: "/finance/forfaits",
  recherche: true,
  ecriture,
  vide: "Aucun forfait attribué.",
  colonnes: [
    { cle: "agent_nom", libelle: "Agent", principale: true },
    {
      cle: "numero_ligne",
      libelle: "Ligne",
      detail: true,
      rendu: (e) => `${e.operateur} · ${e.numero_ligne}`,
    },
    { cle: "agent_departement_nom", libelle: "Département", detail: true },
    {
      cle: "montant_mensuel",
      libelle: "Par mois",
      valeur: true,
      rendu: (e) => montant(e.montant_mensuel as string, e.devise as string),
    },
    {
      cle: "type_forfait",
      libelle: "Type",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.type_forfait,
          { VOIX: "neutre", DATA: "info", MIXTE: "succes" },
          e.type_forfait_libelle as string,
        ),
    },
  ],
  champs: [
    { nom: "agent_identifiant", libelle: "Identifiant de l'agent", requis: true },
    { nom: "agent_nom", libelle: "Nom de l'agent", requis: true },
    { nom: "agent_departement_nom", libelle: "Département" },
    { nom: "operateur", libelle: "Opérateur", requis: true },
    { nom: "numero_ligne", libelle: "Numéro de ligne", requis: true },
    {
      nom: "type_forfait",
      libelle: "Type",
      type: "liste",
      defaut: "MIXTE",
      options: [
        { valeur: "VOIX", libelle: "Voix" },
        { valeur: "DATA", libelle: "Internet / data" },
        { valeur: "MIXTE", libelle: "Voix + data" },
      ],
    },
    { nom: "montant_mensuel", libelle: "Montant mensuel", type: "nombre", requis: true },
    { nom: "devise", libelle: "Devise", type: "liste", defaut: "XOF", options: DEVISES },
    { nom: "date_debut", libelle: "Début", type: "date" },
    { nom: "date_fin", libelle: "Fin", type: "date" },
    { nom: "actif", libelle: "Forfait actif", type: "booleen", defaut: "true" },
  ],
});

export const consommations = (ecriture: boolean): SpecRessource => ({
  titre: "Consommations",
  description: "Le dépassement se calcule par rapport au forfait : il n'est pas saisi.",
  chemin: "/finance/consommations",
  ecriture,
  vide: "Aucune consommation relevée.",
  colonnes: [
    { cle: "mois", libelle: "Mois", principale: true },
    { cle: "commentaire", libelle: "Commentaire", detail: true },
    {
      cle: "montant_consomme",
      libelle: "Consommé",
      valeur: true,
      rendu: (e) => montant(e.montant_consomme as string),
    },
    {
      cle: "depassement",
      libelle: "Dépassement",
      statut: true,
      rendu: (e) =>
        Number(e.depassement) > 0
          ? badgeStatut("d", { d: "danger" }, `+ ${montant(e.depassement as string)}`)
          : badgeStatut("o", { o: "succes" }, "Dans le forfait"),
    },
  ],
  champs: [
    {
      nom: "forfait",
      libelle: "Forfait",
      type: "liste",
      requis: true,
      source: { chemin: "/finance/forfaits", libelle: "agent_nom" },
    },
    {
      nom: "mois",
      libelle: "Mois",
      requis: true,
      aide: "Au format AAAA-MM, par exemple 2026-08.",
    },
    { nom: "montant_consomme", libelle: "Montant consommé", type: "nombre", requis: true },
    { nom: "commentaire", libelle: "Commentaire", type: "zone", large: true },
  ],
});

// --- Référentiels ----------------------------------------------------------

export const fournisseurs = (ecriture: boolean): SpecRessource => ({
  titre: "Fournisseurs",
  chemin: "/finance/fournisseurs",
  recherche: true,
  ecriture,
  vide: "Aucun fournisseur référencé.",
  colonnes: [
    { cle: "raison_sociale", libelle: "Raison sociale", principale: true },
    {
      cle: "contact",
      libelle: "Contact",
      detail: true,
      rendu: (e) => [e.contact, e.telephone].filter(Boolean).join(" · "),
    },
    { cle: "categorie", libelle: "Catégorie", detail: true },
    { cle: "code", libelle: "Code", valeur: true },
    {
      cle: "actif",
      libelle: "État",
      statut: true,
      rendu: (e) =>
        badgeStatut(e.actif ? "a" : "i", { a: "succes", i: "neutre" }, e.actif ? "Actif" : "Inactif"),
    },
  ],
  champs: [
    { nom: "code", libelle: "Code", requis: true },
    { nom: "raison_sociale", libelle: "Raison sociale", requis: true, large: true },
    { nom: "categorie", libelle: "Catégorie" },
    { nom: "contact", libelle: "Contact" },
    { nom: "telephone", libelle: "Téléphone" },
    { nom: "email", libelle: "Courriel", type: "courriel" },
    { nom: "numero_fiscal", libelle: "Numéro fiscal" },
    { nom: "adresse", libelle: "Adresse", type: "zone", large: true },
    { nom: "actif", libelle: "Fournisseur actif", type: "booleen", defaut: "true" },
  ],
});

export const categories = (ecriture: boolean): SpecRessource => ({
  titre: "Catégories de dépense",
  chemin: "/finance/categories",
  ecriture,
  vide: "Aucune catégorie.",
  colonnes: [
    { cle: "libelle", libelle: "Libellé", principale: true },
    { cle: "imputation", libelle: "Imputation comptable", detail: true },
    { cle: "code", libelle: "Code", valeur: true },
    {
      cle: "actif",
      libelle: "État",
      statut: true,
      rendu: (e) =>
        badgeStatut(e.actif ? "a" : "i", { a: "succes", i: "neutre" }, e.actif ? "Active" : "Inactive"),
    },
  ],
  champs: [
    { nom: "code", libelle: "Code", requis: true },
    { nom: "libelle", libelle: "Libellé", requis: true, large: true },
    { nom: "imputation", libelle: "Imputation comptable" },
    { nom: "actif", libelle: "Catégorie active", type: "booleen", defaut: "true" },
  ],
});

export const baremes = (ecriture: boolean): SpecRessource => ({
  titre: "Barèmes de perdiem",
  description:
    "Le perdiem d'une mission se calcule à partir du barème : il ne se saisit jamais à la main.",
  chemin: "/finance/baremes",
  ecriture,
  vide: "Aucun barème défini.",
  colonnes: [
    { cle: "libelle", libelle: "Barème", principale: true },
    { cle: "role_agent", libelle: "Niveau", detail: true },
    {
      cle: "montant_jour",
      libelle: "Par jour",
      valeur: true,
      rendu: (e) => montant(e.montant_jour as string, e.devise as string),
    },
    {
      cle: "zone",
      libelle: "Zone",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.zone,
          {
            LOCALE: "neutre",
            NATIONALE: "info",
            SOUS_REGION: "alerte",
            INTERNATIONALE: "succes",
          },
          e.zone_libelle as string,
        ),
    },
  ],
  champs: [
    { nom: "libelle", libelle: "Libellé", requis: true, large: true },
    {
      nom: "zone",
      libelle: "Zone",
      type: "liste",
      requis: true,
      options: [
        { valeur: "LOCALE", libelle: "Locale (même ville)" },
        { valeur: "NATIONALE", libelle: "Nationale" },
        { valeur: "SOUS_REGION", libelle: "Sous-région" },
        { valeur: "INTERNATIONALE", libelle: "Internationale" },
      ],
    },
    {
      nom: "role_agent",
      libelle: "Niveau de responsabilité",
      aide: "Laisser vide pour un barème qui s'applique à tous.",
    },
    { nom: "montant_jour", libelle: "Montant par jour", type: "nombre", requis: true },
    { nom: "devise", libelle: "Devise", type: "liste", defaut: "XOF", options: DEVISES },
    { nom: "actif", libelle: "Barème actif", type: "booleen", defaut: "true" },
  ],
});

export const circuits = (ecriture: boolean): SpecRessource => ({
  titre: "Règles de circuit",
  description:
    "Qui valide quoi, et à partir de quel montant. Modifier une règle ne touche pas aux dossiers déjà lancés : leur circuit a été figé à la soumission.",
  chemin: "/finance/circuits",
  ecriture,
  vide: "Aucune règle de circuit.",
  colonnes: [
    {
      cle: "libelle",
      libelle: "Règle",
      principale: true,
      rendu: (e) => `${e.ordre}. ${e.libelle}`,
    },
    { cle: "type_document_libelle", libelle: "S'applique à", detail: true },
    {
      cle: "role_valideur",
      libelle: "Valideur",
      detail: true,
      rendu: (e) =>
        (e.valideur_nom as string) ||
        (e.valideur_identifiant as string) ||
        (e.valideur_hierarchique ? "Responsable du demandeur" : (e.role_valideur as string)) ||
        "Non désigné",
    },
    {
      cle: "montant_min",
      libelle: "Fourchette",
      valeur: true,
      rendu: (e) =>
        e.montant_max
          ? `${montant(e.montant_min as string)} → ${montant(e.montant_max as string)}`
          : `à partir de ${montant(e.montant_min as string)}`,
    },
    {
      cle: "nature",
      libelle: "Nature",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.nature,
          { DECISION: "danger", AVIS: "alerte", INFORMATION: "info" },
          e.actif ? (e.nature_libelle as string) : `${e.nature_libelle} (inactive)`,
        ),
    },
  ],
  champs: [
    { nom: "libelle", libelle: "Libellé de l'étape", requis: true, large: true },
    {
      nom: "type_document",
      libelle: "S'applique à",
      type: "liste",
      defaut: "TOUS",
      options: TYPES_DOCUMENT,
    },
    { nom: "ordre", libelle: "Position dans le circuit", type: "nombre", defaut: "1" },
    {
      nom: "nature",
      libelle: "Nature",
      type: "liste",
      defaut: "DECISION",
      options: [
        { valeur: "DECISION", libelle: "Décision — un refus arrête le dossier" },
        { valeur: "AVIS", libelle: "Avis — un refus est transmis à l'étape suivante" },
        { valeur: "INFORMATION", libelle: "Information — franchie à la soumission" },
      ],
    },
    { nom: "montant_min", libelle: "À partir de", type: "nombre", defaut: "0" },
    {
      nom: "montant_max",
      libelle: "Jusqu'à",
      type: "nombre",
      aide: "Laisser vide pour un plafond illimité.",
    },
    {
      nom: "role_valideur",
      libelle: "Rôle attendu",
      aide: "Code de rôle sur finance : gestionnaire, direction...",
    },
    {
      nom: "valideur_hierarchique",
      libelle: "Revient au responsable du demandeur",
      type: "booleen",
    },
    {
      nom: "valideur_identifiant",
      libelle: "Valideur désigné",
      aide: "Identifiant de connexion. Prioritaire sur le responsable et sur le rôle.",
    },
    { nom: "valideur_nom", libelle: "Nom du valideur désigné" },
    { nom: "actif", libelle: "Règle active", type: "booleen", defaut: "true" },
  ],
});

const TYPES_DOCUMENT = [
  { valeur: "TOUS", libelle: "Tous les documents" },
  { valeur: "REQUISITION", libelle: "Réquisition" },
  { valeur: "SORTIE_CAISSE", libelle: "Sortie de caisse" },
  { valeur: "DEPENSE", libelle: "Dépense" },
  { valeur: "MISSION", libelle: "Ordre de mission" },
  { valeur: "PRESTATION", libelle: "Prestation" },
  { valeur: "BON_COMMANDE", libelle: "Bon de commande" },
  { valeur: "FORFAIT_COM", libelle: "Forfait de communication" },
];

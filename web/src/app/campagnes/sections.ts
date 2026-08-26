/**
 * Les écrans de gestion du module Campagnes.
 *
 * Séparés de la page : celle-ci porte les gestes du terrain — enregistrer une
 * vente, consulter son classement — que l'on n'écrit pas sous forme de
 * formulaire générique. Le reste, les référentiels et le suivi, se déclare.
 */

import { badgeStatut, type SpecRessource } from "@/composants/ressource";
import { date, dateHeure, montant } from "@/lib/format";

export const partenaires = (ecriture: boolean): SpecRessource => ({
  titre: "Partenaires",
  description:
    "Certaines banques ont un réseau d'agences, d'autres non. Tout le découpage par agence en dépend.",
  chemin: "/bdm/partenaires",
  recherche: true,
  ecriture,
  vide: "Aucun partenaire enregistré.",
  colonnes: [
    { cle: "nom", libelle: "Nom", principale: true },
    { cle: "code", libelle: "Code", detail: true },
    { cle: "organisation_libelle", libelle: "Organisation", detail: true },
    {
      cle: "fiche_adhesion",
      libelle: "Adhésion",
      valeur: true,
      rendu: (e) => (e.fiche_adhesion ? "fiche d'adhésion exigée" : ""),
    },
    {
      cle: "actif",
      libelle: "État",
      statut: true,
      rendu: (e) => (e.actif ? null : badgeStatut("Inactif")),
    },
  ],
  champs: [
    { nom: "code", libelle: "Code", requis: true },
    { nom: "nom", libelle: "Nom", requis: true },
    { nom: "nom_complet", libelle: "Raison sociale", large: true },
    {
      nom: "organisation",
      libelle: "Organisation",
      type: "liste",
      defaut: "AGENCES",
      options: [
        { valeur: "AGENCES", libelle: "Réseau d'agences" },
        { valeur: "DIRECTE", libelle: "Commerciaux directs" },
      ],
    },
    {
      nom: "fiche_adhesion",
      libelle: "Fiche d'adhésion exigée",
      type: "booleen",
      aide: "UBA exige une demande d'adhésion VISA en plus de chaque vente.",
    },
    { nom: "ordre", libelle: "Ordre d'affichage", type: "nombre", defaut: "0" },
    { nom: "actif", libelle: "Partenaire actif", type: "booleen", defaut: "true" },
  ],
});

export const agences = (ecriture: boolean): SpecRessource => ({
  titre: "Agences",
  chemin: "/bdm/agences",
  recherche: true,
  ecriture,
  vide: "Aucune agence enregistrée.",
  colonnes: [
    { cle: "nom", libelle: "Nom", principale: true },
    { cle: "partenaire_nom", libelle: "Partenaire", detail: true },
    { cle: "adresse", libelle: "Adresse", detail: true },
    { cle: "chef_nom", libelle: "Chef d'agence", valeur: true },
    {
      cle: "actif",
      libelle: "État",
      statut: true,
      rendu: (e) => (e.actif ? null : badgeStatut("Inactive")),
    },
  ],
  champs: [
    {
      nom: "partenaire",
      libelle: "Partenaire",
      type: "liste",
      requis: true,
      source: { chemin: "/bdm/partenaires", libelle: "nom" },
    },
    { nom: "nom", libelle: "Nom", requis: true },
    { nom: "adresse", libelle: "Adresse", large: true },
    {
      nom: "chef_identifiant",
      libelle: "Identifiant du chef d'agence",
      aide: "Son identifiant de connexion : il verra les ventes de son agence.",
    },
    { nom: "chef_nom", libelle: "Nom du chef" },
    { nom: "ordre", libelle: "Ordre", type: "nombre", defaut: "0" },
    { nom: "actif", libelle: "Agence active", type: "booleen", defaut: "true" },
  ],
});

export const typesCartes = (ecriture: boolean): SpecRessource => ({
  titre: "Types de carte",
  chemin: "/bdm/types-cartes",
  ecriture,
  vide: "Aucun type de carte enregistré.",
  colonnes: [
    { cle: "libelle", libelle: "Libellé", principale: true },
    { cle: "code", libelle: "Code", detail: true },
    {
      cle: "actif",
      libelle: "État",
      statut: true,
      rendu: (e) => (e.actif ? null : badgeStatut("Inactif")),
    },
  ],
  champs: [
    {
      nom: "partenaire",
      libelle: "Partenaire",
      type: "liste",
      source: { chemin: "/bdm/partenaires", libelle: "nom", vide: "Tous" },
    },
    { nom: "code", libelle: "Code", requis: true },
    { nom: "libelle", libelle: "Libellé", requis: true },
    { nom: "actif", libelle: "Type actif", type: "booleen", defaut: "true" },
  ],
});

export const commerciaux = (ecriture: boolean): SpecRessource => ({
  titre: "Commerciaux",
  description:
    "Le rattachement commercial : ce n'est pas un compte, c'est l'appartenance à un partenaire et à une agence.",
  chemin: "/bdm/commerciaux",
  recherche: true,
  ecriture,
  vide: "Aucun commercial enregistré.",
  colonnes: [
    { cle: "nom_complet", libelle: "Nom", principale: true },
    { cle: "identifiant", libelle: "Identifiant", detail: true },
    { cle: "partenaire_nom", libelle: "Partenaire", detail: true },
    { cle: "agence_nom", libelle: "Agence", detail: true },
    {
      cle: "telephonique",
      libelle: "Type",
      statut: true,
      rendu: (e) =>
        e.telephonique ? badgeStatut("t", { t: "info" }, "Télévendeur") : null,
    },
  ],
  champs: [
    {
      nom: "identifiant",
      libelle: "Identifiant de connexion",
      requis: true,
      aide: "Le même que dans GDA Hub : c'est lui qui rattache ses saisies.",
      large: true,
    },
    { nom: "nom_complet", libelle: "Nom complet", requis: true },
    { nom: "telephone", libelle: "Téléphone" },
    {
      nom: "partenaire",
      libelle: "Partenaire",
      type: "liste",
      source: { chemin: "/bdm/partenaires", libelle: "nom" },
    },
    {
      nom: "agence",
      libelle: "Agence",
      type: "liste",
      source: { chemin: "/bdm/agences", libelle: "nom", vide: "Aucune" },
      aide: "Vide chez un partenaire sans réseau d'agences.",
    },
    { nom: "telephonique", libelle: "Commercial téléphonique", type: "booleen" },
    { nom: "adresse_contrat", libelle: "Adresse pour le contrat", type: "zone", large: true },
    { nom: "piece_identite_ref", libelle: "Référence de pièce d'identité", large: true },
    { nom: "actif", libelle: "Commercial actif", type: "booleen", defaut: "true" },
  ],
});

export const campagnes = (ecriture: boolean): SpecRessource => ({
  titre: "Campagnes",
  description:
    "Un statut posé à la main — arrêtée, annulée — prime toujours sur les dates : c'est une décision, pas un calendrier.",
  chemin: "/bdm/campagnes",
  recherche: true,
  ecriture,
  vide: "Aucune campagne enregistrée.",
  colonnes: [
    { cle: "nom", libelle: "Nom", principale: true },
    { cle: "partenaire_nom", libelle: "Partenaire", detail: true },
    {
      cle: "date_debut",
      libelle: "Période",
      detail: true,
      rendu: (e) => `${date(e.date_debut as string)} → ${date(e.date_fin as string)}`,
    },
    {
      cle: "sans_agences",
      libelle: "Réseau",
      detail: true,
      rendu: (e) => (e.sans_agences ? "sans réseau d'agences" : ""),
    },
    {
      cle: "prime_meilleur_vendeur",
      libelle: "Prime",
      valeur: true,
      rendu: (e) => montant(e.prime_meilleur_vendeur as string),
    },
    {
      cle: "statut_effectif",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(e.statut_effectif, {
          EN_COURS: "succes",
          PROGRAMMEE: "info",
          TERMINEE: "neutre",
          ARRETEE: "alerte",
          ANNULEE: "danger",
        }),
    },
  ],
  champs: [
    { nom: "nom", libelle: "Nom", requis: true, large: true },
    {
      nom: "partenaire",
      libelle: "Partenaire",
      type: "liste",
      source: { chemin: "/bdm/partenaires", libelle: "nom" },
    },
    {
      nom: "type_campagne",
      libelle: "Type",
      type: "liste",
      defaut: "VENTE_CARTE",
      options: [
        { valeur: "VENTE_CARTE", libelle: "Vente de cartes" },
        { valeur: "ENROLEMENT", libelle: "Enrôlement application" },
      ],
    },
    { nom: "date_debut", libelle: "Début", type: "date", requis: true },
    { nom: "date_fin", libelle: "Fin", type: "date", requis: true },
    {
      nom: "statut",
      libelle: "Statut",
      type: "liste",
      defaut: "PROGRAMMEE",
      options: [
        { valeur: "PROGRAMMEE", libelle: "Programmée" },
        { valeur: "EN_COURS", libelle: "En cours" },
        { valeur: "ARRETEE", libelle: "Arrêtée" },
        { valeur: "ANNULEE", libelle: "Annulée" },
        { valeur: "TERMINEE", libelle: "Terminée" },
      ],
    },
    { nom: "toutes_agences", libelle: "Toutes les agences", type: "booleen", defaut: "true" },
    {
      nom: "contrat_tous_commerciaux",
      libelle: "Tous les commerciaux",
      type: "booleen",
      defaut: "true",
    },
    {
      nom: "prime_meilleur_vendeur",
      libelle: "Prime du meilleur vendeur",
      type: "nombre",
      defaut: "25000",
    },
    { nom: "aide_hebdo_active", libelle: "Aide hebdomadaire", type: "booleen" },
    {
      nom: "aide_hebdo_montant",
      libelle: "Montant hebdomadaire",
      type: "nombre",
      defaut: "5000",
      aide: "Carburant + crédit téléphone doivent faire ce total.",
    },
    { nom: "aide_hebdo_carburant", libelle: "Dont carburant", type: "nombre", defaut: "3000" },
    {
      nom: "aide_hebdo_credit_tel",
      libelle: "Dont crédit téléphone",
      type: "nombre",
      defaut: "2000",
    },
    { nom: "contrat_emolument", libelle: "Émolument forfaitaire", type: "nombre", defaut: "50000" },
    {
      nom: "contrat_forfait_communication",
      libelle: "Forfait communication",
      type: "nombre",
      defaut: "2000",
    },
    {
      nom: "contrat_forfait_deplacement",
      libelle: "Forfait déplacement",
      type: "nombre",
      defaut: "3000",
    },
    { nom: "contrat_representant", libelle: "Représentant de GDA" },
    { nom: "contrat_lieu_signature", libelle: "Lieu de signature", defaut: "Bamako" },
    { nom: "contrat_clause_libre", libelle: "Clause libre", type: "zone", large: true },
    { nom: "actif", libelle: "Campagne active", type: "booleen", defaut: "true" },
  ],
});

export const enrolements = (ecriture: boolean): SpecRessource => ({
  titre: "Enrôlements",
  description: "L'inscription d'un client sur l'application mobile de la banque.",
  chemin: "/bdm/enrolements",
  recherche: true,
  ecriture,
  vide: "Aucun enrôlement enregistré.",
  colonnes: [
    { cle: "nom_complet", libelle: "Client", principale: true },
    { cle: "numero_compte", libelle: "Compte", detail: true },
    { cle: "telephone", libelle: "Téléphone", detail: true },
    { cle: "commercial_nom", libelle: "Commercial", detail: true },
    {
      cle: "cree_le",
      libelle: "Saisi le",
      valeur: true,
      rendu: (e) => dateHeure(e.cree_le as string),
    },
    {
      cle: "corrigible",
      libelle: "Correction",
      statut: true,
      rendu: (e) =>
        e.corrigible
          ? badgeStatut("c", { c: "info" }, "Corrigible")
          : badgeStatut("f", { f: "neutre" }, "Figé"),
    },
  ],
  champs: [
    {
      nom: "campagne",
      libelle: "Campagne",
      type: "liste",
      requis: true,
      source: { chemin: "/bdm/campagnes", libelle: "nom" },
    },
    { nom: "prenom", libelle: "Prénom", requis: true },
    { nom: "nom", libelle: "Nom", requis: true },
    {
      nom: "numero_compte",
      libelle: "Numéro de compte",
      requis: true,
      aide: "Obligatoire : c'est lui qui rattache l'enrôlement au client de la banque.",
    },
    { nom: "telephone", libelle: "Téléphone" },
    { nom: "adresse", libelle: "Adresse", type: "zone", large: true },
  ],
});

export const adhesions = (ecriture: boolean): SpecRessource => ({
  titre: "Demandes d'adhésion",
  description:
    "Exigée par certains partenaires à chaque vente. Sans elle, la carte ne part pas en fabrication.",
  chemin: "/bdm/adhesions",
  recherche: true,
  ecriture,
  vide: "Aucune demande d'adhésion saisie.",
  colonnes: [
    { cle: "nom_complet", libelle: "Titulaire", principale: true },
    { cle: "piece_numero", libelle: "Pièce", detail: true },
    { cle: "numero_compte", libelle: "Compte", detail: true },
    { cle: "telephone", libelle: "Téléphone", detail: true },
    { cle: "nom_sur_carte", libelle: "Nom sur la carte", valeur: true },
  ],
  champs: [
    {
      nom: "vente",
      libelle: "Vente",
      type: "liste",
      requis: true,
      source: { chemin: "/bdm/ventes", libelle: "client_nom" },
    },
    { nom: "prenoms", libelle: "Prénoms", requis: true },
    { nom: "nom", libelle: "Nom", requis: true },
    { nom: "date_naissance", libelle: "Date de naissance", type: "date" },
    { nom: "lieu_naissance", libelle: "Lieu de naissance" },
    { nom: "nationalite", libelle: "Nationalité" },
    { nom: "telephone", libelle: "Téléphone" },
    { nom: "email", libelle: "Adresse e-mail", type: "courriel" },
    { nom: "pays_residence", libelle: "Pays de résidence" },
    { nom: "ville", libelle: "Ville" },
    { nom: "quartier", libelle: "Quartier" },
    { nom: "nom_sur_carte", libelle: "Nom gravé sur la carte" },
    {
      nom: "piece_type",
      libelle: "Type de pièce",
      type: "liste",
      options: [
        { valeur: "", libelle: "Non précisé" },
        { valeur: "CNI", libelle: "Carte nationale d'identité" },
        { valeur: "PASSEPORT", libelle: "Passeport" },
        { valeur: "NINA", libelle: "Carte NINA" },
      ],
    },
    { nom: "piece_numero", libelle: "Numéro de pièce" },
    { nom: "piece_delivree_le", libelle: "Délivrée le", type: "date" },
    { nom: "piece_expire_le", libelle: "Expire le", type: "date" },
    { nom: "piece_autorite", libelle: "Autorité" },
    { nom: "numero_compte", libelle: "Numéro de compte" },
    { nom: "profession", libelle: "Profession" },
    { nom: "employeur", libelle: "Employeur" },
    { nom: "adresse", libelle: "Adresse", type: "zone", large: true },
  ],
});

export const rapportsTelephoniques = (ecriture: boolean): SpecRessource => ({
  titre: "Rapports téléphoniques",
  description: "Le compte rendu d'un télévendeur : des appels, pas des ventes terrain.",
  chemin: "/bdm/rapports-telephoniques",
  ecriture,
  vide: "Aucun rapport enregistré.",
  colonnes: [
    { cle: "commercial_nom", libelle: "Commercial", principale: true },
    {
      cle: "date_rapport",
      libelle: "Date",
      detail: true,
      rendu: (e) => date(e.date_rapport as string),
    },
    {
      cle: "appels_emis",
      libelle: "Appels",
      detail: true,
      rendu: (e) => `${e.appels_aboutis} aboutis sur ${e.appels_emis} émis`,
    },
    {
      cle: "cartes_vendues",
      libelle: "Ventes",
      valeur: true,
      rendu: (e) => `${e.rendez_vous} RDV · ${e.cartes_vendues} cartes`,
    },
    {
      cle: "taux_aboutissement",
      libelle: "Taux",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          "t",
          { t: (e.taux_aboutissement as number) >= 30 ? "succes" : "alerte" },
          `${e.taux_aboutissement} %`,
        ),
    },
  ],
  champs: [
    {
      nom: "campagne",
      libelle: "Campagne",
      type: "liste",
      source: { chemin: "/bdm/campagnes", libelle: "nom", vide: "Aucune" },
    },
    { nom: "date_rapport", libelle: "Date", type: "date", requis: true },
    { nom: "appels_emis", libelle: "Appels émis", type: "nombre", defaut: "0" },
    { nom: "appels_aboutis", libelle: "Appels aboutis", type: "nombre", defaut: "0" },
    { nom: "rendez_vous", libelle: "Rendez-vous obtenus", type: "nombre", defaut: "0" },
    { nom: "cartes_vendues", libelle: "Cartes vendues", type: "nombre", defaut: "0" },
    { nom: "commentaire", libelle: "Commentaire", type: "zone", large: true },
  ],
});

export const primes = (): SpecRessource => ({
  titre: "Primes",
  description: "Elles se calculent depuis les ventes : elles ne se saisissent pas.",
  chemin: "/bdm/primes",
  ecriture: false,
  vide: "Aucune prime calculée.",
  colonnes: [
    { cle: "commercial_nom", libelle: "Commercial", principale: true },
    { cle: "periode", libelle: "Période", detail: true },
    { cle: "campagne_nom", libelle: "Campagne", detail: true },
    {
      cle: "ventes_comptees",
      libelle: "Ventes",
      detail: true,
      rendu: (e) => `${e.ventes_comptees} vente(s)`,
    },
    {
      cle: "montant",
      libelle: "Montant",
      valeur: true,
      rendu: (e) => montant(e.montant as string),
    },
    {
      cle: "rang",
      libelle: "Rang",
      statut: true,
      rendu: (e) =>
        (e.rang as number) === 1
          ? badgeStatut("p", { p: "succes" }, "1er")
          : badgeStatut("r", { r: "neutre" }, `${e.rang}e`),
    },
  ],
});

export const reclamations = (ecriture: boolean): SpecRessource => ({
  titre: "Réclamations",
  chemin: "/bdm/reclamations",
  ecriture,
  vide: "Aucune réclamation ouverte.",
  colonnes: [
    { cle: "client_nom", libelle: "Client", principale: true },
    { cle: "type_libelle", libelle: "Type", detail: true },
    { cle: "description", libelle: "Description", detail: true },
    {
      cle: "cree_le",
      libelle: "Ouverte le",
      valeur: true,
      rendu: (e) => date(e.cree_le as string),
    },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.statut,
          { OUVERTE: "alerte", EN_COURS: "info", RESOLUE: "succes" },
          e.statut_libelle as string,
        ),
    },
  ],
  champs: [
    {
      nom: "client",
      libelle: "Client",
      type: "liste",
      requis: true,
      source: { chemin: "/bdm/clients", libelle: "nom_complet" },
    },
    {
      nom: "type_reclamation",
      libelle: "Type",
      type: "liste",
      requis: true,
      options: [
        { valeur: "ACTIVATION", libelle: "Activation" },
        { valeur: "MOT_DE_PASSE", libelle: "Mot de passe" },
        { valeur: "RECHARGEMENT", libelle: "Rechargement" },
        { valeur: "AUTRE", libelle: "Autre" },
      ],
    },
    {
      nom: "statut",
      libelle: "Statut",
      type: "liste",
      defaut: "OUVERTE",
      options: [
        { valeur: "OUVERTE", libelle: "Ouverte" },
        { valeur: "EN_COURS", libelle: "En cours" },
        { valeur: "RESOLUE", libelle: "Résolue" },
      ],
    },
    { nom: "description", libelle: "Description", type: "zone", large: true },
  ],
});

export const contrats = (): SpecRessource => ({
  titre: "Réponses aux contrats",
  description: "La signature en ligne du contrat de prestation par les commerciaux.",
  chemin: "/bdm/contrats",
  ecriture: false,
  vide: "Aucune réponse enregistrée.",
  colonnes: [
    { cle: "commercial_nom", libelle: "Commercial", principale: true },
    {
      cle: "repondu_le",
      libelle: "Répondu le",
      detail: true,
      rendu: (e) => (e.repondu_le ? dateHeure(e.repondu_le as string) : "sans réponse"),
    },
    { cle: "motif_refus", libelle: "Motif", detail: true },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.statut,
          { ACCEPTE: "succes", REFUSE: "danger", EN_ATTENTE: "alerte" },
          e.statut_libelle as string,
        ),
    },
  ],
});

export const aides = (ecriture: boolean): SpecRessource => ({
  titre: "Versements d'aide",
  description:
    "L'accusé de réception est la signature du commercial : sans lui, un versement contesté ne se prouve pas.",
  chemin: "/bdm/aides",
  ecriture,
  vide: "Aucun versement enregistré.",
  colonnes: [
    { cle: "commercial_nom", libelle: "Commercial", principale: true },
    {
      cle: "semaine_debut",
      libelle: "Semaine",
      detail: true,
      rendu: (e) => `semaine du ${date(e.semaine_debut as string)}`,
    },
    {
      cle: "montant",
      libelle: "Montant",
      valeur: true,
      rendu: (e) => montant(e.montant as number),
    },
    {
      cle: "accuse_le",
      libelle: "Accusé",
      statut: true,
      rendu: (e) =>
        e.accuse_le
          ? badgeStatut("a", { a: "succes" }, "Accusé")
          : badgeStatut("n", { n: "alerte" }, "Sans accusé"),
    },
  ],
  champs: [
    {
      nom: "campagne",
      libelle: "Campagne",
      type: "liste",
      requis: true,
      source: { chemin: "/bdm/campagnes", libelle: "nom" },
    },
    {
      nom: "commercial",
      libelle: "Commercial",
      type: "liste",
      requis: true,
      source: { chemin: "/bdm/commerciaux", libelle: "nom_complet" },
    },
    { nom: "semaine_debut", libelle: "Début de semaine", type: "date", requis: true },
    { nom: "montant", libelle: "Montant", type: "nombre", requis: true },
    { nom: "verse_le", libelle: "Versé le", type: "date" },
  ],
});

export const clients = (ecriture: boolean): SpecRessource => ({
  titre: "Clients",
  description: "Les porteurs de carte enregistrés sur le terrain.",
  chemin: "/bdm/clients",
  recherche: true,
  ecriture,
  vide: "Aucun client enregistré.",
  colonnes: [
    { cle: "nom_complet", libelle: "Nom", principale: true },
    { cle: "telephone", libelle: "Téléphone", detail: true },
    { cle: "ville", libelle: "Ville", detail: true },
    { cle: "quartier", libelle: "Quartier", detail: true },
    { cle: "commercial_nom", libelle: "Commercial", valeur: true },
    {
      cle: "statut_carte",
      libelle: "Carte",
      statut: true,
      rendu: (e) =>
        badgeStatut(e.statut_carte, {
          ACTIVEE: "succes",
          VENDUE: "info",
          EN_ERREUR: "danger",
        }),
    },
  ],
  champs: [
    {
      nom: "type_carte",
      libelle: "Type de carte",
      type: "liste",
      requis: true,
      source: { chemin: "/bdm/types-cartes", libelle: "libelle" },
    },
    { nom: "prenom", libelle: "Prénom", requis: true },
    { nom: "nom", libelle: "Nom", requis: true },
    { nom: "telephone", libelle: "Téléphone" },
    { nom: "ville", libelle: "Ville" },
    { nom: "quartier", libelle: "Quartier" },
    { nom: "piece_identite", libelle: "Pièce d'identité", large: true },
    {
      nom: "statut_carte",
      libelle: "Statut de la carte",
      type: "liste",
      defaut: "VENDUE",
      options: [
        { valeur: "VENDUE", libelle: "Vendue" },
        { valeur: "ACTIVEE", libelle: "Activée" },
        { valeur: "EN_ERREUR", libelle: "En erreur" },
      ],
    },
  ],
});

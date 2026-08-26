/**
 * Les écrans de gestion du module Planning.
 *
 * Le calendrier du mois reste écrit à la main dans la page : c'est la vue que
 * l'équipe regarde tous les matins. Tout ce qui s'administre — clients, jours
 * interdits, idées, échéances, bilans — se déclare ici.
 */

import { badgeStatut, type SpecRessource } from "@/composants/ressource";
import { date, dateHeure } from "@/lib/format";

const STATUTS = {
  REALISE: "succes",
  EN_ATTENTE: "info",
  REPROGRAMME: "alerte",
  NON_REALISE: "danger",
  ANNULE: "neutre",
} as const;

const CHOIX_STATUT = [
  { valeur: "EN_ATTENTE", libelle: "En attente" },
  { valeur: "REALISE", libelle: "Réalisé" },
  { valeur: "REPROGRAMME", libelle: "Reprogrammé" },
  { valeur: "NON_REALISE", libelle: "Non réalisé" },
  { valeur: "ANNULE", libelle: "Annulé" },
];

export const clients = (ecriture: boolean): SpecRessource => ({
  titre: "Clients",
  description:
    "Un client rattaché à un compte ne voit que son propre planning en se connectant.",
  chemin: "/planning/clients",
  recherche: true,
  ecriture,
  vide: "Aucun client enregistré.",
  colonnes: [
    { cle: "nom_entreprise", libelle: "Entreprise", principale: true },
    { cle: "contact", libelle: "Contact", detail: true },
    { cle: "telephone", libelle: "Téléphone", detail: true },
    {
      cle: "regles",
      libelle: "Jours interdits",
      valeur: true,
      rendu: (e) => `${(e.regles as unknown[])?.length ?? 0} règle(s)`,
    },
    {
      cle: "actif",
      libelle: "État",
      statut: true,
      rendu: (e) =>
        badgeStatut(e.actif ? "a" : "i", { a: "succes", i: "neutre" }, e.actif ? "Actif" : "Inactif"),
    },
  ],
  champs: [
    { nom: "nom_entreprise", libelle: "Entreprise", requis: true, large: true },
    { nom: "contact", libelle: "Personne à contacter" },
    { nom: "telephone", libelle: "Téléphone" },
    { nom: "email", libelle: "Courriel", type: "courriel" },
    {
      nom: "compte_identifiant",
      libelle: "Identifiant du compte",
      aide: "Le courriel de connexion, si le client consulte lui-même son planning.",
    },
    { nom: "actif", libelle: "Client actif", type: "booleen", defaut: "true" },
  ],
});

export const regles = (ecriture: boolean): SpecRessource => ({
  titre: "Jours à éviter",
  description:
    "Publier le vendredi chez un client qui ferme le vendredi, c'est publier dans le vide : l'écran prévient au lieu d'interdire.",
  chemin: "/planning/regles",
  ecriture,
  vide: "Aucun jour déconseillé.",
  colonnes: [
    { cle: "jour_libelle", libelle: "Jour", principale: true },
    { cle: "motif", libelle: "Motif", detail: true },
    { cle: "client", libelle: "Client", valeur: true },
  ],
  champs: [
    {
      nom: "client",
      libelle: "Client",
      type: "liste",
      requis: true,
      source: { chemin: "/planning/clients", libelle: "nom_entreprise" },
    },
    {
      nom: "jour",
      libelle: "Jour de la semaine",
      type: "liste",
      requis: true,
      options: [
        { valeur: 0, libelle: "Lundi" },
        { valeur: 1, libelle: "Mardi" },
        { valeur: 2, libelle: "Mercredi" },
        { valeur: 3, libelle: "Jeudi" },
        { valeur: 4, libelle: "Vendredi" },
        { valeur: 5, libelle: "Samedi" },
        { valeur: 6, libelle: "Dimanche" },
      ],
    },
    { nom: "motif", libelle: "Motif", large: true },
  ],
});

export const idees = (ecriture: boolean): SpecRessource => ({
  titre: "Banque d'idées",
  description: "Ce qu'on tournera un jour. Une idée sans tournage ne se perd pas ici.",
  chemin: "/planning/idees",
  recherche: true,
  ecriture,
  vide: "Aucune idée déposée.",
  colonnes: [
    { cle: "titre", libelle: "Idée", principale: true },
    { cle: "notes", libelle: "Notes", detail: true },
    {
      cle: "type_contenu",
      libelle: "Format",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.type_contenu,
          { VIDEO: "info", IMAGE: "succes", TEXTE: "neutre" },
          e.type_contenu_libelle as string,
        ),
    },
  ],
  champs: [
    { nom: "titre", libelle: "Titre", requis: true, large: true },
    {
      nom: "type_contenu",
      libelle: "Format",
      type: "liste",
      defaut: "VIDEO",
      options: [
        { valeur: "VIDEO", libelle: "Vidéo" },
        { valeur: "IMAGE", libelle: "Image" },
        { valeur: "TEXTE", libelle: "Texte" },
      ],
    },
    { nom: "notes", libelle: "Notes", type: "zone", large: true },
  ],
});

export const tournages = (ecriture: boolean): SpecRessource => ({
  titre: "Tournages",
  description:
    "Un statut autre que « réalisé » demande une raison : sans elle, personne ne saura trois mois plus tard pourquoi la séance a sauté.",
  chemin: "/planning/tournages",
  recherche: true,
  ecriture,
  vide: "Aucun tournage programmé.",
  colonnes: [
    { cle: "client_nom", libelle: "Client", principale: true },
    {
      cle: "date",
      libelle: "Date",
      detail: true,
      rendu: (e) => date(e.date as string),
    },
    { cle: "description", libelle: "Sujet", detail: true },
    {
      cle: "idees_titres",
      libelle: "Idées",
      valeur: true,
      rendu: (e) => `${(e.idees_titres as unknown[])?.length ?? 0} idée(s)`,
    },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.statut,
          STATUTS,
          e.en_retard ? `${e.statut_libelle} · en retard` : (e.statut_libelle as string),
        ),
    },
  ],
  champs: [
    {
      nom: "client",
      libelle: "Client",
      type: "liste",
      requis: true,
      source: { chemin: "/planning/clients", libelle: "nom_entreprise" },
    },
    { nom: "date", libelle: "Date du tournage", type: "date", requis: true },
    { nom: "statut", libelle: "Statut", type: "liste", defaut: "EN_ATTENTE", options: CHOIX_STATUT },
    { nom: "description", libelle: "Sujet", type: "zone", large: true },
    {
      nom: "motif_statut",
      libelle: "Raison du statut",
      large: true,
      aide: "Obligatoire si le tournage est annulé, non réalisé ou reprogrammé.",
    },
  ],
});

export const publications = (ecriture: boolean): SpecRessource => ({
  titre: "Publications",
  description:
    "Un tournage ne se publie qu'une fois : le rattacher deux fois gonflerait le bilan du mois.",
  chemin: "/planning/publications",
  recherche: true,
  ecriture,
  vide: "Aucune publication programmée.",
  colonnes: [
    { cle: "client_nom", libelle: "Client", principale: true },
    {
      cle: "date",
      libelle: "Date",
      detail: true,
      rendu: (e) =>
        e.jour_deconseille
          ? `${date(e.date as string)} · ${e.jour} déconseillé`
          : date(e.date as string),
    },
    {
      cle: "idee_titre",
      libelle: "Contenu",
      detail: true,
      rendu: (e) => (e.idee_titre as string) || (e.description as string),
    },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.statut,
          STATUTS,
          e.en_retard ? `${e.statut_libelle} · en retard` : (e.statut_libelle as string),
        ),
    },
  ],
  champs: [
    {
      nom: "client",
      libelle: "Client",
      type: "liste",
      requis: true,
      source: { chemin: "/planning/clients", libelle: "nom_entreprise" },
    },
    { nom: "date", libelle: "Date de publication", type: "date", requis: true },
    {
      nom: "idee",
      libelle: "Idée publiée",
      type: "liste",
      source: { chemin: "/planning/idees", libelle: "titre", vide: "Aucune" },
    },
    {
      nom: "tournage",
      libelle: "Tournage d'origine",
      type: "liste",
      source: { chemin: "/planning/tournages", libelle: "description", vide: "Aucun" },
      aide: "Doit appartenir au même client, et n'être rattaché à aucune autre publication.",
    },
    { nom: "statut", libelle: "Statut", type: "liste", defaut: "EN_ATTENTE", options: CHOIX_STATUT },
    { nom: "description", libelle: "Description", type: "zone", large: true },
    {
      nom: "motif_statut",
      libelle: "Raison du statut",
      large: true,
      aide: "Obligatoire si la publication est annulée, non réalisée ou reprogrammée.",
    },
  ],
});

export const rapports = (): SpecRessource => ({
  titre: "Bilans clients",
  description:
    "Un bilan est figé au moment où on le construit : le régénérer plus tard donnerait d'autres chiffres.",
  chemin: "/planning/rapports",
  ecriture: false,
  vide: "Aucun bilan construit.",
  colonnes: [
    { cle: "client_nom", libelle: "Client", principale: true },
    {
      cle: "mois",
      libelle: "Période",
      detail: true,
      rendu: (e) => `${e.mois}/${e.annee}`,
    },
    { cle: "genere_par_nom", libelle: "Construit par", detail: true },
    {
      cle: "cree_le",
      libelle: "Le",
      valeur: true,
      rendu: (e) => dateHeure(e.cree_le as string),
    },
    {
      cle: "telechargements",
      libelle: "Consulté",
      statut: true,
      rendu: (e) => badgeStatut("t", { t: "neutre" }, `${e.telechargements} envoi(s)`),
    },
  ],
  detail: (e) => String(e.contenu ?? ""),
  actions: [
    {
      libelle: "Marquer envoyé",
      chemin: (e) => `/planning/rapports/${e.id}/telecharger`,
    },
  ],
});

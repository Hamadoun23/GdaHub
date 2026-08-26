/**
 * Les écrans de gestion du module Chantiers.
 *
 * La saisie d'avancement reste écrite à la main dans la page : c'est un geste
 * métier, pas un formulaire. Le découpage du chantier, les photos et les
 * rapports, eux, se déclarent.
 */

import { badgeStatut, type SpecRessource } from "@/composants/ressource";
import { date, dateHeure } from "@/lib/format";

export const projets = (ecriture: boolean): SpecRessource => ({
  titre: "Chantiers",
  chemin: "/daily/projets",
  recherche: true,
  ecriture,
  vide: "Aucun chantier ne vous est affecté.",
  colonnes: [
    { cle: "nom", libelle: "Nom", principale: true },
    { cle: "client", libelle: "Client", detail: true },
    {
      cle: "date_debut",
      libelle: "Période",
      detail: true,
      rendu: (e) =>
        e.date_debut ? `${date(e.date_debut as string)} → ${date(e.date_fin as string)}` : "",
    },
    {
      cle: "avancement",
      libelle: "Avancement",
      valeur: true,
      rendu: (e) => `${e.avancement} % · ${e.nombre_de_taches} tâche(s)`,
    },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.statut,
          {
            EN_COURS: "succes",
            PLANIFIE: "info",
            TERMINE: "neutre",
            SUSPENDU: "alerte",
          },
          e.statut_libelle as string,
        ),
    },
  ],
  champs: [
    { nom: "nom", libelle: "Nom du chantier", requis: true, large: true },
    { nom: "client", libelle: "Client" },
    {
      nom: "statut",
      libelle: "Statut",
      type: "liste",
      defaut: "PLANIFIE",
      options: [
        { valeur: "PLANIFIE", libelle: "Planifié" },
        { valeur: "EN_COURS", libelle: "En cours" },
        { valeur: "TERMINE", libelle: "Terminé" },
        { valeur: "SUSPENDU", libelle: "Suspendu" },
      ],
    },
    { nom: "date_debut", libelle: "Début", type: "date" },
    { nom: "date_fin", libelle: "Fin", type: "date" },
    { nom: "ordre", libelle: "Ordre d'affichage", type: "nombre", defaut: "0" },
    { nom: "description", libelle: "Description", type: "zone", large: true },
  ],
});

export const phases = (ecriture: boolean): SpecRessource => ({
  titre: "Phases",
  description:
    "Une phase masquée au partenaire disparaît de sa vue, elle et tout ce qu'elle contient.",
  chemin: "/daily/phases",
  ecriture,
  vide: "Aucune phase définie.",
  colonnes: [
    { cle: "nom", libelle: "Nom", principale: true },
    {
      cle: "sous_phases",
      libelle: "Sous-phases",
      detail: true,
      rendu: (e) => `${(e.sous_phases as unknown[])?.length ?? 0} sous-phase(s)`,
    },
    {
      cle: "avancement",
      libelle: "Avancement",
      valeur: true,
      rendu: (e) => `${e.avancement} %`,
    },
    {
      cle: "masquee_partenaire",
      libelle: "Visibilité",
      statut: true,
      rendu: (e) =>
        e.masquee_partenaire ? badgeStatut("m", { m: "alerte" }, "Masquée") : null,
    },
  ],
  champs: [
    {
      nom: "projet",
      libelle: "Chantier",
      type: "liste",
      requis: true,
      source: { chemin: "/daily/projets", libelle: "nom" },
    },
    { nom: "nom", libelle: "Nom de la phase", requis: true },
    { nom: "ordre", libelle: "Ordre", type: "nombre", defaut: "0" },
    { nom: "masquee_partenaire", libelle: "Masquée au partenaire", type: "booleen" },
  ],
});

export const sousPhases = (ecriture: boolean): SpecRessource => ({
  titre: "Sous-phases",
  chemin: "/daily/sous-phases",
  ecriture,
  vide: "Aucune sous-phase définie.",
  colonnes: [
    { cle: "nom", libelle: "Nom", principale: true },
    {
      cle: "taches",
      libelle: "Tâches",
      detail: true,
      rendu: (e) => `${(e.taches as unknown[])?.length ?? 0} tâche(s)`,
    },
    {
      cle: "avancement",
      libelle: "Avancement",
      valeur: true,
      rendu: (e) => `${e.avancement} %`,
    },
    {
      cle: "masquee_partenaire",
      libelle: "Visibilité",
      statut: true,
      rendu: (e) =>
        e.masquee_partenaire ? badgeStatut("m", { m: "alerte" }, "Masquée") : null,
    },
  ],
  champs: [
    {
      nom: "phase",
      libelle: "Phase",
      type: "liste",
      requis: true,
      source: { chemin: "/daily/phases", libelle: "nom" },
    },
    { nom: "nom", libelle: "Nom de la sous-phase", requis: true },
    { nom: "ordre", libelle: "Ordre", type: "nombre", defaut: "0" },
    { nom: "masquee_partenaire", libelle: "Masquée au partenaire", type: "booleen" },
  ],
});

export const taches = (ecriture: boolean): SpecRessource => ({
  titre: "Tâches",
  description:
    "Le jour de début et la durée comptent à partir du démarrage du chantier : un glissement ne recalcule aucune date.",
  chemin: "/daily/taches",
  recherche: true,
  ecriture,
  vide: "Aucune tâche définie.",
  colonnes: [
    { cle: "activite", libelle: "Activité", principale: true },
    {
      cle: "phase_nom",
      libelle: "Emplacement",
      detail: true,
      rendu: (e) => `${e.phase_nom} · ${e.sous_phase_nom}`,
    },
    {
      cle: "jour_debut",
      libelle: "Planning",
      detail: true,
      rendu: (e) => `jour ${e.jour_debut}, ${e.duree_jours} j`,
    },
    {
      cle: "avancement",
      libelle: "Avancement",
      valeur: true,
      rendu: (e) => `${e.avancement} %`,
    },
    {
      cle: "derniere_saisie",
      libelle: "Dernière saisie",
      statut: true,
      rendu: (e) =>
        e.derniere_saisie
          ? badgeStatut("s", { s: "neutre" }, date(e.derniere_saisie as string))
          : badgeStatut("j", { j: "alerte" }, "Jamais saisie"),
    },
  ],
  champs: [
    {
      nom: "sous_phase",
      libelle: "Sous-phase",
      type: "liste",
      requis: true,
      source: { chemin: "/daily/sous-phases", libelle: "nom" },
    },
    { nom: "activite", libelle: "Activité", requis: true, large: true },
    { nom: "jour_debut", libelle: "Jour de début", type: "nombre", defaut: "1" },
    { nom: "duree_jours", libelle: "Durée (jours)", type: "nombre", defaut: "1" },
    { nom: "ordre", libelle: "Ordre", type: "nombre", defaut: "0" },
    { nom: "masquee_partenaire", libelle: "Masquée au partenaire", type: "booleen" },
  ],
});

export const saisies = (): SpecRessource => ({
  titre: "Saisies journalières",
  description: "Une seule par tâche et par jour : une deuxième corrige la première.",
  chemin: "/daily/saisies",
  ecriture: false,
  vide: "Aucune saisie enregistrée.",
  colonnes: [
    {
      cle: "date_rapport",
      libelle: "Date",
      principale: true,
      rendu: (e) => date(e.date_rapport as string),
    },
    { cle: "commentaire", libelle: "Commentaire", detail: true },
    { cle: "agent_nom", libelle: "Saisi par", detail: true },
    {
      cle: "avancement",
      libelle: "Avancement",
      valeur: true,
      rendu: (e) => `${e.avancement} %`,
    },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.statut,
          { TERMINE: "succes", EN_COURS: "info", NON_DEMARRE: "neutre", ANNULE: "danger" },
          e.statut_libelle as string,
        ),
    },
  ],
});

export const rapports = (ecriture: boolean): SpecRessource => ({
  titre: "Rapports journaliers",
  description:
    "La météo explique tout sur un chantier : une journée de pluie arrête le coulage, et sans elle un retard devient inexplicable.",
  chemin: "/daily/rapports",
  ecriture,
  vide: "Aucun rapport rédigé.",
  colonnes: [
    { cle: "projet_nom", libelle: "Chantier", principale: true },
    {
      cle: "date_rapport",
      libelle: "Date",
      detail: true,
      rendu: (e) => date(e.date_rapport as string),
    },
    { cle: "meteo", libelle: "Météo", detail: true },
    { cle: "agent_nom", libelle: "Rédigé par", detail: true },
    {
      cle: "avancement_global",
      libelle: "Avancement",
      valeur: true,
      rendu: (e) => `${e.avancement_global} %`,
    },
  ],
  champs: [
    {
      nom: "projet",
      libelle: "Chantier",
      type: "liste",
      requis: true,
      source: { chemin: "/daily/projets", libelle: "nom" },
    },
    { nom: "date_rapport", libelle: "Date", type: "date", requis: true },
    { nom: "meteo", libelle: "Météo" },
    { nom: "temperature", libelle: "Température (°C)", type: "nombre" },
    { nom: "notes", libelle: "Notes", type: "zone", large: true },
  ],
});

export const journal = (): SpecRessource => ({
  titre: "Journal d'activité",
  description: "Un chantier se conteste : cela se vérifie ici, et nulle part ailleurs.",
  chemin: "/daily/journal",
  parametres: "taille=100",
  ecriture: false,
  vide: "Aucun geste consigné.",
  colonnes: [
    {
      cle: "description",
      libelle: "Geste",
      principale: true,
      rendu: (e) => (e.description as string) || (e.action as string),
    },
    { cle: "agent_nom", libelle: "Par", detail: true },
    {
      cle: "cree_le",
      libelle: "Quand",
      detail: true,
      rendu: (e) => dateHeure(e.cree_le as string),
    },
    { cle: "action", libelle: "Action", statut: true, rendu: (e) => badgeStatut(e.action) },
  ],
});

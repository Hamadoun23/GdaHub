/**
 * L'administration des départements.
 *
 * L'annuaire et l'organigramme restent écrits à la main : une fiche d'agent
 * porte trop de règles pour tenir dans un formulaire déclaré, et un
 * organigramme se lit en arbre. Un département, lui, n'est qu'un code, un nom
 * et un responsable.
 */

import { badgeStatut, type SpecRessource } from "@/composants/ressource";

export const departements = (ecriture: boolean): SpecRessource => ({
  titre: "Départements",
  description:
    "Le responsable d'un département est le premier valideur des demandes de ses agents : le laisser vide fait remonter le dossier au rattachement direct.",
  chemin: "/organisation/departements",
  recherche: true,
  ecriture,
  vide: "Aucun département.",
  colonnes: [
    {
      cle: "nom",
      libelle: "Département",
      principale: true,
      rendu: (e) => `${e.code} — ${e.nom}`,
    },
    {
      cle: "responsable_nom",
      libelle: "Responsable",
      detail: true,
      rendu: (e) => (e.responsable_nom as string) || "Aucun responsable désigné",
    },
    {
      cle: "effectif",
      libelle: "Effectif",
      valeur: true,
      rendu: (e) => `${e.effectif} agent(s)`,
    },
    {
      cle: "actif",
      libelle: "État",
      statut: true,
      rendu: (e) =>
        e.actif ? null : badgeStatut("i", { i: "neutre" }, "Inactif"),
    },
  ],
  champs: [
    { nom: "code", libelle: "Code", requis: true },
    { nom: "nom", libelle: "Nom", requis: true, large: true },
    {
      nom: "responsable",
      libelle: "Responsable",
      type: "liste",
      source: {
        chemin: "/organisation/agents",
        libelle: "nom_complet",
        vide: "Aucun",
      },
    },
    { nom: "actif", libelle: "Département actif", type: "booleen", defaut: "true" },
  ],
});

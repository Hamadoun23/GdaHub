/**
 * Les écrans d'administration des Ressources humaines.
 *
 * Les quatre gestes de l'agent — congé, permission, retard, décision — restent
 * écrits à la main dans la page : ils passent par le circuit de validation.
 * Ce qui suit est le métier du service RH lui-même : la présence, la carrière,
 * la formation, et les règles qui gouvernent tout cela.
 */

import { badgeStatut, type SpecRessource } from "@/composants/ressource";
import { date, heure, nombre } from "@/lib/format";

export const presences = (ecriture: boolean): SpecRessource => ({
  titre: "Feuille de présence",
  description:
    "Une journée validée en congé s'y inscrit toute seule : la ressaisir à la main la ferait compter deux fois.",
  chemin: "/rh/presences",
  recherche: true,
  ecriture,
  vide: "Aucune présence enregistrée.",
  colonnes: [
    { cle: "agent_nom", libelle: "Agent", principale: true },
    {
      cle: "date",
      libelle: "Jour",
      detail: true,
      rendu: (e) => date(e.date as string),
    },
    {
      cle: "heure_arrivee",
      libelle: "Horaires",
      detail: true,
      rendu: (e) =>
        e.heure_arrivee
          ? `${heure(e.heure_arrivee as string)} → ${heure(e.heure_depart as string)}`
          : "",
    },
    {
      cle: "heures_travaillees",
      libelle: "Travaillé",
      valeur: true,
      rendu: (e) =>
        Number(e.heures_travaillees) ? `${nombre(e.heures_travaillees as string)} h` : "",
    },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.statut,
          {
            PRESENT: "succes",
            TELETRAVAIL: "succes",
            RETARD: "alerte",
            ABSENT: "danger",
            CONGE: "info",
            MISSION: "info",
            REPOS: "neutre",
          },
          Number(e.retard_minutes)
            ? `${e.statut_libelle} · ${e.retard_minutes} min`
            : (e.statut_libelle as string),
        ),
    },
  ],
  champs: [
    { nom: "agent_identifiant", libelle: "Identifiant de l'agent", requis: true },
    { nom: "agent_nom", libelle: "Nom de l'agent", requis: true },
    { nom: "agent_departement_nom", libelle: "Département" },
    { nom: "date", libelle: "Jour", type: "date", requis: true },
    {
      nom: "statut",
      libelle: "Statut",
      type: "liste",
      defaut: "PRESENT",
      options: [
        { valeur: "PRESENT", libelle: "Présent" },
        { valeur: "RETARD", libelle: "En retard" },
        { valeur: "ABSENT", libelle: "Absent" },
        { valeur: "CONGE", libelle: "En congé" },
        { valeur: "MISSION", libelle: "En mission" },
        { valeur: "TELETRAVAIL", libelle: "Télétravail" },
        { valeur: "REPOS", libelle: "Repos / férié" },
      ],
    },
    { nom: "heure_arrivee", libelle: "Arrivée", type: "heure" },
    { nom: "heure_depart", libelle: "Départ", type: "heure" },
    { nom: "retard_minutes", libelle: "Retard (minutes)", type: "nombre", defaut: "0" },
    { nom: "commentaire", libelle: "Commentaire", type: "zone", large: true },
  ],
});

export const soldes = (ecriture: boolean): SpecRessource => ({
  titre: "Soldes de congés",
  description:
    "Les jours pris se décomptent à l'approbation des demandes : les corriger ici défait ce que le circuit a inscrit.",
  chemin: "/rh/soldes-conges",
  recherche: true,
  ecriture,
  vide: "Aucun solde ouvert.",
  colonnes: [
    { cle: "agent_nom", libelle: "Agent", principale: true },
    { cle: "agent_departement_nom", libelle: "Département", detail: true },
    {
      cle: "jours_acquis",
      libelle: "Acquis",
      detail: true,
      rendu: (e) =>
        `${nombre(e.jours_acquis as string)} acquis + ${nombre(e.jours_reportes as string)} reportés · ${nombre(e.jours_pris as string)} pris`,
    },
    {
      cle: "jours_restants",
      libelle: "Restants",
      valeur: true,
      rendu: (e) => `${nombre(e.jours_restants as string)} jour(s)`,
    },
    {
      cle: "annee",
      libelle: "Année",
      statut: true,
      rendu: (e) => badgeStatut("a", { a: "neutre" }, String(e.annee)),
    },
  ],
  champs: [
    { nom: "agent_identifiant", libelle: "Identifiant de l'agent", requis: true },
    { nom: "agent_nom", libelle: "Nom de l'agent", requis: true },
    { nom: "agent_departement_nom", libelle: "Département" },
    {
      nom: "annee",
      libelle: "Année",
      type: "nombre",
      requis: true,
      defaut: String(new Date().getFullYear()),
    },
    { nom: "jours_acquis", libelle: "Jours acquis", type: "nombre", defaut: "0" },
    { nom: "jours_reportes", libelle: "Jours reportés", type: "nombre", defaut: "0" },
    { nom: "jours_pris", libelle: "Jours déjà pris", type: "nombre", defaut: "0" },
  ],
});

// --- Évaluation ------------------------------------------------------------

export const campagnes = (ecriture: boolean): SpecRessource => ({
  titre: "Campagnes d'évaluation",
  chemin: "/rh/campagnes",
  ecriture,
  vide: "Aucune campagne ouverte.",
  colonnes: [
    { cle: "libelle", libelle: "Campagne", principale: true },
    {
      cle: "periode_debut",
      libelle: "Période évaluée",
      detail: true,
      rendu: (e) => `${date(e.periode_debut as string)} → ${date(e.periode_fin as string)}`,
    },
    {
      cle: "date_limite",
      libelle: "Limite",
      detail: true,
      rendu: (e) => (e.date_limite ? `à rendre avant le ${date(e.date_limite as string)}` : ""),
    },
    {
      cle: "criteres",
      libelle: "Critères",
      valeur: true,
      rendu: (e) => `${(e.criteres as unknown[])?.length ?? 0} critère(s)`,
    },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.statut,
          { PREPARATION: "neutre", OUVERTE: "succes", CLOTUREE: "info" },
          e.statut_libelle as string,
        ),
    },
  ],
  champs: [
    { nom: "libelle", libelle: "Libellé", requis: true, large: true },
    { nom: "periode_debut", libelle: "Début de période", type: "date", requis: true },
    { nom: "periode_fin", libelle: "Fin de période", type: "date", requis: true },
    { nom: "date_limite", libelle: "Date limite", type: "date" },
    {
      nom: "statut",
      libelle: "Statut",
      type: "liste",
      defaut: "PREPARATION",
      options: [
        { valeur: "PREPARATION", libelle: "En préparation" },
        { valeur: "OUVERTE", libelle: "Ouverte" },
        { valeur: "CLOTUREE", libelle: "Clôturée" },
      ],
    },
    { nom: "consignes", libelle: "Consignes", type: "zone", large: true },
  ],
});

export const criteres = (ecriture: boolean): SpecRessource => ({
  titre: "Critères",
  description: "Le poids pondère la note globale : deux critères à 50 comptent autant l'un que l'autre.",
  chemin: "/rh/criteres",
  ecriture,
  vide: "Aucun critère défini.",
  colonnes: [
    { cle: "libelle", libelle: "Critère", principale: true },
    { cle: "description", libelle: "Description", detail: true },
    {
      cle: "poids",
      libelle: "Poids",
      valeur: true,
      rendu: (e) => `${e.poids} %`,
    },
  ],
  champs: [
    {
      nom: "campagne",
      libelle: "Campagne",
      type: "liste",
      requis: true,
      source: { chemin: "/rh/campagnes", libelle: "libelle" },
    },
    { nom: "libelle", libelle: "Libellé", requis: true, large: true },
    { nom: "poids", libelle: "Poids", type: "nombre", defaut: "10" },
    { nom: "description", libelle: "Description", type: "zone", large: true },
  ],
});

export const evaluations = (ecriture: boolean): SpecRessource => ({
  titre: "Évaluations",
  description: "La note globale se calcule à partir des critères notés : elle ne se saisit pas.",
  chemin: "/rh/evaluations",
  recherche: true,
  ecriture,
  vide: "Aucune évaluation ouverte.",
  colonnes: [
    { cle: "agent_nom", libelle: "Agent", principale: true },
    { cle: "campagne_libelle", libelle: "Campagne", detail: true },
    {
      cle: "evaluateur_nom",
      libelle: "Évaluateur",
      detail: true,
      rendu: (e) => (e.evaluateur_nom as string) || "Non désigné",
    },
    {
      cle: "note_globale",
      libelle: "Note",
      valeur: true,
      rendu: (e) => (Number(e.note_globale) ? `${nombre(e.note_globale as string)} / 20` : "—"),
    },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.statut,
          {
            A_FAIRE: "neutre",
            AUTO_EVALUATION: "info",
            EVALUEE: "alerte",
            VALIDEE: "succes",
          },
          e.statut_libelle as string,
        ),
    },
  ],
  champs: [
    {
      nom: "campagne",
      libelle: "Campagne",
      type: "liste",
      requis: true,
      source: { chemin: "/rh/campagnes", libelle: "libelle" },
    },
    { nom: "agent_identifiant", libelle: "Identifiant de l'agent", requis: true },
    { nom: "agent_nom", libelle: "Nom de l'agent", requis: true },
    { nom: "agent_departement_nom", libelle: "Département" },
    { nom: "evaluateur_identifiant", libelle: "Identifiant de l'évaluateur" },
    { nom: "evaluateur_nom", libelle: "Nom de l'évaluateur" },
    {
      nom: "statut",
      libelle: "Statut",
      type: "liste",
      defaut: "A_FAIRE",
      options: [
        { valeur: "A_FAIRE", libelle: "À faire" },
        { valeur: "AUTO_EVALUATION", libelle: "Auto-évaluation en cours" },
        { valeur: "EVALUEE", libelle: "Évaluée par le responsable" },
        { valeur: "VALIDEE", libelle: "Validée RH" },
      ],
    },
    { nom: "date_entretien", libelle: "Date de l'entretien", type: "date" },
    { nom: "points_forts", libelle: "Points forts", type: "zone", large: true },
    { nom: "axes_amelioration", libelle: "Axes d'amélioration", type: "zone", large: true },
    { nom: "objectifs", libelle: "Objectifs", type: "zone", large: true },
    { nom: "commentaire_agent", libelle: "Commentaire de l'agent", type: "zone", large: true },
  ],
});

// --- Formation -------------------------------------------------------------

export const formations = (ecriture: boolean): SpecRessource => ({
  titre: "Formations",
  chemin: "/rh/formations",
  recherche: true,
  ecriture,
  vide: "Aucune formation programmée.",
  colonnes: [
    { cle: "titre", libelle: "Formation", principale: true },
    {
      cle: "formateur",
      libelle: "Animée par",
      detail: true,
      rendu: (e) => [e.formateur, e.organisme, e.lieu].filter(Boolean).join(" · "),
    },
    {
      cle: "date_debut",
      libelle: "Dates",
      detail: true,
      rendu: (e) => `${date(e.date_debut as string)} → ${date(e.date_fin as string)}`,
    },
    {
      cle: "places_restantes",
      libelle: "Places",
      valeur: true,
      rendu: (e) => `${e.inscrits} inscrit(s) · ${e.places_restantes} place(s)`,
    },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.statut,
          {
            PLANIFIEE: "info",
            EN_COURS: "succes",
            TERMINEE: "neutre",
            ANNULEE: "danger",
          },
          e.obligatoire ? `${e.statut_libelle} · obligatoire` : (e.statut_libelle as string),
        ),
    },
  ],
  champs: [
    { nom: "titre", libelle: "Titre", requis: true, large: true },
    { nom: "categorie", libelle: "Catégorie" },
    { nom: "formateur", libelle: "Formateur" },
    { nom: "organisme", libelle: "Organisme" },
    { nom: "lieu", libelle: "Lieu" },
    { nom: "date_debut", libelle: "Début", type: "date", requis: true },
    { nom: "date_fin", libelle: "Fin", type: "date" },
    { nom: "places", libelle: "Places", type: "nombre", defaut: "0" },
    { nom: "obligatoire", libelle: "Formation obligatoire", type: "booleen" },
    {
      nom: "statut",
      libelle: "Statut",
      type: "liste",
      defaut: "PLANIFIEE",
      options: [
        { valeur: "PLANIFIEE", libelle: "Planifiée" },
        { valeur: "EN_COURS", libelle: "En cours" },
        { valeur: "TERMINEE", libelle: "Terminée" },
        { valeur: "ANNULEE", libelle: "Annulée" },
      ],
    },
    { nom: "description", libelle: "Description", type: "zone", large: true },
  ],
});

export const inscriptions = (ecriture: boolean): SpecRessource => ({
  titre: "Inscriptions",
  description: "Une inscription refusée libère la place : le compteur de la formation la reprend.",
  chemin: "/rh/inscriptions",
  ecriture,
  vide: "Aucune inscription.",
  colonnes: [
    { cle: "agent_nom", libelle: "Agent", principale: true },
    { cle: "formation_titre", libelle: "Formation", detail: true },
    { cle: "commentaire", libelle: "Commentaire", detail: true },
    {
      cle: "note_satisfaction",
      libelle: "Satisfaction",
      valeur: true,
      rendu: (e) => (e.note_satisfaction ? `${e.note_satisfaction} / 5` : ""),
    },
    {
      cle: "statut",
      libelle: "Statut",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.statut,
          {
            DEMANDE: "info",
            CONFIRME: "succes",
            REFUSE: "danger",
            PRESENT: "succes",
            ABSENT: "alerte",
          },
          e.statut_libelle as string,
        ),
    },
  ],
  champs: [
    {
      nom: "formation",
      libelle: "Formation",
      type: "liste",
      requis: true,
      source: { chemin: "/rh/formations", libelle: "titre" },
    },
    {
      nom: "statut",
      libelle: "Statut",
      type: "liste",
      defaut: "DEMANDE",
      options: [
        { valeur: "DEMANDE", libelle: "Demandée" },
        { valeur: "CONFIRME", libelle: "Confirmée" },
        { valeur: "REFUSE", libelle: "Refusée" },
        { valeur: "PRESENT", libelle: "Présence confirmée" },
        { valeur: "ABSENT", libelle: "Absent" },
      ],
    },
    { nom: "note_satisfaction", libelle: "Satisfaction (sur 5)", type: "nombre" },
    { nom: "commentaire", libelle: "Commentaire", type: "zone", large: true },
  ],
});

// --- Référentiels ----------------------------------------------------------

export const typesAbsence = (ecriture: boolean): SpecRessource => ({
  titre: "Types d'absence",
  description:
    "C'est le type qui décide si l'absence entame le solde de congés, combien de jours elle peut durer, et si un justificatif est exigé.",
  chemin: "/rh/types-absence",
  ecriture,
  vide: "Aucun type d'absence.",
  colonnes: [
    { cle: "libelle", libelle: "Type", principale: true },
    {
      cle: "decompte_solde",
      libelle: "Règles",
      detail: true,
      rendu: (e) =>
        [
          e.decompte_solde ? "décompte le solde" : "sans effet sur le solde",
          e.duree_max_jours ? `${e.duree_max_jours} jour(s) au plus` : "durée libre",
          e.justificatif_requis ? "justificatif exigé" : "sans justificatif",
        ].join(" · "),
    },
    { cle: "code", libelle: "Code", valeur: true },
    {
      cle: "categorie",
      libelle: "Catégorie",
      statut: true,
      rendu: (e) =>
        badgeStatut(
          e.categorie,
          { CONGE: "info", ABSENCE: "alerte", RETARD: "danger", PERMISSION: "succes" },
          e.actif ? (e.categorie_libelle as string) : `${e.categorie_libelle} (inactif)`,
        ),
    },
  ],
  champs: [
    { nom: "code", libelle: "Code", requis: true },
    { nom: "libelle", libelle: "Libellé", requis: true, large: true },
    {
      nom: "categorie",
      libelle: "Catégorie",
      type: "liste",
      requis: true,
      defaut: "CONGE",
      options: [
        { valeur: "CONGE", libelle: "Congé" },
        { valeur: "ABSENCE", libelle: "Absence" },
        { valeur: "RETARD", libelle: "Retard" },
        { valeur: "PERMISSION", libelle: "Permission" },
      ],
    },
    {
      nom: "decompte_solde",
      libelle: "Entame le solde de congés",
      type: "booleen",
      aide: "Une permission ne devrait pas décompter : c'est ce qui la distingue d'un congé.",
    },
    {
      nom: "duree_max_jours",
      libelle: "Durée maximale (jours)",
      type: "nombre",
      aide: "Laisser vide pour une durée libre.",
    },
    { nom: "justificatif_requis", libelle: "Justificatif exigé", type: "booleen" },
    { nom: "actif", libelle: "Type actif", type: "booleen", defaut: "true" },
  ],
});

export const circuits = (ecriture: boolean): SpecRessource => ({
  titre: "Règles de circuit",
  description:
    "Le parcours d'une demande d'absence. Modifier une règle ne touche pas aux dossiers déjà lancés : leur circuit a été figé à la soumission.",
  chemin: "/rh/circuits",
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
      defaut: "ABSENCE",
      options: [
        { valeur: "TOUS", libelle: "Tous les documents" },
        { valeur: "ABSENCE", libelle: "Demande d'absence / congé" },
      ],
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
    {
      nom: "role_valideur",
      libelle: "Rôle attendu",
      aide: "Code de rôle sur rh : gestionnaire, direction...",
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

/**
 * Les formes que le socle Django renvoie, quel que soit le service.
 *
 * Tout document validable de l'ERP — congé, dépense, mission, bon de commande
 * — porte ces champs. C'est ce qui permet d'écrire une seule fois l'affichage
 * d'un circuit et les actions de circulation.
 */

export type Statut =
  | "BROUILLON"
  | "SOUMIS"
  | "EN_VALIDATION"
  | "APPROUVE"
  | "REJETE"
  | "ANNULE"
  | "CLOTURE";

export type Nature = "DECISION" | "AVIS" | "INFORMATION";

export type DecisionEtape = "EN_ATTENTE" | "APPROUVE" | "REJETE" | "IGNORE";

export type Etape = {
  id: number;
  ordre: number;
  libelle: string;
  role_valideur: string;
  valideur_identifiant: string;
  valideur_nom: string;
  nature: Nature;
  nature_libelle: string;
  decision: DecisionEtape;
  decision_libelle: string;
  decide_par_identifiant: string;
  decide_par_nom: string;
  date_decision: string | null;
  commentaire: string;
};

export type DocumentValidable = {
  id: number;
  numero: string;
  statut: Statut;
  statut_libelle: string;
  motif_rejet: string;
  date_soumission: string | null;
  etape_courante_libelle: string;
  etapes: Etape[];
  modifiable: boolean;
  verrou_motif: string;
  cree_le: string;
  demandeur_identifiant: string;
  demandeur_nom: string;
  demandeur_departement_id: number | null;
  demandeur_departement_nom: string;
  responsable_identifiant: string;
  responsable_nom: string;
};

// --- Organisation ------------------------------------------------------------

export type Agent = {
  id: number;
  identifiant: string;
  matricule: string;
  prenom: string;
  nom: string;
  nom_complet: string;
  email: string;
  telephone: string;
  poste: string;
  departement: number | null;
  departement_nom: string;
  responsable: number | null;
  responsable_nom: string;
  type_contrat: string;
  type_contrat_libelle: string;
  date_embauche: string | null;
  date_sortie: string | null;
  anciennete_mois: number;
  est_encadrant: boolean;
  a_un_compte: boolean;
  actif: boolean;
};

export type Departement = {
  id: number;
  code: string;
  nom: string;
  responsable: number | null;
  responsable_nom: string;
  effectif: number;
  actif: boolean;
};

export type NoeudOrganigramme = {
  agent_id: number;
  compte_id: number | null;
  identifiant: string;
  matricule: string;
  nom_complet: string;
  poste: string;
  departement_id: number | null;
  departement_nom: string;
  equipe: NoeudOrganigramme[];
};

// --- Ressources humaines -----------------------------------------------------

export type TypeAbsence = {
  id: number;
  code: string;
  libelle: string;
  categorie: "CONGE" | "ABSENCE" | "RETARD" | "PERMISSION";
  categorie_libelle: string;
  decompte_solde: boolean;
  duree_max_jours: number | null;
  justificatif_requis: boolean;
  actif: boolean;
};

export type SoldeConge = {
  id: number;
  agent_identifiant: string;
  agent_nom: string;
  annee: number;
  jours_acquis: string;
  jours_reportes: string;
  jours_pris: string;
  jours_restants: string;
};

export type DemandeAbsence = DocumentValidable & {
  type_absence: string;
  type_absence_libelle: string;
  categorie: string;
  date_debut: string;
  date_fin: string;
  demi_journee: boolean;
  heure_debut: string | null;
  heure_fin: string | null;
  nb_jours: string;
  motif: string;
  justificatif: string | null;
};

export type Presence = {
  id: number;
  agent_identifiant: string;
  agent_nom: string;
  date: string;
  heure_arrivee: string | null;
  heure_depart: string | null;
  statut: string;
  statut_libelle: string;
  retard_minutes: number;
  heures_travaillees: string;
  commentaire: string;
};

export type Formation = {
  id: number;
  titre: string;
  categorie: string;
  organisme: string;
  formateur: string;
  lieu: string;
  date_debut: string;
  date_fin: string;
  places: number;
  places_restantes: number;
  obligatoire: boolean;
  statut: string;
  statut_libelle: string;
  inscrits: number;
};

// --- Finance -----------------------------------------------------------------

export type Fournisseur = {
  id: number;
  code: string;
  raison_sociale: string;
  categorie: string;
  contact: string;
  telephone: string;
  email: string;
  actif: boolean;
};

export type CategorieDepense = {
  id: number;
  code: string;
  libelle: string;
  imputation: string;
  actif: boolean;
};

export type Depense = DocumentValidable & {
  categorie: number;
  categorie_libelle: string;
  fournisseur: number | null;
  fournisseur_nom: string;
  libelle: string;
  description: string;
  montant: string;
  devise: string;
  date_depense: string;
  mode_paiement: string;
  mode_paiement_libelle: string;
  reference_paiement: string;
};

export type LigneRequisition = {
  id: number;
  requisition: number;
  designation: string;
  quantite: string;
  unite: string;
  prix_unitaire: string;
  montant: string;
};

export type Requisition = DocumentValidable & {
  objet: string;
  justification: string;
  date_besoin: string | null;
  priorite: string;
  priorite_libelle: string;
  montant: string;
  devise: string;
  departement_nom: string;
  lignes: LigneRequisition[];
};

export type Caisse = {
  id: number;
  code: string;
  libelle: string;
  responsable_nom: string;
  devise: string;
  solde_initial: string;
  plafond_alerte: string;
  solde_actuel: string;
  total_approvisionne: string;
  total_decaisse: string;
  sous_alerte: boolean;
  actif: boolean;
};

export type Mission = DocumentValidable & {
  objet: string;
  destination: string;
  zone: string;
  zone_libelle: string;
  date_depart: string;
  date_retour: string;
  nb_jours: number;
  montant_perdiem: string;
  frais_transport: string;
  frais_hebergement: string;
  autres_frais: string;
  montant: string;
  devise: string;
  rapport: string;
};

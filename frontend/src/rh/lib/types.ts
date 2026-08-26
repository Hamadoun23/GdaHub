/** Types partages avec l'API Django (module accounts, rh, finance). */

/**
 * Les quatre profils. L'encadrement n'en est pas un : un salarie
 * encadre des lors que des agents lui sont rattaches.
 */
export type Role = "SALARIE" | "RH" | "FINANCE" | "DIRECTION";

export const ROLES_RH: Role[] = ["RH", "DIRECTION"];
export const ROLES_FINANCE: Role[] = ["FINANCE", "DIRECTION"];

export type StatutDocument =
  | "BROUILLON"
  | "SOUMIS"
  | "EN_VALIDATION"
  | "APPROUVE"
  | "REJETE"
  | "ANNULE"
  | "CLOTURE";

export interface Utilisateur {
  id: number;
  username: string;
  matricule: string;
  first_name: string;
  last_name: string;
  nom_complet: string;
  email: string;
  telephone: string;
  role: Role;
  role_libelle: string;
  poste: string;
  departement: number | null;
  departement_nom: string;
  manager: number | null;
  manager_nom: string;
  type_contrat: string;
  date_embauche: string | null;
  date_sortie: string | null;
  motif_sortie: string;
  anciennete_mois: number;
  /** Des agents lui sont rattaches : il valide leurs demandes. */
  est_encadrant: boolean;
  is_active: boolean;
}

export interface Departement {
  id: number;
  code: string;
  nom: string;
  responsable: number | null;
  responsable_nom: string;
  effectif: number;
}

export interface EtapeValidation {
  id: number;
  ordre: number;
  libelle: string;
  role_valideur: Role;
  role_valideur_libelle: string;
  valideur_attendu: number | null;
  valideur_attendu_nom: string;
  /** L'etape rend un avis : son refus n'arrete pas le dossier. */
  avis_consultatif: boolean;
  decision: "EN_ATTENTE" | "APPROUVE" | "REJETE" | "IGNORE";
  decision_libelle: string;
  decide_par_nom: string;
  date_decision: string | null;
  commentaire: string;
}

/** Champs communs a tout document circulant dans le workflow. */
export interface DocumentCirculant {
  id: number;
  numero: string;
  demandeur: number;
  demandeur_nom: string;
  /** Departement du demandeur : sert a classer les files des decideurs. */
  demandeur_departement: number | null;
  demandeur_departement_nom: string;
  statut: StatutDocument;
  statut_libelle: string;
  motif_rejet: string;
  date_soumission: string | null;
  etape_courante_libelle: string;
  etapes: EtapeValidation[];
  /**
   * Le demandeur peut-il encore corriger ou retirer son dossier ? Faux des
   * qu'un responsable s'est prononce. C'est l'API qui tranche : elle seule
   * sait distinguer une etape decidee d'une etape pour information.
   */
  modifiable: boolean;
  /** Phrase a montrer quand `modifiable` est faux. Vide sinon. */
  verrou_motif: string;
  cree_le: string;
}

export interface ReponsePaginee<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// --- Ressources humaines ---------------------------------------------------

export interface TypeAbsence {
  id: number;
  code: string;
  libelle: string;
  categorie: "CONGE" | "ABSENCE" | "RETARD" | "PERMISSION";
  categorie_libelle: string;
  decompte_solde: boolean;
  duree_max_jours: number | null;
  justificatif_requis: boolean;
  actif: boolean;
}

export interface SoldeConge {
  id: number;
  agent: number;
  agent_nom: string;
  annee: number;
  jours_acquis: string;
  jours_reportes: string;
  jours_pris: string;
  jours_restants: string;
}

export interface DemandeAbsence extends DocumentCirculant {
  /** Libelle saisi librement par le demandeur, pas un identifiant. */
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
  remplacant: number | null;
  remplacant_nom: string;
}

export interface Presence {
  id: number;
  agent: number;
  agent_nom: string;
  date: string;
  heure_arrivee: string | null;
  heure_depart: string | null;
  statut: string;
  statut_libelle: string;
  retard_minutes: number;
  heures_travaillees: string;
  commentaire: string;
}

export interface CritereEvaluation {
  id: number;
  campagne: number;
  libelle: string;
  description: string;
  poids: number;
}

export interface CampagneEvaluation {
  id: number;
  libelle: string;
  periode_debut: string;
  periode_fin: string;
  date_limite: string | null;
  statut: string;
  statut_libelle: string;
  consignes: string;
  criteres: CritereEvaluation[];
  nb_evaluations?: number;
}

export interface NoteCritere {
  id: number;
  critere: number;
  critere_libelle: string;
  poids: number;
  note: string;
  commentaire: string;
}

export interface Evaluation {
  id: number;
  campagne: number;
  campagne_libelle: string;
  agent: number;
  agent_nom: string;
  evaluateur: number | null;
  evaluateur_nom: string;
  statut: string;
  statut_libelle: string;
  note_globale: string | null;
  points_forts: string;
  axes_amelioration: string;
  objectifs: string;
  commentaire_agent: string;
  date_entretien: string | null;
  notes: NoteCritere[];
}

export interface Formation {
  id: number;
  titre: string;
  categorie: string;
  description: string;
  formateur: string;
  organisme: string;
  lieu: string;
  date_debut: string;
  date_fin: string;
  places: number;
  places_restantes: number;
  nb_inscrits: number;
  inscrit: boolean;
  obligatoire: boolean;
  departements_cibles: number[];
  statut: string;
  statut_libelle: string;
}

export interface InscriptionFormation {
  id: number;
  formation: number;
  formation_titre: string;
  agent: number;
  agent_nom: string;
  statut: string;
  statut_libelle: string;
  note_satisfaction: number | null;
  commentaire: string;
  cree_le: string;
}

export interface IndicateursRH {
  annee: number;
  effectif: {
    actuel: number;
    entrees: number;
    sorties: number;
    par_departement: { departement__nom: string | null; total: number }[];
    par_contrat: { type_contrat: string; total: number }[];
  };
  turnover: {
    taux_pourcent: number;
    effectif_moyen: number;
    motifs: { motif_sortie: string; total: number }[];
  };
  absenteisme: {
    taux_pourcent: number;
    jours_absence: number;
    jours_retard: number;
    minutes_retard_cumulees: number;
  };
  demandes: {
    total: number;
    en_validation: number;
    approuvees: number;
    rejetees: number;
    par_categorie: {
      type_absence__categorie: string;
      total: number;
      jours: string;
    }[];
  };
  performance: { note_moyenne: number | null; evaluations_validees: number };
  formations: { planifiees: number; inscrits: number };
}

export interface LigneScoring {
  agent_id: number;
  matricule: string;
  nom: string;
  departement: string;
  assiduite: number;
  ponctualite: number;
  performance: number;
  jours_absence: number;
  retards: number;
  note_evaluation: number | null;
  score: number;
}

// --- Finance ---------------------------------------------------------------

export type TypeDocumentSeuil =
  | "TOUS"
  | "REQUISITION"
  | "SORTIE_CAISSE"
  | "DEPENSE"
  | "MISSION"
  | "PRESTATION"
  | "BON_COMMANDE"
  | "FORFAIT_COM"
  | "ABSENCE";

export interface SeuilValidation {
  id: number;
  libelle: string;
  type_document: TypeDocumentSeuil;
  type_document_libelle: string;
  montant_min: string;
  montant_max: string | null;
  role_valideur: Role;
  role_valideur_libelle: string;
  ordre: number;
  valideur_hierarchique: boolean;
  actif: boolean;
}

export interface Fournisseur {
  id: number;
  code: string;
  raison_sociale: string;
  categorie: string;
  contact: string;
  telephone: string;
  email: string;
  adresse: string;
  numero_fiscal: string;
  actif: boolean;
}

export interface CategorieDepense {
  id: number;
  code: string;
  libelle: string;
  imputation: string;
  actif: boolean;
}

export interface LigneRequisition {
  id?: number;
  designation: string;
  quantite: string;
  unite: string;
  prix_unitaire: string;
  montant?: string;
}

export interface Requisition extends DocumentCirculant {
  objet: string;
  departement: number | null;
  departement_nom: string;
  justification: string;
  date_besoin: string | null;
  priorite: "BASSE" | "NORMALE" | "HAUTE" | "URGENTE";
  priorite_libelle: string;
  montant: string;
  devise: string;
  lignes: LigneRequisition[];
}

export interface OffreFournisseur {
  id: number;
  demande_prix: number;
  fournisseur: number;
  fournisseur_nom: string;
  montant: string;
  devise: string;
  delai_livraison_jours: number;
  conditions_paiement: string;
  note_technique: number;
  retenue: boolean;
  commentaire: string;
}

export interface DemandePrix {
  id: number;
  numero: string;
  requisition: number | null;
  requisition_numero: string;
  objet: string;
  description: string;
  date_lancement: string | null;
  date_limite: string | null;
  critere_attribution: string;
  statut: string;
  statut_libelle: string;
  acheteur: number | null;
  acheteur_nom: string;
  offres: OffreFournisseur[];
  montant_retenu: string | null;
  cree_le: string;
}

export interface BonCommande extends DocumentCirculant {
  requisition: number | null;
  requisition_numero: string;
  fournisseur: number;
  fournisseur_nom: string;
  objet: string;
  montant: string;
  devise: string;
  date_livraison_prevue: string | null;
  date_livraison_reelle: string | null;
  conditions: string;
}

export interface Caisse {
  id: number;
  code: string;
  libelle: string;
  responsable: number | null;
  responsable_nom: string;
  devise: string;
  solde_initial: string;
  plafond_alerte: string;
  total_approvisionne: string;
  total_decaisse: string;
  solde_actuel: string;
  sous_alerte: boolean;
  actif: boolean;
}

export interface SortieCaisse extends DocumentCirculant {
  caisse: number;
  caisse_libelle: string;
  categorie: number | null;
  categorie_libelle: string;
  beneficiaire: string;
  beneficiaire_agent: number | null;
  motif: string;
  montant: string;
  devise: string;
  date_sortie: string;
  piece_justificative: string | null;
  date_decaissement: string | null;
}

export interface Depense extends DocumentCirculant {
  categorie: number;
  categorie_libelle: string;
  departement: number | null;
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
  piece_justificative: string | null;
}

export interface BaremePerdiem {
  id: number;
  libelle: string;
  zone: string;
  zone_libelle: string;
  role_agent: string;
  montant_jour: string;
  devise: string;
  actif: boolean;
}

export interface LigneFraisMission {
  id: number;
  mission: number;
  libelle: string;
  categorie: number | null;
  categorie_libelle: string;
  montant: string;
  date_depense: string;
  justificatif: string | null;
  valide: boolean;
}

export interface Mission extends DocumentCirculant {
  objet: string;
  destination: string;
  zone: string;
  zone_libelle: string;
  date_depart: string;
  date_retour: string;
  moyen_transport: string;
  participants: number[];
  bareme: number | null;
  bareme_libelle: string;
  nb_jours: number;
  montant_perdiem: string;
  frais_transport: string;
  frais_hebergement: string;
  autres_frais: string;
  montant: string;
  devise: string;
  rapport: string;
  date_rapport: string | null;
  frais: LigneFraisMission[];
  total_frais_justifies: string;
}

export interface Prestation extends DocumentCirculant {
  prestataire: number;
  prestataire_nom: string;
  objet: string;
  description: string;
  date_debut: string;
  date_fin: string | null;
  montant: string;
  devise: string;
  livrables: string;
  taux_execution: number;
}

export interface ConsommationCommunication {
  id: number;
  forfait: number;
  agent_nom: string;
  mois: string;
  montant_consomme: string;
  depassement: string;
  commentaire: string;
}

export interface ForfaitCommunication {
  id: number;
  agent: number;
  agent_nom: string;
  departement_nom: string;
  operateur: string;
  numero_ligne: string;
  type_forfait: string;
  type_forfait_libelle: string;
  montant_mensuel: string;
  devise: string;
  date_debut: string;
  date_fin: string | null;
  actif: boolean;
  consommations: ConsommationCommunication[];
}

export interface StatistiqueFlux {
  total: number;
  en_validation: number;
  approuves: number;
  rejetes: number;
  montant_approuve: string;
  montant_en_attente: string;
}

export interface IndicateursFinance {
  annee: number;
  perimetre: "GLOBAL" | "PERSONNEL";
  total_engage: string;
  total_en_attente: string;
  flux: Record<string, StatistiqueFlux>;
  depenses_par_categorie: {
    categorie__libelle: string;
    total: string;
    nombre: number;
  }[];
  caisses?: {
    id: number;
    libelle: string;
    solde_actuel: string;
    sous_alerte: boolean;
  }[];
  communication?: {
    forfaits_actifs: number;
    budget_mensuel: string;
    consomme_annee: string;
  };
  achats?: { demandes_prix_ouvertes: number; fournisseurs_actifs: number };
}

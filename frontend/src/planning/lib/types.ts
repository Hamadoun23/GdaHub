/** Types du service Planning, calques sur les serialiseurs Django reels. */

export type Page<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type StatutEvenement = "pending" | "completed" | "cancelled" | "not_realized" | "rescheduled";

export type ClientPlanning = {
  id: number;
  nom_entreprise: string;
  created_at: string;
  tournages_count: number;
  publications_count: number;
};

export type TypeIdee = "vidéo" | "image" | "texte";

export type IdeeContenu = {
  id: number;
  titre: string;
  type: TypeIdee;
  created_at: string;
};

export type Tournage = {
  id: number;
  client: number;
  client_nom: string;
  date: string;
  status: StatutEvenement;
  status_reason: string | null;
  description: string | null;
  content_ideas_detail: IdeeContenu[];
  created_at: string;
  is_overdue: boolean;
  is_upcoming: boolean;
  requires_action: boolean;
};

export type Publication = {
  id: number;
  client: number;
  client_nom: string;
  date: string;
  content_idea: number | null;
  content_idea_detail: IdeeContenu | null;
  shooting: number | null;
  shooting_date: string | null;
  status: StatutEvenement;
  status_reason: string | null;
  description: string | null;
  created_at: string;
  is_overdue: boolean;
  is_upcoming: boolean;
  requires_action: boolean;
  day_not_recommended_warning: string | null;
  avertissements?: string[];
};

export const JOURS_SEMAINE = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;
export type JourSemaine = (typeof JOURS_SEMAINE)[number];

export type RegleePublication = {
  id: number;
  client: number;
  day_of_week: JourSemaine;
  day_of_week_libelle: string;
};

export type RapportClient = {
  id: number;
  client: number;
  report_type: "monthly" | "annual";
  report_type_libelle: string;
  report_date: string;
  file_url: string;
  original_filename: string;
  file_size: number;
  uploaded_at: string;
};

export type JourCalendrier = {
  date: string;
  est_mois_courant: boolean;
  tournages: Tournage[];
  publications: Publication[];
  avertissement: boolean;
};

export type Grille = JourCalendrier[][];

export type PeriodeStats = {
  total_shootings: number;
  total_publications: number;
  pending_shootings: number;
  completed_shootings: number;
  cancelled_shootings: number;
  non_realises_shootings: number;
  pending_publications: number;
  completed_publications: number;
  cancelled_publications: number;
  non_realises_publications: number;
  publication_rules: number;
};

export type CalendrierClient = {
  client: ClientPlanning;
  mois: number;
  annee: number;
  calendrier: Grille;
  stats: PeriodeStats;
  tournages_a_venir: Tournage[];
  publications_a_venir: Publication[];
  tournages_recents: Tournage[];
  publications_recentes: Publication[];
  rapports_mensuels: RapportClient[];
  rapports_annuels: RapportClient[];
  lecture_seule: boolean;
};

export type TableauDeBord = {
  mois: number;
  annee: number;
  calendrier: Grille;
  stats: {
    clients_count: number;
    shootings_this_month: number;
    publications_this_month: number;
  };
  tournages_en_retard: Tournage[];
  publications_en_retard: Publication[];
  tournages_a_venir: Tournage[];
  publications_a_venir: Publication[];
};

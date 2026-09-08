/** Types du service Chantiers, calques sur les serialiseurs Django reels. */

export type StatutProjet = "planifie" | "en_cours" | "termine" | "suspendu";
export type StatutTache = "non_demarre" | "en_cours" | "termine" | "annule";

export type Page<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type Projet = {
  id: number;
  name: string;
  description: string | null;
  client: string;
  start_date: string | null;
  end_date: string | null;
  status: StatutProjet;
  status_display: string;
  sort_order: number;
  user_ids: number[];
  user_names: Record<string, string>;
  overall_progress: number;
  progress_by_phase: Record<string, number>;
  tasks_count: number;
  created_at: string;
  updated_at: string;
};

export type Phase = {
  id: number;
  projet: number;
  name: string;
  sort_order: number;
  hidden_from_partner: boolean;
};

export type SousPhase = {
  id: number;
  phase: number;
  name: string;
  sort_order: number;
  hidden_from_partner: boolean;
};

export type NoteProgression = {
  id: number;
  tache: number;
  user_id: number | null;
  user_name?: string;
  daily_update_id: number | null;
  progress: number;
  previous_progress: number;
  body: string;
  created_at?: string;
};

export type Tache = {
  id: number;
  sous_phase_id: number;
  phase_id: number;
  phase: string;
  subphase: string;
  activity: string;
  start_day: number;
  duration_days: number;
  sort_order: number;
  hidden_from_partner: boolean;
  progress: number;
  status: StatutTache;
  status_label: string;
  status_comment: string | null;
  progress_notes_count: number;
  progress_notes: NoteProgression[];
};

export type MiseAJour = {
  id: number;
  tache: number;
  task_id: number;
  user_id: number | null;
  user_name: string;
  report_date: string;
  progress: number;
  status: StatutTache;
  status_label: string;
  comment: string;
};

export type Photo = {
  id: number;
  projet: number;
  user_id: number | null;
  user_name: string;
  category: "avant" | "pendant" | "apres" | "securite" | "qualite";
  category_display: string;
  file: string | null;
  url: string;
  original_name: string;
  caption: string;
  taken_at: string | null;
  file_size: number;
  created_at: string;
};

export type Rapport = {
  id: number;
  projet: number;
  user_id: number | null;
  user_name: string;
  report_date: string;
  temperature: string | null;
  weather: string;
  page_number: string;
  overall_progress: number;
  notes: string | null;
  generated_at: string;
};

export type Activite = {
  id: number;
  phase: string;
  subphase: string;
  activity: string;
  progress: number;
  status: StatutTache;
};

export type ActiviteRecente = {
  task_id: number;
  task_name: string;
  progress: number;
  status: StatutTache;
  comment: string | null;
  date: string;
  user: string;
};

export type TableauDeBord = {
  project: { id: number; name: string; client: string };
  overall_progress: number;
  stats: {
    total: number;
    done: number;
    in_progress: number;
    not_started: number;
    cancelled: number;
  };
  status_counts: Record<string, number>;
  progress_by_phase: { phase: string; progress: number; task_count: number }[];
  activities: Activite[];
  recent_activity: ActiviteRecente[];
  charts?: {
    status_counts: Record<string, number>;
    progress_by_phase: { phase: string; progress: number; task_count: number }[];
    progress_by_subphase: { subphase: string; progress: number; task_count: number }[];
    activities_chart: Activite[];
  };
};

export type EntreeJournal = {
  id: number;
  action: string;
  description: string;
  user_name: string;
  project_id: number | null;
  ip_address: string | null;
  created_at: string;
};

export type JournalActivite = {
  logs: EntreeJournal[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
  filters: { actions: string[] };
};

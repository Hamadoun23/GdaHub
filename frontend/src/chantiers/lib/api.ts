/**
 * Client HTTP du service Chantiers.
 *
 * Aucun jeton ne circule ici, et c'est voulu. Le cookie pose par identity a
 * la connexion accompagne deja tout appel de meme origine ; la passerelle le
 * convertit en en-tete Authorization avant de le transmettre au service (cf.
 * gateway/nginx.conf). Tant que la session du hub est active — et elle se
 * renouvelle seule depuis la racine de l'application, cf. lib/session.tsx —
 * un simple `fetch` suffit.
 */
import type {
  Activite,
  JournalActivite,
  MiseAJour,
  Page,
  Phase,
  Photo,
  Projet,
  Rapport,
  SousPhase,
  Tache,
  TableauDeBord,
} from "./types";

const BASE = "/api/chantiers";

export class ErreurChantiers extends Error {
  statut: number;
  details: unknown;

  constructor(statut: number, details: unknown) {
    super(
      typeof details === "object" && details && "detail" in details
        ? String((details as { detail: unknown }).detail)
        : "La requete a echoue.",
    );
    this.statut = statut;
    this.details = details;
  }
}

type Options = {
  methode?: string;
  corps?: unknown;
  /** Le projet dans le perimetre duquel l'appel se place (cf. active_project cote Django). */
  projetId?: number;
};

async function appeler<T>(chemin: string, options: Options = {}): Promise<T> {
  const { methode = "GET", corps, projetId } = options;
  const estFormulaire = typeof FormData !== "undefined" && corps instanceof FormData;

  const entetes: Record<string, string> = {};
  if (corps !== undefined && !estFormulaire) entetes["Content-Type"] = "application/json";
  if (projetId !== undefined) entetes["X-Project-Id"] = String(projetId);

  const reponse = await fetch(`${BASE}${chemin}`, {
    method: methode,
    headers: entetes,
    body: corps === undefined ? undefined : estFormulaire ? (corps as FormData) : JSON.stringify(corps),
  });

  if (reponse.status === 204) return undefined as T;

  const type = reponse.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    if (!reponse.ok) throw new ErreurChantiers(reponse.status, {});
    return undefined as T;
  }

  const donnees = await reponse.json();
  if (!reponse.ok) throw new ErreurChantiers(reponse.status, donnees);
  return donnees as T;
}

export const chantiers = {
  // --- Projets -------------------------------------------------------------
  projets: () => appeler<Page<Projet>>("/projets/"),
  projet: (id: number) => appeler<Projet>(`/projets/${id}/`),
  creerProjet: (donnees: { name: string; client?: string; description?: string }) =>
    appeler<Projet>("/projets/", { methode: "POST", corps: donnees }),
  structureProjet: (id: number) =>
    appeler<{
      id: number;
      name: string;
      phases: {
        id: number;
        name: string;
        sort_order: number;
        hidden_from_partner: boolean;
        sub_phases: {
          id: number;
          name: string;
          sort_order: number;
          hidden_from_partner: boolean;
          tasks: Tache[];
        }[];
      }[];
    }>(`/projets/${id}/structure/`),

  // --- Structure : phases, sous-phases, taches ------------------------------
  creerPhase: (donnees: { projet: number; name: string }) =>
    appeler<Phase>("/phases/", { methode: "POST", corps: donnees }),
  creerSousPhase: (donnees: { phase: number; name: string }) =>
    appeler<SousPhase>("/sous-phases/", { methode: "POST", corps: donnees }),
  creerTache: (donnees: { sous_phase: number; activity: string; start_day?: number; duration_days?: number }) =>
    appeler<Tache>("/taches/", { methode: "POST", corps: donnees }),
  taches: (projetId: number) => appeler<Page<Tache>>("/taches/", { projetId }),
  tacheDetail: (id: number, projetId: number) =>
    appeler<Tache & { daily_updates: MiseAJour[] }>(`/taches/${id}/detail-complete/`, { projetId }),

  // --- Saisie journaliere ----------------------------------------------------
  saisieDuJour: (projetId: number, date?: string) =>
    appeler<{
      date: string;
      items: { task: Tache; daily_update: MiseAJour | null; effective_progress: number; effective_status: string }[];
    }>(`/mises-a-jour/daily/${date ? `?date=${date}` : ""}`, { projetId }),
  enregistrerAvancee: (
    projetId: number,
    donnees: { task_id: number; progress: number; status?: string; comment?: string; progress_note?: string; date?: string },
  ) => appeler<MiseAJour>("/mises-a-jour/", { methode: "POST", corps: donnees, projetId }),
  /** Enregistre plusieurs avancees en une fois — l'ecran de saisie du jour. */
  enregistrerLot: (
    projetId: number,
    date: string,
    lignes: { task_id: number; progress: number; status?: string; comment?: string; progress_note?: string }[],
  ) =>
    appeler<{ created: MiseAJour[]; errors: { data: unknown; detail: string }[] }>("/mises-a-jour/batch/", {
      methode: "POST",
      corps: { date, updates: lignes },
      projetId,
    }),

  // --- Photos ------------------------------------------------------------------
  photos: (projetId: number) => appeler<Page<Photo>>("/photos/", { projetId }),
  televerserPhoto: (projetId: number, fichier: File, categorie: string, legende?: string) => {
    const formulaire = new FormData();
    formulaire.append("file", fichier);
    formulaire.append("category", categorie);
    if (legende) formulaire.append("caption", legende);
    return appeler<Photo>("/photos/", { methode: "POST", corps: formulaire, projetId });
  },
  supprimerPhoto: (id: number, projetId: number) =>
    appeler<void>(`/photos/${id}/`, { methode: "DELETE", projetId }),

  // --- Rapports ------------------------------------------------------------------
  rapports: (projetId: number) => appeler<Page<Rapport>>("/rapports/", { projetId }),
  genererRapport: (projetId: number, donnees: { weather?: string; temperature?: number; notes?: string }) =>
    appeler<{ report: Rapport; statistics: Record<string, number>; tasks: Activite[] }>(
      "/rapports/generate/",
      { methode: "POST", corps: donnees, projetId },
    ),
  urlRapportPdf: (id: number) => `${BASE}/rapports/${id}/pdf/`,

  // --- Tableau de bord ------------------------------------------------------------------
  tableauDeBord: (projetId: number) => appeler<TableauDeBord>("/dashboard/", { projetId }),
  urlExportExcel: () => `${BASE}/dashboard/export/`,

  // --- Journal d'activite ------------------------------------------------------------------
  journal: (
    params: { projetId?: number; page?: number; q?: string; action?: string; du?: string; au?: string } = {},
  ) => {
    const recherche = new URLSearchParams();
    if (params.projetId) recherche.set("project_id", String(params.projetId));
    if (params.page) recherche.set("page", String(params.page));
    if (params.q) recherche.set("q", params.q);
    if (params.action) recherche.set("action", params.action);
    if (params.du) recherche.set("from", params.du);
    if (params.au) recherche.set("to", params.au);
    const suffixe = recherche.toString();
    return appeler<JournalActivite>(`/activity-logs/${suffixe ? `?${suffixe}` : ""}`);
  },

  // --- Meteo ------------------------------------------------------------------
  meteo: (lat: number, lon: number) =>
    appeler<{
      current: { temperature_2m: number; weather_code: number };
      daily: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
      };
    }>(`/weather/?endpoint=forecast&lat=${lat}&lon=${lon}`),
  geocoder: (ville: string) =>
    appeler<{ results: { name: string; latitude: number; longitude: number; country: string }[] }>(
      `/weather/?endpoint=geocode&city=${encodeURIComponent(ville)}`,
    ),
};

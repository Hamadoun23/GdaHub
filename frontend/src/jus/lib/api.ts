// Client HTTP pour l'API REST Django (JusOrange).

export const API_BASE =
  process.env.NEXT_PUBLIC_API_JUS ?? "/api/jus";

const TOKEN_KEY = "jo_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  /** Erreurs rattachées à un champ précis du formulaire, ex. { qte_bon: "…" }. */
  fieldErrors: Record<string, string>;

  constructor(
    status: number,
    message: string,
    data?: unknown,
    fieldErrors: Record<string, string> = {}
  ) {
    super(message);
    this.status = status;
    this.data = data;
    this.fieldErrors = fieldErrors;
  }
}

// DRF renvoie les erreurs de validation sous la forme
// { champ: ["message"], non_field_errors: ["message"] }.
// Sans cette extraction, l'utilisateur ne verrait qu'un « Erreur 400 » opaque
// là où l'interface Django affiche le motif exact du refus.
function extractErrors(data: unknown): {
  message: string;
  fieldErrors: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};
  if (!data || typeof data !== "object") {
    return { message: typeof data === "string" ? data : "", fieldErrors };
  }

  const obj = data as Record<string, unknown>;
  if (typeof obj.detail === "string") {
    return { message: obj.detail, fieldErrors };
  }

  const globalMessages: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const text = Array.isArray(value) ? value.join(" ") : String(value);
    if (key === "non_field_errors" || key === "detail") globalMessages.push(text);
    else fieldErrors[key] = text;
  }

  // Le message principal reprend l'erreur globale si elle existe, sinon la
  // première erreur de champ : il y a toujours quelque chose à afficher.
  const message =
    globalMessages[0] ?? Object.values(fieldErrors)[0] ?? "Erreur de validation";
  return { message, fieldErrors };
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Token ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const { message, fieldErrors } = extractErrors(data);
    throw new ApiError(
      res.status,
      message || `Erreur ${res.status}`,
      data,
      fieldErrors
    );
  }
  return data as T;
}

// --- Auth ---
export type AuthUser = {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
  roles: string[];
};

export async function login(username: string, password: string) {
  const data = await request<{ token: string; user: AuthUser }>(
    "/auth/login/",
    { method: "POST", body: JSON.stringify({ username, password }) }
  );
  setToken(data.token);
  return data;
}

export async function me() {
  return request<AuthUser>("/auth/me/");
}

// --- Listes paginées DRF ---
type Paginated<T> = { count: number; results: T[]; next: string | null };

const TAILLE_PAGE = 1000;
// Garde-fou : au-delà, on arrête de paginer plutôt que de figer le navigateur.
const MAX_PAGES = 20;

/**
 * Récupère la totalité d'une liste, en suivant la pagination DRF.
 *
 * Les vues font le tri et la recherche côté client : elles ont donc besoin de
 * l'ensemble des lignes. Une simple requête `?page_size=1000` tronquait
 * silencieusement les tables volumineuses (1 000 bouteilles affichées sur
 * 3 144, sans le moindre avertissement).
 */
export async function fetchList<T>(endpoint: string): Promise<T[]> {
  const lignes: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await request<Paginated<T> | T[]>(
      `/${endpoint}/?page_size=${TAILLE_PAGE}&page=${page}`
    );
    if (Array.isArray(data)) return data;
    lignes.push(...data.results);
    if (!data.next) break;
  }
  return lignes;
}

export async function createItem<T>(endpoint: string, body: unknown) {
  return request<T>(`/${endpoint}/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateItem<T>(
  endpoint: string,
  id: string | number,
  body: unknown
) {
  return request<T>(`/${endpoint}/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteItem(endpoint: string, id: string | number) {
  return request<void>(`/${endpoint}/${id}/`, { method: "DELETE" });
}

/**
 * Envoi multipart, pour les ressources qui portent un fichier (photo de
 * visite). On ne passe pas par `request` : celle-ci force
 * `Content-Type: application/json`, alors que le navigateur doit composer
 * lui-même l'en-tête `multipart/form-data` avec sa frontière (boundary).
 */
export async function envoyerFormData<T>(
  endpoint: string,
  form: FormData,
  { id, methode = "POST" }: { id?: string | number; methode?: "POST" | "PATCH" } = {}
): Promise<T> {
  const token = getToken();
  const chemin = id == null ? `/${endpoint}/` : `/${endpoint}/${id}/`;
  const res = await fetch(`${API_BASE}${chemin}`, {
    method: methode,
    headers: token ? { Authorization: `Token ${token}` } : {},
    body: form,
  });

  const texte = await res.text();
  let data: unknown = null;
  if (texte) {
    try {
      data = JSON.parse(texte);
    } catch {
      data = texte;
    }
  }
  if (!res.ok) {
    const { message, fieldErrors } = extractErrors(data);
    throw new ApiError(res.status, message || `Erreur ${res.status}`, data, fieldErrors);
  }
  return data as T;
}

/** Appelle une action métier d'un objet, ex. `completer` sur une production. */
export async function postAction<T>(
  endpoint: string,
  id: string | number,
  action: string,
  body: unknown = {}
) {
  return request<T>(`/${endpoint}/${id}/${action}/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// --- Options des listes déroulantes ---
export type Option = {
  value: string | number;
  label: string;
  [extra: string]: unknown;
};

export type FormOptions = Record<string, Option[]>;

/**
 * Valeurs proposées dans les listes déroulantes, filtrées côté serveur selon
 * les mêmes règles que les formulaires Django (une cueillette entièrement
 * réceptionnée n'apparaît plus, etc.).
 */
export async function fetchOptions(params: Record<string, string | number> = {}) {
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  return request<FormOptions>(`/options/${query ? `?${query}` : ""}`);
}

// --- Détail d'une facture (suivi du recouvrement) ---
export type Recouvrement = {
  statut: "SOLDEE" | "A_ECHOIR" | "RELANCE" | "RECOUVREMENT" | "SANS_ECHEANCE";
  libelle: string;
  action: string;
  jours: number | null;
  montant_attendu: number;
};

export type PaiementFacture = {
  id: number;
  date_paie: string;
  montant: number;
  mode_paie: string;
  mode_display: string;
  reference: string;
};

export type FactureDetail = {
  id: number;
  num_fact: string;
  client_nom: string;
  client_tel: string;
  client_email: string;
  vente_id: number;
  date_fact: string;
  date_echeance: string;
  montant: number;
  statut: string;
  statut_display: string;
  total_paye: number;
  reste_a_payer: number;
  jours_avant_echeance: number | null;
  recouvrement: Recouvrement;
  paiements: PaiementFacture[];
};

export async function fetchFacture(id: string | number) {
  return request<FactureDetail>(`/factures/${id}/`);
}

// --- Prospection (cartographie commerciale) ---
export type StatutProspection =
  | "PROSPECTE"
  | "INTERESSE"
  | "CLIENT"
  | "PARTENAIRE"
  | "A_RELANCER"
  | "REFUS";

export type PointVente = {
  id: number;
  nom: string;
  type_point: string;
  type_display: string;
  latitude: number;
  longitude: number;
  adresse: string;
  contact_nom: string;
  contact_tel: string;
  contact_email: string;
  statut: StatutProspection;
  statut_display: string;
  /** Couleur du marqueur, décidée par le serveur (source unique). */
  couleur: string;
  potentiel_ca: number;
  date_prochaine_relance: string | null;
  relance_en_retard: boolean;
  commercial: number | null;
  commercial_nom: string;
  client: number | null;
  client_nom: string | null;
  nb_visites: number;
  derniere_visite: string | null;
  photo_url: string | null;
  cree_le: string;
};

export type Visite = {
  id: number;
  point_vente: number;
  point_vente_nom: string;
  commercial: number | null;
  commercial_nom: string;
  date_visite: string;
  statut_constate: string;
  statut_display: string;
  compte_rendu: string;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type PointVenteDetail = PointVente & { visites: Visite[] };

export async function fetchPointVente(id: string | number) {
  return request<PointVenteDetail>(`/points-vente/${id}/`);
}

// --- Rapports détaillés ---
export type Periode = "semaine" | "mois" | "trimestre";

export type ParamsRapport = {
  periode?: Periode;
  date_debut?: string;
  date_fin?: string;
};

function queryRapport(params: ParamsRapport): string {
  const q = new URLSearchParams();
  // Des dates explicites prennent le pas sur la période prédéfinie.
  if (params.date_debut && params.date_fin) {
    q.set("date_debut", params.date_debut);
    q.set("date_fin", params.date_fin);
  } else if (params.periode) {
    q.set("periode", params.periode);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Rapport détaillé d'un module. Les chiffres proviennent des mêmes services
 * Django que les rapports HTML : aucune donnée n'est recalculée côté client.
 */
export async function fetchRapport(module: string, params: ParamsRapport = {}) {
  return request<Record<string, unknown>>(
    `/jus/reporting/${module}/${queryRapport(params)}`
  );
}

/**
 * Télécharge l'export Excel. On passe par fetch (et non un lien direct) car le
 * jeton d'authentification doit voyager dans un en-tête.
 */
export async function telechargerExportRapport(
  module: string,
  params: ParamsRapport = {}
) {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}/reporting/${module}/export/${queryRapport(params)}`,
    { headers: token ? { Authorization: `Token ${token}` } : {} }
  );
  if (!res.ok) {
    throw new ApiError(res.status, "Export impossible");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const nom =
    /filename="?([^"]+)"?/.exec(disposition)?.[1] ?? `rapport_${module}.xlsx`;

  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
}

// --- Trésorerie ---
export type LigneRapprochement = {
  paiement_id: number;
  date_paie: string;
  num_fact: string | null;
  client_nom: string | null;
  mode_paie: string;
  mode_display: string;
  montant_commercial: number;
  reception_id: number | null;
  montant_recu: number | null;
  date_reception: string | null;
  ecart: number | null;
  statut_reception: string;
  ecart_traite: boolean;
  observation: string;
};

/**
 * Rapprochement paiements déclarés / encaisses reçues. Contient aussi les
 * paiements sans réception (statut EN_ATTENTE) : ce sont ceux à traiter.
 */
export async function fetchRapprochementTresorerie() {
  return request<{
    lignes: LigneRapprochement[];
    totaux: {
      total_commercial: number;
      total_recu: number;
      ecart_global: number;
      nb_en_attente: number;
      nb_ecarts_non_traites: number;
    };
  }>("/tresorerie/rapprochement/");
}

export async function fetchSummary() {
  return request<{
    kpi: Record<string, number>;
    recolte_zone: { zone: string; tonnage: number }[];
    stock_articles: { article: string; stock: number; seuil: number }[];
    paiements_mode: { mode_paie: string; total: number }[];
  }>("/jus/reporting/summary/");
}

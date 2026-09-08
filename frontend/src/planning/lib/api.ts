/**
 * Client HTTP du service Planning.
 *
 * Meme principe que Chantiers (cf. [[erp-gda-hub]]) : le cookie du hub
 * accompagne deja toute requete de meme origine, la passerelle le convertit
 * en en-tete Authorization — aucun jeton a manipuler ici.
 */
import type {
  CalendrierClient,
  ClientPlanning,
  Grille,
  IdeeContenu,
  Page,
  Publication,
  RapportClient,
  RegleePublication,
  TableauDeBord,
  Tournage,
} from "./types";

const BASE = "/api/planning";

export class ErreurPlanning extends Error {
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

async function appeler<T>(
  chemin: string,
  options: { methode?: string; corps?: unknown } = {},
): Promise<T> {
  const { methode = "GET", corps } = options;
  const estFormulaire = typeof FormData !== "undefined" && corps instanceof FormData;

  const entetes: Record<string, string> = {};
  if (corps !== undefined && !estFormulaire) entetes["Content-Type"] = "application/json";

  const reponse = await fetch(`${BASE}${chemin}`, {
    method: methode,
    headers: entetes,
    body: corps === undefined ? undefined : estFormulaire ? (corps as FormData) : JSON.stringify(corps),
  });

  if (reponse.status === 204) return undefined as T;

  const type = reponse.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    if (!reponse.ok) throw new ErreurPlanning(reponse.status, {});
    return undefined as T;
  }

  const donnees = await reponse.json();
  if (!reponse.ok) throw new ErreurPlanning(reponse.status, donnees);
  return donnees as T;
}

function requeteMoisAnnee(mois: number, annee: number) {
  return `month=${mois}&year=${annee}`;
}

export const planning = {
  // --- Clients ---------------------------------------------------------------
  clients: (recherche = "") =>
    appeler<Page<ClientPlanning>>(`/clients/${recherche ? `?search=${encodeURIComponent(recherche)}` : ""}`),
  client: (id: number) => appeler<ClientPlanning>(`/clients/${id}/`),
  creerClient: (nom_entreprise: string) =>
    appeler<ClientPlanning>("/clients/", { methode: "POST", corps: { nom_entreprise } }),
  modifierClient: (id: number, nom_entreprise: string) =>
    appeler<ClientPlanning>(`/clients/${id}/`, { methode: "PATCH", corps: { nom_entreprise } }),
  supprimerClient: (id: number) => appeler<void>(`/clients/${id}/`, { methode: "DELETE" }),
  calendrierClient: (id: number, mois: number, annee: number) =>
    appeler<CalendrierClient>(`/clients/${id}/calendrier/?${requeteMoisAnnee(mois, annee)}`),
  urlRapportClientGenere: (id: number, type: "monthly" | "annual", mois: number, annee: number) =>
    `${BASE}/clients/${id}/rapport-genere/?type=${type}&${requeteMoisAnnee(mois, annee)}`,
  televerserRapport: (
    clientId: number,
    donnees: { report_type: "monthly" | "annual"; report_date: string; file: File },
  ) => {
    const formulaire = new FormData();
    formulaire.append("report_type", donnees.report_type);
    formulaire.append("report_date", donnees.report_date);
    formulaire.append("file", donnees.file);
    return appeler<RapportClient>(`/clients/${clientId}/rapports/`, { methode: "POST", corps: formulaire });
  },
  supprimerRapport: (clientId: number, rapportId: number) =>
    appeler<void>(`/clients/${clientId}/rapports/${rapportId}/`, { methode: "DELETE" }),
  urlTelechargerRapport: (clientId: number, rapportId: number) =>
    `${BASE}/clients/${clientId}/rapports/${rapportId}/`,

  // --- Regles de publication ---------------------------------------------------
  reglesClient: (clientId: number) =>
    appeler<Page<RegleePublication>>(`/regles-publication/?client=${clientId}`),
  creerRegle: (clientId: number, day_of_week: string) =>
    appeler<RegleePublication>("/regles-publication/", { methode: "POST", corps: { client: clientId, day_of_week } }),
  supprimerRegle: (id: number) => appeler<void>(`/regles-publication/${id}/`, { methode: "DELETE" }),

  // --- Idees de contenu ---------------------------------------------------------
  idees: (recherche = "") =>
    appeler<Page<IdeeContenu>>(`/idees-contenu/${recherche ? `?search=${encodeURIComponent(recherche)}` : ""}`),
  creerIdee: (donnees: { titre: string; type: string }) =>
    appeler<IdeeContenu>("/idees-contenu/", { methode: "POST", corps: donnees }),
  modifierIdee: (id: number, donnees: { titre: string; type: string }) =>
    appeler<IdeeContenu>(`/idees-contenu/${id}/`, { methode: "PATCH", corps: donnees }),
  supprimerIdee: (id: number) => appeler<void>(`/idees-contenu/${id}/`, { methode: "DELETE" }),

  // --- Tournages -----------------------------------------------------------------
  tournages: () => appeler<Page<Tournage>>("/tournages/"),
  tournage: (id: number) => appeler<Tournage>(`/tournages/${id}/`),
  calendrierTournages: (mois: number, annee: number) =>
    appeler<{ mois: number; annee: number; calendrier: Grille }>(`/tournages/calendrier/?${requeteMoisAnnee(mois, annee)}`),
  creerTournage: (donnees: { client: number; date: string; content_idea_ids?: number[]; description?: string }) =>
    appeler<Tournage>("/tournages/", { methode: "POST", corps: donnees }),
  modifierTournage: (
    id: number,
    donnees: { client: number; date: string; content_idea_ids?: number[]; description?: string },
  ) => appeler<Tournage>(`/tournages/${id}/`, { methode: "PUT", corps: donnees }),
  supprimerTournage: (id: number) => appeler<void>(`/tournages/${id}/`, { methode: "DELETE" }),
  changerStatutTournage: (id: number, donnees: { status: string; status_reason?: string; reschedule_date?: string }) =>
    appeler<Tournage>(`/tournages/${id}/statut/`, { methode: "POST", corps: donnees }),
  reprogrammerTournage: (id: number, new_date: string) =>
    appeler<Tournage>(`/tournages/${id}/reprogrammer/`, { methode: "POST", corps: { new_date } }),
  urlExportTournages: (mois: number, annee: number) => `${BASE}/tournages/export/?${requeteMoisAnnee(mois, annee)}`,

  // --- Publications ---------------------------------------------------------------
  publications: () => appeler<Page<Publication>>("/publications/"),
  publication: (id: number) => appeler<Publication>(`/publications/${id}/`),
  calendrierPublications: (mois: number, annee: number) =>
    appeler<{ mois: number; annee: number; calendrier: Grille }>(`/publications/calendrier/?${requeteMoisAnnee(mois, annee)}`),
  verifierDate: (clientId: number, date: string, exclure?: number) =>
    appeler<{ avertissements: string[] }>(
      `/publications/verifier-date/?client_id=${clientId}&date=${encodeURIComponent(date)}${exclure ? `&exclude=${exclure}` : ""}`,
    ),
  creerPublication: (donnees: { client: number; date: string; content_idea: number; shooting?: number | null; description?: string }) =>
    appeler<Publication>("/publications/", { methode: "POST", corps: donnees }),
  modifierPublication: (
    id: number,
    donnees: { client: number; date: string; content_idea: number; shooting?: number | null; description?: string },
  ) => appeler<Publication>(`/publications/${id}/`, { methode: "PUT", corps: donnees }),
  supprimerPublication: (id: number) => appeler<void>(`/publications/${id}/`, { methode: "DELETE" }),
  changerStatutPublication: (id: number, donnees: { status: string; status_reason?: string; reschedule_date?: string }) =>
    appeler<Publication>(`/publications/${id}/statut/`, { methode: "POST", corps: donnees }),
  reprogrammerPublication: (id: number, new_date: string) =>
    appeler<Publication>(`/publications/${id}/reprogrammer/`, { methode: "POST", corps: { new_date } }),
  urlExportPublications: (mois: number, annee: number) => `${BASE}/publications/export/?${requeteMoisAnnee(mois, annee)}`,

  // --- Tableau de bord ---------------------------------------------------------------
  tableauDeBord: (mois: number, annee: number) =>
    appeler<TableauDeBord>(`/tableau-de-bord/?${requeteMoisAnnee(mois, annee)}`),
  urlExportGlobal: (mois: number, annee: number) => `${BASE}/tableau-de-bord/export/?${requeteMoisAnnee(mois, annee)}`,
  urlRapportGlobal: (period: "weekly" | "monthly" | "annual", clientId: string | number = "all") =>
    `${BASE}/tableau-de-bord/rapport/?period=${period}&client_id=${clientId}`,
};

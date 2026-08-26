/**
 * Client HTTP de l'application GDA.
 *
 * Gere l'injection du jeton JWT, le rafraichissement transparent en cas
 * d'expiration, et la remontee des erreurs de validation Django REST sous une
 * forme exploitable par les formulaires.
 */

import type { ReponsePaginee } from "./types";

/**
 * L'API de FinanceRH.
 *
 * Le front est unifie, les backends ne le sont pas : chaque application garde
 * le sien et sa propre base. La passerelle les distingue par le prefixe.
 */
export const BASE_API = process.env.NEXT_PUBLIC_API_RH ?? "/api/rh";

const CLE_ACCES = "gda_acces";
const CLE_RAFRAICHISSEMENT = "gda_rafraichissement";

export const jetons = {
  acces: () =>
    typeof window === "undefined" ? null : localStorage.getItem(CLE_ACCES),
  rafraichissement: () =>
    typeof window === "undefined"
      ? null
      : localStorage.getItem(CLE_RAFRAICHISSEMENT),
  enregistrer(acces: string, rafraichissement?: string) {
    localStorage.setItem(CLE_ACCES, acces);
    if (rafraichissement) {
      localStorage.setItem(CLE_RAFRAICHISSEMENT, rafraichissement);
    }
  },
  effacer() {
    localStorage.removeItem(CLE_ACCES);
    localStorage.removeItem(CLE_RAFRAICHISSEMENT);
  },
};

export class ErreurApi extends Error {
  statut: number;
  /** Erreurs champ par champ renvoyees par DRF. */
  champs: Record<string, string[]>;

  constructor(statut: number, corps: unknown) {
    const { message, champs } = ErreurApi.interpreter(statut, corps);
    super(message);
    this.name = "ErreurApi";
    this.statut = statut;
    this.champs = champs;
  }

  private static interpreter(statut: number, corps: unknown) {
    const champs: Record<string, string[]> = {};
    let message = `Erreur ${statut}`;

    if (typeof corps === "string" && corps) {
      return { message: corps, champs };
    }
    if (corps && typeof corps === "object") {
      const donnees = corps as Record<string, unknown>;
      if (typeof donnees.detail === "string") {
        message = donnees.detail;
      }
      const messages: string[] = [];
      for (const [cle, valeur] of Object.entries(donnees)) {
        if (cle === "detail") continue;
        const liste = Array.isArray(valeur)
          ? valeur.map(String)
          : [String(valeur)];
        champs[cle] = liste;
        messages.push(cle === "non_field_errors" ? liste.join(" ") : `${cle} : ${liste.join(" ")}`);
      }
      if (messages.length && !donnees.detail) {
        message = messages.join(" · ");
      }
    }
    if (statut === 401) message = message || "Session expiree.";
    if (statut === 403) message = message || "Acces refuse.";
    return { message, champs };
  }
}

/** Rafraichissement partage : evite les appels concurrents au meme endpoint. */
let rafraichissementEnCours: Promise<string | null> | null = null;

async function rafraichirJeton(): Promise<string | null> {
  const refresh = jetons.rafraichissement();
  if (!refresh) return null;

  rafraichissementEnCours ??= (async () => {
    try {
      const reponse = await fetch(`${BASE_API}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!reponse.ok) return null;
      const donnees = await reponse.json();
      jetons.enregistrer(donnees.access, donnees.refresh);
      return donnees.access as string;
    } finally {
      rafraichissementEnCours = null;
    }
  })();

  return rafraichissementEnCours;
}

interface OptionsRequete {
  methode?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  corps?: unknown;
  /** Envoi multipart pour les justificatifs. */
  fichiers?: FormData;
  sansAuth?: boolean;
}

export async function appelApi<T = unknown>(
  chemin: string,
  options: OptionsRequete = {},
): Promise<T> {
  const { methode = "GET", corps, fichiers, sansAuth } = options;

  const executer = async (jeton: string | null): Promise<Response> => {
    const entetes: Record<string, string> = {};
    if (!fichiers) entetes["Content-Type"] = "application/json";
    if (jeton) entetes.Authorization = `Bearer ${jeton}`;

    return fetch(`${BASE_API}${chemin}`, {
      method: methode,
      headers: entetes,
      body: fichiers ?? (corps === undefined ? undefined : JSON.stringify(corps)),
    });
  };

  let reponse = await executer(sansAuth ? null : jetons.acces());

  if (reponse.status === 401 && !sansAuth) {
    const nouveauJeton = await rafraichirJeton();
    if (nouveauJeton) {
      reponse = await executer(nouveauJeton);
    } else {
      jetons.effacer();
      if (typeof window !== "undefined" && !location.pathname.startsWith("/connexion")) {
        // Rechargement complet volontaire : la session est perdue, on veut
        // repartir d'un etat vierge plutot que d'une navigation cote client.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        location.href = "/connexion";
      }
      throw new ErreurApi(401, { detail: "Session expiree, reconnectez-vous." });
    }
  }

  if (reponse.status === 204) return undefined as T;

  const texte = await reponse.text();
  const donnees = texte ? safeJson(texte) : null;

  if (!reponse.ok) throw new ErreurApi(reponse.status, donnees ?? texte);
  return donnees as T;
}

function safeJson(texte: string): unknown {
  try {
    return JSON.parse(texte);
  } catch {
    return texte;
  }
}

/** Construit une query string en ignorant les valeurs vides. */
export function versParametres(
  filtres: Record<string, string | number | boolean | undefined | null>,
): string {
  const parametres = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(filtres)) {
    if (valeur === undefined || valeur === null || valeur === "") continue;
    parametres.set(cle, String(valeur));
  }
  const chaine = parametres.toString();
  return chaine ? `?${chaine}` : "";
}

/** Recupere une liste paginee et renvoie directement les resultats. */
export async function listerTout<T>(chemin: string): Promise<T[]> {
  const donnees = await appelApi<ReponsePaginee<T> | T[]>(chemin);
  return Array.isArray(donnees) ? donnees : donnees.results;
}

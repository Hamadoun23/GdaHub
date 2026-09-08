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

/**
 * L'authentification n'est prefixee ni par « rh » ni par « finance » : les
 * deux domaines vivent dans le meme service Django, et `accounts.urls` (qui
 * porte connexion/profil/rafraichissement) est monte sous `/api/`, pas sous
 * `/api/rh/` — cf. `backend/financerh/config/urls.py`. Utiliser `BASE_API`
 * pour ces trois appels envoyait `/api/rh/auth/profil/`, une adresse qui
 * n'existe pas cote serveur (404 constate), et laissait l'ecran d'ouverture
 * de l'application bloque plutot que d'entrer ou de renvoyer a la connexion.
 */
const BASE_API_AUTH = "/api";

/**
 * Le domaine Finance vit dans le meme service Django que RH, mais sous son
 * propre prefixe racine (`path("api/finance/", include("finance.urls"))`),
 * pas sous `/api/rh/finance/`. Les ecrans partages entre les deux domaines
 * (mes demandes, historique, validations, tableau de bord) melangent des
 * ressources RH (demandes d'absence) et Finance (depenses) sur le meme
 * ecran : chaque appel doit dire lequel des deux il vise.
 */
const BASE_API_FINANCE = "/api/finance";

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
      // Une reponse non-JSON (page d'erreur HTML du serveur de dev quand
      // l'API n'est pas joignable, par exemple) ne doit jamais s'afficher
      // telle quelle a l'ecran.
      const ressembleAHtml = /^\s*<(!doctype|html)/i.test(corps);
      return { message: ressembleAHtml ? `Erreur ${statut}` : corps, champs };
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
      const reponse = await fetch(`${BASE_API_AUTH}/auth/refresh/`, {
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
  /** `"auth"` pour les trois routes de `accounts.urls` (connexion, profil,
   * rafraichissement), montees hors du prefixe `rh`/`finance` — cf. la note
   * sur `BASE_API_AUTH` plus haut. `"finance"` pour les ressources du domaine
   * Finance (depenses, requisitions...) — cf. la note sur `BASE_API_FINANCE`. */
  racine?: "rh" | "auth" | "finance";
}

export async function appelApi<T = unknown>(
  chemin: string,
  options: OptionsRequete = {},
): Promise<T> {
  const { methode = "GET", corps, fichiers, sansAuth, racine = "rh" } = options;
  const base =
    racine === "auth" ? BASE_API_AUTH : racine === "finance" ? BASE_API_FINANCE : BASE_API;

  const executer = async (jeton: string | null): Promise<Response> => {
    const entetes: Record<string, string> = {};
    if (!fichiers) entetes["Content-Type"] = "application/json";
    if (jeton) entetes.Authorization = `Bearer ${jeton}`;

    return fetch(`${base}${chemin}`, {
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
export async function listerTout<T>(
  chemin: string,
  options: { racine?: "rh" | "finance" } = {},
): Promise<T[]> {
  const donnees = await appelApi<ReponsePaginee<T> | T[]>(chemin, options);
  return Array.isArray(donnees) ? donnees : donnees.results;
}

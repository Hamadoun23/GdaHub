/**
 * Appels d'API du shell.
 *
 * Toutes les requetes partent en relatif vers la passerelle : le navigateur ne
 * connait qu'une seule origine, et le shell n'a donc jamais a savoir sur quel
 * port tourne tel ou tel service.
 *
 * Le format d'erreur est le meme pour les cinq services — c'est une regle du
 * socle Django — ce qui permet de n'avoir qu'un seul type d'erreur ici.
 */

export const BASE_API = process.env.NEXT_PUBLIC_BASE_API ?? "/api";

export type ErreurCharge = {
  code: string;
  message: string;
  details: Record<string, string[]>;
};

export class ErreurApi extends Error {
  statut: number;
  code: string;
  details: Record<string, string[]>;

  constructor(statut: number, charge: ErreurCharge) {
    super(charge.message);
    this.name = "ErreurApi";
    this.statut = statut;
    this.code = charge.code;
    this.details = charge.details ?? {};
  }
}

type Options = {
  methode?: string;
  corps?: unknown;
  jeton?: string;
  signal?: AbortSignal;
};

export async function appeler<T>(chemin: string, options: Options = {}): Promise<T> {
  const { methode = "GET", corps, jeton, signal } = options;

  const entetes: Record<string, string> = { Accept: "application/json" };
  if (corps !== undefined) entetes["Content-Type"] = "application/json";
  if (jeton) entetes.Authorization = `Bearer ${jeton}`;

  const reponse = await fetch(`${BASE_API}${chemin}`, {
    method: methode,
    headers: entetes,
    body: corps === undefined ? undefined : JSON.stringify(corps),
    signal,
  });

  if (reponse.status === 204) return undefined as T;

  const texte = await reponse.text();
  const charge = texte ? JSON.parse(texte) : null;

  if (!reponse.ok) {
    const erreur = charge?.erreur ?? {
      code: "reseau",
      message: `Le service a repondu ${reponse.status}.`,
      details: {},
    };
    throw new ErreurApi(reponse.status, erreur);
  }

  return charge as T;
}

// --- Ce que renvoie identity ------------------------------------------------

export type Application = {
  id: number;
  code: string;
  nom: string;
  description: string;
  /** Intitule de la section : « Board », « Applications metier »... */
  groupe: string;
  chemin: string;
  prefixe_api: string;
  couleur: string;
  ordre: number;
  roles: string[];
};

export type Utilisateur = {
  id: number;
  identifiant: string;
  nom_complet: string;
  email: string;
  fonction: string;
  est_superadmin: boolean;
};

export type Profil = {
  utilisateur: Utilisateur;
  habilitations: Record<string, string[]>;
  applications: Application[];
};

export type Connexion = Profil & { acces: string; rafraichissement: string };

export const identity = {
  connexion: (identifiant: string, mot_de_passe: string) =>
    appeler<Connexion>("/identity/auth/connexion", {
      methode: "POST",
      corps: { identifiant, mot_de_passe },
    }),

  rafraichir: (rafraichissement: string) =>
    appeler<Profil & { acces: string }>("/identity/auth/rafraichir", {
      methode: "POST",
      corps: { rafraichissement },
    }),

  deconnexion: (rafraichissement: string) =>
    appeler<void>("/identity/auth/deconnexion", {
      methode: "POST",
      corps: { rafraichissement },
    }),

  moi: (jeton: string) => appeler<Profil>("/identity/auth/moi", { jeton }),
};

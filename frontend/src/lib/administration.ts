/**
 * Les types de l'administration du hub.
 *
 * Tout passe par `/identity/` : c'est le seul service qui connait les
 * personnes, et le seul qui ait le droit de dire qui accede a quoi. Les appels
 * eux-memes empruntent le `requete` de la session, qui porte le jeton et le
 * renouvelle quand il expire.
 */

export type RoleDisponible = { code: string; libelle: string };

/** L'appel authentifie fourni par la session. */
export type Requete = <T>(
  chemin: string,
  options?: { methode?: string; corps?: unknown },
) => Promise<T>;

export type ApplicationAdmin = {
  id: number;
  code: string;
  nom: string;
  description: string;
  groupe: string;
  chemin: string;
  couleur: string;
  ordre: number;
  active: boolean;
  roles_disponibles: RoleDisponible[];
};

export type HabilitationAdmin = {
  id: number;
  utilisateur: number;
  application: number;
  application_code: string;
  application_nom: string;
  roles: string[];
  /** Sous quel nom l'application connait cette personne. Vide si l'adresse suffit. */
  identifiant_local: string;
  active: boolean;
};

export type CompteAdmin = {
  id: number;
  identifiant: string;
  nom: string;
  prenom: string;
  nom_complet: string;
  email: string;
  telephone: string;
  fonction: string;
  est_actif: boolean;
  is_superuser: boolean;
  derniere_connexion: string | null;
  habilitations: HabilitationAdmin[];
};

/**
 * La liste, que la reponse soit paginee ou non.
 *
 * Le socle du hub pagine sous la forme `{total, page, pages, resultats}` — en
 * francais, comme le reste du code. DRF, lui, nomme cette cle `results`, et un
 * point de terminaison sans pagination renvoie un tableau nu. Les trois formes
 * sont admises : se tromper de cle ne provoque aucune erreur, seulement une
 * liste vide, et rien a l'ecran n'explique pourquoi.
 */
export function tirerListe<T>(charge: unknown): T[] {
  if (Array.isArray(charge)) return charge as T[];
  if (charge && typeof charge === "object") {
    for (const cle of ["resultats", "results"] as const) {
      const valeur = (charge as Record<string, unknown>)[cle];
      if (Array.isArray(valeur)) return valeur as T[];
    }
  }
  return [];
}

/**
 * Ce compte peut-il reellement entrer dans cette application ?
 *
 * C'est la question que l'ecran doit rendre visible. Une habilitation accordee
 * ne suffit pas : encore faut-il que l'application sache de qui il s'agit. Elle
 * le sait dans deux cas seulement — l'identifiant local est renseigne, ou le
 * compte porte une adresse professionnelle que l'application connait aussi.
 *
 * Le hub ne peut pas verifier le second cas : il ne lit pas la base des autres
 * services, et c'est voulu — aucune cle etrangere ne traverse une frontiere de
 * service. Il peut en revanche signaler le cas ou c'est certainement faux : ni
 * identifiant local, ni adresse du tout. Ceux-la n'entreront jamais.
 */
export function rattachementIncertain(
  compte: CompteAdmin,
  habilitation: HabilitationAdmin,
) {
  if (habilitation.identifiant_local.trim()) return false;
  return !compte.identifiant.includes("@") && !compte.email.trim();
}

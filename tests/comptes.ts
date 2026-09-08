/**
 * Les comptes dont les tests ont besoin, et ou ils vivent.
 *
 * Tous portent le prefixe « e2e » : ils sont reconnaissables d'un coup d'oeil
 * dans les deux bases, et une purge ne peut pas emporter un vrai compte par
 * inadvertance. Ils sont crees par `amorcer.ts` et sont idempotents.
 */

/** Le compte du hub. Il ouvre BDM sans ressaisie : c'est tout l'enjeu. */
export const HUB = {
    identifiant: 'e2e@gdamali.net',
    motDePasse: 'E2e-GdaHub-2026!',
    nomComplet: 'Essai Bout-en-bout',
};

/**
 * Sous quel nom ce meme compte est connu de BDM.
 *
 * Il n'a pas d'adresse : trente comptes de BDM sur soixante-quatre n'en ont
 * aucune, dont tous les comptes d'administration. C'est precisement le cas que
 * `identifiant_local` existe pour couvrir, et le test le prouve.
 */
export const BDM_VIA_HUB = {
    identifiantLocal: 'Essai E2E',
    nom: 'Essai E2E',
};

/** Un compte BDM avec son propre mot de passe : le chemin de bdm.gdamali.net. */
export const BDM_DIRECT = {
    email: 'e2e@bdm.local',
    motDePasse: 'E2e-Bdm-2026!',
    nom: 'Essai Direct',
};

/**
 * Un compte ordinaire, sans droit sur le hub.
 *
 * Son identifiant n'est pas une adresse : c'est le cas des commerciaux de
 * terrain, qui n'en ont pas. L'ecran d'administration doit le signaler comme
 * non rattachable tant que son identifiant local est vide.
 */
export const SIMPLE = {
    identifiant: 'e2e-terrain',
    motDePasse: 'E2e-Terrain-2026!',
};

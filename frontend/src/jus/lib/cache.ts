"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cache de données partagé entre les composants.
 *
 * Objectif : que l'application vive côté navigateur et n'appelle le serveur
 * que lorsqu'elle a une raison de le faire.
 *
 * - Les données déjà chargées sont réaffichées instantanément (pas de spinner
 *   en revenant sur une page déjà visitée).
 * - Plusieurs composants qui demandent la même clé ne déclenchent qu'un seul
 *   appel réseau, et se mettent à jour ensemble.
 * - Après une création ou une modification, on écrit directement le résultat
 *   renvoyé par le serveur dans le cache : inutile de recharger toute la liste
 *   pour une ligne qui vient de changer.
 * - La revalidation se fait au retour sur l'onglet, pas en boucle : c'est là
 *   que l'utilisateur risque de lire des chiffres périmés (un collègue a pu
 *   saisir quelque chose entre-temps).
 */

type Ecouteur = () => void;

const donnees = new Map<string, unknown>();
const horodatages = new Map<string, number>();
const ecouteurs = new Map<string, Set<Ecouteur>>();
const chargementsEnCours = new Map<string, Promise<unknown>>();

/** Durée pendant laquelle une donnée déjà chargée est considérée à jour. */
export const FRAICHEUR_DEFAUT_MS = 60_000;
/** Les listes déroulantes bougent rarement : on les garde plus longtemps. */
export const FRAICHEUR_OPTIONS_MS = 300_000;

function estFrais(cle: string, dureeMs: number) {
  const t = horodatages.get(cle);
  return t !== undefined && Date.now() - t < dureeMs;
}

function notifier(cle: string) {
  ecouteurs.get(cle)?.forEach((e) => e());
}

export function lireCache<T>(cle: string): T | undefined {
  return donnees.get(cle) as T | undefined;
}

/** Écrit une valeur et prévient tous les composants qui l'affichent. */
export function ecrireCache<T>(cle: string, valeur: T) {
  donnees.set(cle, valeur);
  horodatages.set(cle, Date.now());
  notifier(cle);
}

/** Vide une entrée : le prochain composant qui la demande la rechargera. */
export function invaliderCache(cle: string) {
  donnees.delete(cle);
  horodatages.delete(cle);
  notifier(cle);
}

/**
 * Vide les entrées dont la clé commence par ce préfixe, en épargnant celles
 * listées dans `sauf` — typiquement la liste que le composant vient de mettre
 * à jour lui-même, et qu'il serait absurde de recharger.
 */
export function invaliderPrefixe(prefixe: string, sauf: (string | null)[] = []) {
  const epargnees = new Set(sauf.filter(Boolean) as string[]);
  for (const cle of [...donnees.keys()]) {
    if (cle.startsWith(prefixe) && !epargnees.has(cle)) {
      donnees.delete(cle);
      horodatages.delete(cle);
      notifier(cle);
    }
  }
}

function sAbonner(cle: string, ecouteur: Ecouteur) {
  if (!ecouteurs.has(cle)) ecouteurs.set(cle, new Set());
  ecouteurs.get(cle)!.add(ecouteur);
  return () => {
    ecouteurs.get(cle)?.delete(ecouteur);
  };
}

/**
 * Deux composants montés en même temps sur la même clé ne doivent pas lancer
 * deux requêtes : le second se greffe sur la promesse déjà en vol.
 */
async function charger<T>(cle: string, chargeur: () => Promise<T>): Promise<T> {
  const enCours = chargementsEnCours.get(cle);
  if (enCours) return enCours as Promise<T>;

  const promesse = chargeur()
    .then((valeur) => {
      donnees.set(cle, valeur);
      horodatages.set(cle, Date.now());
      notifier(cle);
      return valeur;
    })
    .finally(() => {
      chargementsEnCours.delete(cle);
    });

  chargementsEnCours.set(cle, promesse);
  return promesse;
}

export type EtatDonnees<T> = {
  donnees: T | undefined;
  /** Vrai uniquement au tout premier chargement, quand il n'y a rien à montrer. */
  chargement: boolean;
  erreur: string | null;
  /** Force un aller-retour serveur (bouton « actualiser »). */
  revalider: () => Promise<void>;
  /** Remplace la valeur en cache sans appeler le serveur. */
  muter: (valeur: T) => void;
  /** Horodatage de la dernière réponse du serveur. */
  majLe: Date | null;
};

export function useDonnees<T>(
  cle: string | null,
  chargeur: () => Promise<T>,
  options: { revaliderAuFocus?: boolean; fraicheurMs?: number } = {}
): EtatDonnees<T> {
  const { revaliderAuFocus = true, fraicheurMs = FRAICHEUR_DEFAUT_MS } = options;

  const [, forcerRendu] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [majLe, setMajLe] = useState<Date | null>(null);
  const valeur = cle ? lireCache<T>(cle) : undefined;
  // État dérivé plutôt que stocké : on « charge » tant qu'il n'y a ni donnée
  // à afficher ni erreur à signaler. Aucun setState dans un effet.
  const chargement = Boolean(cle) && valeur === undefined && erreur === null;

  const chargeurRef = useRef(chargeur);
  useEffect(() => {
    chargeurRef.current = chargeur;
  });

  // Suivre les écritures faites par d'autres composants sur la même clé.
  useEffect(() => {
    if (!cle) return;
    return sAbonner(cle, () => forcerRendu((n) => n + 1));
  }, [cle]);

  const revalider = useCallback(async () => {
    if (!cle) return;
    try {
      await charger(cle, chargeurRef.current);
      setErreur(null);
      setMajLe(new Date());
    } catch (e) {
      // On conserve les données déjà affichées : un échec de revalidation ne
      // doit pas vider l'écran de l'utilisateur.
      setErreur(e instanceof Error ? e.message : "Erreur de chargement");
    }
  }, [cle]);

  useEffect(() => {
    if (!cle) return;
    // Donnée récente : on l'affiche telle quelle, sans rien demander au
    // serveur. C'est ce qui rend la navigation entre les écrans gratuite.
    if (estFrais(cle, fraicheurMs)) return;
    // La règle set-state-in-effect vise les mises à jour synchrones, qui
    // provoquent un rendu en cascade. Ici `revalider` est asynchrone : les
    // setState n'ont lieu qu'après la réponse du serveur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    revalider();
  }, [cle, revalider, fraicheurMs]);

  // Au retour sur l'onglet : l'utilisateur a pu s'absenter, les données
  // affichées ne sont peut-être plus à jour.
  useEffect(() => {
    if (!cle || !revaliderAuFocus) return;
    const auRetour = () => {
      // Au retour sur l'onglet on revalide, sauf si la donnée vient d'être
      // chargée : basculer entre deux fenêtres ne doit pas mitrailler l'API.
      if (document.visibilityState === "visible" && !estFrais(cle, fraicheurMs)) {
        revalider();
      }
    };
    document.addEventListener("visibilitychange", auRetour);
    window.addEventListener("focus", auRetour);
    return () => {
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener("focus", auRetour);
    };
  }, [cle, revaliderAuFocus, revalider, fraicheurMs]);

  const muter = useCallback(
    (valeur: T) => {
      if (cle) ecrireCache(cle, valeur);
    },
    [cle]
  );

  return { donnees: valeur, chargement, erreur, revalider, muter, majLe };
}

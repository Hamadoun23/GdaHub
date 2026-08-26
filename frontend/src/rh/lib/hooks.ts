"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { appelApi, ErreurApi, listerTout } from "./api";

interface EtatRessource<T> {
  donnees: T | null;
  chargement: boolean;
  erreur: string | null;
  recharger: () => Promise<void>;
  definir: (valeur: T) => void;
}

/**
 * Charge une ressource de l'API et suit son etat.
 *
 * ``chemin`` a null met le chargement en pause : pratique quand l'appel depend
 * d'un filtre pas encore choisi.
 */
export function useRessource<T>(
  chemin: string | null,
  options: { liste?: boolean } = {},
): EtatRessource<T> {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [chargement, setChargement] = useState(Boolean(chemin));
  const [erreur, setErreur] = useState<string | null>(null);
  // Evite d'appliquer la reponse d'une requete annulee par une plus recente.
  const requeteCourante = useRef(0);

  const charger = useCallback(async () => {
    if (!chemin) {
      setDonnees(null);
      setChargement(false);
      return;
    }
    const identifiant = ++requeteCourante.current;
    setChargement(true);
    setErreur(null);
    try {
      const resultat = options.liste
        ? ((await listerTout(chemin)) as T)
        : await appelApi<T>(chemin);
      if (identifiant === requeteCourante.current) setDonnees(resultat);
    } catch (exception) {
      if (identifiant !== requeteCourante.current) return;
      setErreur(
        exception instanceof ErreurApi
          ? exception.message
          : "Impossible de contacter le serveur.",
      );
    } finally {
      if (identifiant === requeteCourante.current) setChargement(false);
    }
  }, [chemin, options.liste]);

  useEffect(() => {
    // Le chargement est declenche hors du corps de l'effet : les mises a jour
    // d'etat arrivent alors dans un callback, apres le rendu, et non pendant.
    void Promise.resolve().then(charger);
  }, [charger]);

  return { donnees, chargement, erreur, recharger: charger, definir: setDonnees };
}

/** Raccourci pour les endpoints de liste pagines. */
export function useListe<T>(chemin: string | null) {
  return useRessource<T[]>(chemin, { liste: true });
}

interface EtatAction {
  executer: (action: () => Promise<unknown>) => Promise<boolean>;
  enCours: boolean;
  erreur: string | null;
  champs: Record<string, string[]>;
  reinitialiser: () => void;
}

/** Encapsule une mutation : etat de chargement et erreurs de validation. */
export function useAction(): EtatAction {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [champs, setChamps] = useState<Record<string, string[]>>({});

  const reinitialiser = useCallback(() => {
    setErreur(null);
    setChamps({});
  }, []);

  const executer = useCallback(async (action: () => Promise<unknown>) => {
    setEnCours(true);
    setErreur(null);
    setChamps({});
    try {
      await action();
      return true;
    } catch (exception) {
      if (exception instanceof ErreurApi) {
        setErreur(exception.message);
        setChamps(exception.champs);
      } else {
        setErreur("Une erreur inattendue est survenue.");
      }
      return false;
    } finally {
      setEnCours(false);
    }
  }, []);

  return { executer, enCours, erreur, champs, reinitialiser };
}

// --- Etats du navigateur ---------------------------------------------------

/**
 * `useSyncExternalStore` est l'outil juste pour ce qui suit : le navigateur
 * est une source exterieure, et React sait s'y abonner sans passer par un
 * etat local mis a jour depuis un effet — ce qui provoquerait un rendu en
 * cascade a chaque montage.
 */

function souscrireReseau(surChangement: () => void) {
  window.addEventListener("online", surChangement);
  window.addEventListener("offline", surChangement);
  return () => {
    window.removeEventListener("online", surChangement);
    window.removeEventListener("offline", surChangement);
  };
}

/**
 * L'appareil a-t-il une connexion ?
 *
 * Cote serveur on suppose que oui : le rendu initial ne doit pas annoncer une
 * panne que personne ne subit.
 */
export function useEnLigne(): boolean {
  return useSyncExternalStore(
    souscrireReseau,
    () => navigator.onLine,
    () => true,
  );
}

/** Rien a surveiller : la valeur est figee pour la duree de la session. */
const SANS_ABONNEMENT = () => () => {};

/**
 * Une donnee que seul le navigateur connait et qui ne bouge plus ensuite :
 * type d'appareil, mode d'affichage, contenu du stockage local. Le rendu
 * serveur prend `valeurServeur`, l'hydratation lit la vraie.
 */
export function useValeurNavigateur<T>(lire: () => T, valeurServeur: T): T {
  return useSyncExternalStore(SANS_ABONNEMENT, lire, () => valeurServeur);
}

"use client";

/**
 * Les trois hooks avec lesquels tous les ecrans sont ecrits.
 *
 * `useListe` pour une collection paginee, `useRessource` pour un objet,
 * `useAction` pour un envoi. Tous passent par `requete` de la session, qui
 * porte le jeton et le renouvelle si besoin — un ecran n'a jamais a s'en
 * occuper.
 *
 * La pagination est celle du socle Django : le meme enveloppement partout,
 * quel que soit le service interroge.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { ErreurApi } from "@/lib/api";
import { useSession } from "@/lib/session";

export type Page<T> = {
  total: number;
  page: number;
  pages: number;
  taille: number;
  suivant: string | null;
  precedent: string | null;
  resultats: T[];
};

/** Une reponse paginee ou une simple liste : les deux existent dans l'ERP. */
function extraire<T>(charge: unknown): { elements: T[]; total: number } {
  if (Array.isArray(charge)) return { elements: charge as T[], total: charge.length };
  const page = charge as Page<T>;
  if (page && Array.isArray(page.resultats)) {
    return { elements: page.resultats, total: page.total };
  }
  return { elements: [], total: 0 };
}

export function useListe<T>(chemin: string | null, dependances: unknown[] = []) {
  const { requete } = useSession();
  const [donnees, setDonnees] = useState<T[] | null>(null);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(Boolean(chemin));
  const [erreur, setErreur] = useState("");

  // `chemin` suffit comme cle : les dependances explicites servent aux
  // rechargements provoques par un filtre qui ne change pas l'URL.
  const cle = useMemo(() => JSON.stringify([chemin, ...dependances]), [chemin, dependances]);

  const charger = useCallback(async () => {
    if (!chemin) {
      setDonnees(null);
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreur("");
    try {
      const reponse = await requete<unknown>(chemin);
      const { elements, total: nombre } = extraire<T>(reponse);
      setDonnees(elements);
      setTotal(nombre);
    } catch (probleme) {
      setDonnees(null);
      setErreur(
        probleme instanceof ErreurApi
          ? probleme.message
          : "Ce service ne repond pas.",
      );
    } finally {
      setChargement(false);
    }
  }, [chemin, requete]);

  useEffect(() => {
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  return { donnees, total, chargement, erreur, recharger: charger };
}

export function useRessource<T>(chemin: string | null) {
  const { requete } = useSession();
  const [donnees, setDonnees] = useState<T | null>(null);
  const [chargement, setChargement] = useState(Boolean(chemin));
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    if (!chemin) return;
    setChargement(true);
    setErreur("");
    try {
      setDonnees(await requete<T>(chemin));
    } catch (probleme) {
      setDonnees(null);
      setErreur(
        probleme instanceof ErreurApi
          ? probleme.message
          : "Ce service ne repond pas.",
      );
    } finally {
      setChargement(false);
    }
  }, [chemin, requete]);

  useEffect(() => {
    void charger();
  }, [charger]);

  return { donnees, chargement, erreur, recharger: charger };
}

/**
 * Un envoi, avec ses erreurs de champ.
 *
 * Le format d'erreur du socle porte `details` par champ : on le remonte tel
 * quel pour que chaque formulaire surligne la bonne ligne plutot que
 * d'afficher un message general au-dessus.
 */
export function useAction() {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [champs, setChamps] = useState<Record<string, string[]>>({});

  const executer = useCallback(async (travail: () => Promise<unknown>) => {
    setEnCours(true);
    setErreur("");
    setChamps({});
    try {
      await travail();
      return true;
    } catch (probleme) {
      if (probleme instanceof ErreurApi) {
        setErreur(probleme.message);
        setChamps(probleme.details ?? {});
      } else {
        setErreur("Le service ne repond pas.");
      }
      return false;
    } finally {
      setEnCours(false);
    }
  }, []);

  return { executer, enCours, erreur, champs };
}

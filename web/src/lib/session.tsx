"use client";

/**
 * La session de l'utilisateur, cote navigateur.
 *
 * Le jeton d'acces reste en memoire et n'est jamais ecrit sur le disque : une
 * faille XSS ne peut donc pas le relire apres coup. Seul le jeton de
 * rafraichissement est conserve dans localStorage, pour que fermer l'onglet ne
 * force pas a se reconnecter — c'est le compromis habituel, et il est
 * assumable parce que ce jeton est revocable cote identity, contrairement au
 * jeton d'acces.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ErreurApi, appeler, identity, type Profil } from "@/lib/api";

const CLE_RAFRAICHISSEMENT = "gdahub.rafraichissement";

type ValeurSession = {
  profil: Profil | null;
  chargement: boolean;
  connecter: (identifiant: string, motDePasse: string) => Promise<void>;
  deconnecter: () => Promise<void>;
  /** Appel authentifie vers n'importe quel service, jeton renouvele si besoin. */
  requete: <T>(chemin: string, options?: { methode?: string; corps?: unknown }) => Promise<T>;
};

const Contexte = createContext<ValeurSession | null>(null);

export function FournisseurSession({ children }: { children: React.ReactNode }) {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [chargement, setChargement] = useState(true);
  const acces = useRef<string | null>(null);

  const lireRafraichissement = () =>
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(CLE_RAFRAICHISSEMENT);

  const ecrireRafraichissement = (jeton: string | null) => {
    if (typeof window === "undefined") return;
    if (jeton) window.localStorage.setItem(CLE_RAFRAICHISSEMENT, jeton);
    else window.localStorage.removeItem(CLE_RAFRAICHISSEMENT);
  };

  /** Redemande un jeton d'acces ; renvoie null si la session est close. */
  const rafraichir = useCallback(async (): Promise<string | null> => {
    const jeton = lireRafraichissement();
    if (!jeton) return null;
    try {
      const reponse = await identity.rafraichir(jeton);
      acces.current = reponse.acces;
      setProfil({
        utilisateur: reponse.utilisateur,
        habilitations: reponse.habilitations,
        applications: reponse.applications,
      });
      return reponse.acces;
    } catch {
      // Jeton expire ou revoque : on repart d'une session vide plutot que de
      // laisser l'interface dans un etat a moitie connecte.
      ecrireRafraichissement(null);
      acces.current = null;
      setProfil(null);
      return null;
    }
  }, []);

  // Au chargement de l'application, on tente de reprendre la session.
  useEffect(() => {
    rafraichir().finally(() => setChargement(false));
  }, [rafraichir]);

  // Le jeton d'acces dure quinze minutes ; on le renouvelle a la douzieme pour
  // qu'une saisie longue ne se termine jamais par une erreur d'expiration.
  useEffect(() => {
    if (!profil) return;
    const minuteur = window.setInterval(rafraichir, 12 * 60 * 1000);
    return () => window.clearInterval(minuteur);
  }, [profil, rafraichir]);

  const connecter = useCallback(async (identifiant: string, motDePasse: string) => {
    const reponse = await identity.connexion(identifiant, motDePasse);
    acces.current = reponse.acces;
    ecrireRafraichissement(reponse.rafraichissement);
    setProfil({
      utilisateur: reponse.utilisateur,
      habilitations: reponse.habilitations,
      applications: reponse.applications,
    });
  }, []);

  const deconnecter = useCallback(async () => {
    const jeton = lireRafraichissement();
    ecrireRafraichissement(null);
    acces.current = null;
    setProfil(null);
    if (jeton) {
      // La revocation cote serveur peut echouer sans consequence : la session
      // locale est deja fermee.
      await identity.deconnexion(jeton).catch(() => undefined);
    }
  }, []);

  const requete = useCallback(
    async <T,>(chemin: string, options: { methode?: string; corps?: unknown } = {}) => {
      const lancer = (jeton: string) => appeler<T>(chemin, { ...options, jeton });

      let jeton = acces.current;
      if (!jeton) {
        jeton = await rafraichir();
        if (!jeton) throw new ErreurApi(401, {
          code: "authentification",
          message: "Session expiree. Reconnectez-vous.",
          details: {},
        });
      }

      try {
        return await lancer(jeton);
      } catch (erreur) {
        // Un 401 en cours de route signifie presque toujours un jeton arrive a
        // expiration : on le renouvelle une fois avant d'abandonner.
        if (erreur instanceof ErreurApi && erreur.statut === 401) {
          const nouveau = await rafraichir();
          if (nouveau) return lancer(nouveau);
        }
        throw erreur;
      }
    },
    [rafraichir],
  );

  const valeur = useMemo(
    () => ({ profil, chargement, connecter, deconnecter, requete }),
    [profil, chargement, connecter, deconnecter, requete],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useSession(): ValeurSession {
  const valeur = useContext(Contexte);
  if (!valeur) {
    throw new Error("useSession doit etre utilise dans FournisseurSession.");
  }
  return valeur;
}

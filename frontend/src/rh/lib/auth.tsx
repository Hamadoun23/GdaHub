"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { appelApi, jetons } from "./api";
import { ROLES_FINANCE, ROLES_RH, type Role, type Utilisateur } from "./types";

/**
 * TEMPORAIRE — voir le meme bloc dans `@/lib/session`. RH a sa propre
 * session (API `/auth/profil/`, hors service en local pendant la refonte) :
 * ce contournement lui est propre. A retirer en meme temps que celui de
 * `@/lib/session`.
 */
const APERCU_SANS_AUTH = process.env.NODE_ENV !== "production";

const UTILISATEUR_APERCU: Utilisateur = {
  id: 0,
  username: "apercu",
  matricule: "APERCU",
  first_name: "Apercu",
  last_name: "Design",
  nom_complet: "Apercu Design",
  email: "apercu@gda.local",
  telephone: "",
  role: "DIRECTION",
  role_libelle: "Direction",
  poste: "Revue de la refonte visuelle",
  departement: null,
  departement_nom: "",
  manager: null,
  manager_nom: "",
  type_contrat: "",
  date_embauche: null,
  date_sortie: null,
  motif_sortie: "",
  anciennete_mois: 0,
  est_encadrant: true,
  is_active: true,
};

interface ContexteAuth {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  connecter: (username: string, motDePasse: string) => Promise<void>;
  deconnecter: () => void;
  rafraichirProfil: () => Promise<void>;
  aLeRole: (...roles: Role[]) => boolean;
  estRH: boolean;
  estFinance: boolean;
  estDirection: boolean;
}

const Contexte = createContext<ContexteAuth | null>(null);

export function FournisseurAuth({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);
  const router = useRouter();

  const rafraichirProfil = useCallback(async () => {
    // Le profil est demande meme sans jeton local.
    //
    // Servie par la passerelle de GDA Hub, l'application est jointe par
    // quelqu'un deja connecte au hub : la passerelle presente son jeton a
    // l'API, et le profil repond. Sans cet appel, l'interface afficherait son
    // ecran de connexion alors que la session est ouverte.
    //
    // Ouverte seule, l'application n'y perd qu'une requete au premier
    // chargement : le profil repond 401 et l'ecran de connexion s'affiche
    // comme avant.
    // En mode apercu, l'appel reel n'est meme pas tente : un 401 declenche un
    // `location.href = "/connexion"` cote `appelApi` (rechargement complet
    // volontaire, cf. sa propre note) qui court-circuiterait ce mock avant
    // meme que le catch ci-dessous ne s'execute.
    if (APERCU_SANS_AUTH) {
      setUtilisateur(UTILISATEUR_APERCU);
      setChargement(false);
      return;
    }

    try {
      setUtilisateur(await appelApi<Utilisateur>("/auth/profil/", { racine: "auth" }));
    } catch {
      jetons.effacer();
      setUtilisateur(null);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    // Hors du corps de l'effet : le profil arrive dans un callback asynchrone.
    void Promise.resolve().then(rafraichirProfil);
  }, [rafraichirProfil]);

  const connecter = useCallback(
    async (username: string, motDePasse: string) => {
      const reponse = await appelApi<{
        access: string;
        refresh: string;
        utilisateur: Utilisateur;
      }>("/auth/connexion/", {
        methode: "POST",
        corps: { username, password: motDePasse },
        sansAuth: true,
        racine: "auth",
      });
      jetons.enregistrer(reponse.access, reponse.refresh);
      setUtilisateur(reponse.utilisateur);
    },
    [],
  );

  const deconnecter = useCallback(() => {
    jetons.effacer();
    setUtilisateur(null);
    router.push("/connexion");
  }, [router]);

  const valeur = useMemo<ContexteAuth>(() => {
    const role = utilisateur?.role;
    return {
      utilisateur,
      chargement,
      connecter,
      deconnecter,
      rafraichirProfil,
      aLeRole: (...roles: Role[]) => !!role && roles.includes(role),
      estRH: !!role && ROLES_RH.includes(role),
      estFinance: !!role && ROLES_FINANCE.includes(role),
      estDirection: role === "DIRECTION",
    };
  }, [utilisateur, chargement, connecter, deconnecter, rafraichirProfil]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useAuth(): ContexteAuth {
  const contexte = useContext(Contexte);
  if (!contexte) {
    throw new Error("useAuth doit etre utilise dans <FournisseurAuth>.");
  }
  return contexte;
}

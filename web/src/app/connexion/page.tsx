"use client";

/**
 * Une seule page de connexion pour tout le groupe.
 *
 * C'est le point de l'ERP le plus visible pour l'utilisateur : le directeur
 * general saisit un identifiant, une fois, et retrouve derriere les quatre
 * applications qu'il suit.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ErreurApi } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function PageConnexion() {
  const { profil, chargement, connecter } = useSession();
  const routeur = useRouter();

  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!chargement && profil) routeur.replace("/tableau-de-bord");
  }, [chargement, profil, routeur]);

  async function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    setErreur("");
    setEnvoi(true);
    try {
      await connecter(identifiant, motDePasse);
      routeur.replace("/tableau-de-bord");
    } catch (probleme) {
      setErreur(
        probleme instanceof ErreurApi
          ? probleme.message
          : "Le service d'authentification est injoignable.",
      );
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            GDA <span className="text-marque">Hub</span>
          </h1>
          <p className="mt-2 text-sm text-ardoise-500">
            Centralise tous les services et informations.
          </p>
        </div>

        <form
          onSubmit={soumettre}
          className="rounded-xl border border-ardoise-200 bg-white p-6 shadow-sm dark:border-ardoise-700 dark:bg-ardoise-900"
        >
          <label className="block text-sm font-medium" htmlFor="identifiant">
            Identifiant
          </label>
          <input
            id="identifiant"
            value={identifiant}
            onChange={(evenement) => setIdentifiant(evenement.target.value)}
            autoComplete="username"
            autoFocus
            required
            className="mt-1 w-full rounded-md border border-ardoise-200 bg-transparent px-3 py-2 outline-none focus:border-marque dark:border-ardoise-700"
            placeholder="e-mail, telephone ou nom"
          />

          <label className="mt-4 block text-sm font-medium" htmlFor="mot-de-passe">
            Mot de passe
          </label>
          <input
            id="mot-de-passe"
            type="password"
            value={motDePasse}
            onChange={(evenement) => setMotDePasse(evenement.target.value)}
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-md border border-ardoise-200 bg-transparent px-3 py-2 outline-none focus:border-marque dark:border-ardoise-700"
          />

          {erreur ? (
            <p
              role="alert"
              className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {erreur}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={envoi}
            className="mt-6 w-full rounded-md bg-marque px-4 py-2 font-medium text-white transition hover:bg-marque-clair disabled:opacity-60"
          >
            {envoi ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ardoise-500">
          Un seul compte donne acces a toutes les applications auxquelles vous
          etes habilite.
        </p>
      </div>
    </div>
  );
}

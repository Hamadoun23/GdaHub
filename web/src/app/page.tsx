"use client";

/**
 * La racine ne montre rien : elle oriente.
 *
 * Une session reprise mene au tableau de bord, une session absente a la
 * connexion. La redirection attend la fin du rafraichissement, sans quoi tout
 * rechargement de page renverrait brievement l'utilisateur connecte vers
 * l'ecran de connexion.
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/lib/session";

export default function PageRacine() {
  const { profil, chargement } = useSession();
  const routeur = useRouter();

  useEffect(() => {
    if (chargement) return;
    routeur.replace(profil ? "/tableau-de-bord" : "/connexion");
  }, [chargement, profil, routeur]);

  return (
    <div className="flex min-h-screen items-center justify-center text-ardoise-500">
      GDA Hub
    </div>
  );
}

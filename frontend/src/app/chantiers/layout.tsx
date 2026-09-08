"use client";

/**
 * Le strict minimum commun a tout le module : la verification de session.
 *
 * Chantiers ne vit pas sous la coquille du hub, et cette page fait donc
 * elle-meme la verification que Coquille assure ailleurs. L'entete elle-meme
 * n'est pas ici : elle a deux formes (avec ou sans projet actif) qui
 * dependent de savoir si un `[id]` est present dans l'URL, une information
 * que seul `[id]/layout.tsx` — ou la page racine — possede.
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/lib/session";
import { Chargement } from "@/chantiers/composants/ui";

export default function LayoutChantiers({ children }: { children: React.ReactNode }) {
  const { profil, chargement } = useSession();
  const routeur = useRouter();

  useEffect(() => {
    if (!chargement && !profil) routeur.replace("/connexion");
  }, [chargement, profil, routeur]);

  if (chargement || !profil) {
    return (
      <div className="min-h-screen bg-background">
        <Chargement />
      </div>
    );
  }

  // Pas de wrapper `bg-background` ici (contrairement a la branche de
  // chargement ci-dessus) : ce fond opaque, pose AVANT `EspaceChantiers`/
  // `EspaceApplication`, peinturlurait par-dessus le motif de marque en
  // z-index negatif de la coquille (`theme-sombre.tsx`) — trouve en
  // verifiant `/chantiers`, seule page blanche alors que Jus, RH et
  // Planning montraient deja le motif sombre.
  return <>{children}</>;
}

"use client";

/** Le chrome commun a tout le module : verification de session, entete, navigation. */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/lib/session";
import { Chargement } from "@/planning/composants/ui";
import { EspacePlanning } from "@/planning/composants/espace-planning";

export default function LayoutPlanning({ children }: { children: React.ReactNode }) {
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

  return (
    <EspacePlanning>
      <div className="mx-auto max-w-[1200px]">{children}</div>
    </EspacePlanning>
  );
}

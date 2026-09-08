"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { EspaceRH } from "@/rh/composants/espace-rh";
import { Chargement } from "@/rh/composants/ui";
import { useAuth } from "@/rh/lib/auth";
import { accesAutorise } from "@/rh/lib/navigation";
import { FournisseurAuth } from "@/rh/lib/auth";

/**
 * L'espace FinanceRH.
 *
 * Son fournisseur de session est pose ici et non a la racine : les trois
 * applications rassemblees ont chacune le sien, et les empiler a la racine
 * ferait interroger trois API a chaque page, y compris sur l'accueil du hub.
 */
export default function LayoutFinanceRH({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FournisseurAuth>
      <Cadre>{children}</Cadre>
    </FournisseurAuth>
  );
}

function Cadre({
  children,
}: {
  children: React.ReactNode;
}) {
  const { utilisateur, chargement } = useAuth();
  const router = useRouter();
  const chemin = usePathname();

  const autorise = utilisateur ? accesAutorise(utilisateur, chemin) : true;

  useEffect(() => {
    if (chargement) return;
    if (!utilisateur) {
      router.replace("/connexion");
    } else if (!autorise) {
      // L'ecran n'appartient pas a l'espace du profil : retour a l'accueil.
      router.replace("/rh/tableau-de-bord");
    }
  }, [chargement, utilisateur, autorise, router]);

  if (chargement || !utilisateur || !autorise) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Chargement libelle="Ouverture de votre espace..." />
      </div>
    );
  }

  return <EspaceRH>{children}</EspaceRH>;
}

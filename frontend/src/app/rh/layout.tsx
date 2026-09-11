"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { BarreBasse, BarreLaterale, BarreSuperieure } from "@/rh/composants/navigation";
import { Chargement } from "@/rh/composants/ui";
import { useAuth } from "@/rh/lib/auth";
import { accesAutorise, menuPour } from "@/rh/lib/navigation";
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
  const [menuOuvert, setMenuOuvert] = useState(false);

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

  // Titre courant, affiche dans la barre superieure sur petits ecrans.
  const titre = useMemo(() => {
    if (!utilisateur) return undefined;
    for (const groupe of menuPour(utilisateur)) {
      for (const entree of groupe.entrees) {
        if (chemin === entree.href || chemin.startsWith(`${entree.href}/`)) {
          return entree.libelle;
        }
      }
    }
    return undefined;
  }, [utilisateur, chemin]);

  if (chargement || !utilisateur || !autorise) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Chargement libelle="Ouverture de votre espace..." />
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <BarreLaterale ouverte={menuOuvert} onFermer={() => setMenuOuvert(false)} />
      <div className="lg:pl-64">
        <BarreSuperieure titre={titre} />
        {/* Le bas de page doit degager la barre d'onglets et la barre de
            gestes du telephone, sinon la derniere ligne reste inatteignable. */}
        <main className="mx-auto max-w-6xl px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-6 lg:pb-10">
          {children}
        </main>
      </div>
      <BarreBasse onOuvrirMenu={() => setMenuOuvert(true)} />
    </div>
  );
}

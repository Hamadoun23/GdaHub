"use client";

/**
 * L'espace FinanceRH, compose sur la coquille d'application partagee.
 *
 * Remplace l'ancienne BarreLaterale/BarreSuperieure maison (navigation.tsx) :
 * la mise en page vient de `composants/coquille-app`, comme pour Jus
 * d'orange. La barre basse mobile, elle, reste propre a FinanceRH — un
 * agent y pose un conge depuis son telephone, et rien dans les autres
 * applications ne joue ce role.
 *
 * RH compose `BarreLaterale`/`Entete` directement plutot que le wrapper
 * `EspaceApplication`, a cause de la barre basse mobile propre a cette
 * application — mais n'a besoin d'aucun habillage sombre propre : la sidebar
 * est sombre par elle-meme (`barre-laterale.tsx` porte sa propre classe
 * `dark`). Le contenu propre a RH (formulaires, tableaux) garde son propre
 * systeme de jetons (`--surface`, `--texte`...) herite de FinanceRH.
 *
 * Canevas transparent (pas `bg-slate-50`) pour laisser voir `FondMotifPoster`
 * partout ou aucune carte opaque ne le couvre — voir le commentaire de
 * `EspaceApplication` pour l'historique (carte flottante tentee puis
 * rejetee, puis canevas gris clair juge trop opaque a son tour).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { GraduationCap } from "lucide-react";

import { BarreLaterale, ContenuBarreLaterale } from "@/composants/coquille-app/barre-laterale";
import { Entete } from "@/composants/coquille-app/entete";
import { FondMotifPoster } from "@/composants/coquille-app/theme-sombre";
import type { GroupeNav as GroupeNavPartage, IconeComposant } from "@/composants/coquille-app/types";
import { initialesDepuis } from "@/composants/coquille-app/initiales";
import { useSession } from "@/lib/session";
import { useAuth } from "@/rh/lib/auth";
import { menuPour, barreBassePour, type EntreeNav } from "@/rh/lib/navigation";
import { Icone } from "./icones";
import { cx } from "./ui";

const COULEURS_GROUPE: Record<string, string> = {
  Decisions: "bg-violet-500",
  "Mes demarches": "bg-primary",
  Suivi: "bg-amber-500",
  Organisation: "bg-blue-500",
};

function iconeDepuisNom(nom: string): IconeComposant {
  return function IconeRH({ className }) {
    return <Icone nom={nom} className={className} />;
  };
}

function estActif(chemin: string, href: string) {
  return chemin === href || chemin.startsWith(`${href}/`);
}

export function EspaceRH({ children }: { children: React.ReactNode }) {
  const { utilisateur, deconnecter } = useAuth();
  // L'identite affichee (nom, photo) vient du hub, pas de la session propre a
  // FinanceRH : c'est la que « Mon compte » la gere desormais, un seul
  // endroit plutot que deux susceptibles de diverger. `utilisateur.poste`
  // reste local — c'est une donnee RH, le hub ne la connait pas.
  const { profil } = useSession();
  const chemin = usePathname();

  const groupes: GroupeNavPartage[] = useMemo(() => {
    if (!utilisateur) return [];
    return menuPour(utilisateur).map((g) => ({
      cle: g.titre,
      label: g.titre,
      couleur: COULEURS_GROUPE[g.titre] ?? "bg-primary",
      items: g.entrees.map((e) => ({ label: e.libelle, href: e.href, icon: iconeDepuisNom(e.icone) })),
    }));
  }, [utilisateur]);

  const titre = useMemo(() => {
    if (!utilisateur) return undefined;
    for (const groupe of menuPour(utilisateur)) {
      for (const entree of groupe.entrees) {
        if (estActif(chemin, entree.href)) return entree.libelle;
      }
    }
    return undefined;
  }, [utilisateur, chemin]);

  if (!utilisateur) return null;
  const entreesBasse = barreBassePour(utilisateur);

  return (
    <div className="relative flex min-h-svh flex-1">
      <FondMotifPoster />
      <BarreLaterale nomApp="GD&A" sousTitre="RH & Finance" icone={GraduationCap} groupes={groupes} />
      <div className="flex flex-1 flex-col">
        <Entete
          badgeLabel={titre}
          utilisateur={{
            nomAffiche: profil?.utilisateur.nom_complet || utilisateur.nom_complet,
            sousLabel: utilisateur.poste,
            initiales: initialesDepuis(profil?.utilisateur.nom_complet || utilisateur.nom_complet || "?"),
            photoUrl: profil?.utilisateur.photo,
          }}
          onDeconnexion={deconnecter}
          rechercheVisible={false}
          contenuMobile={
            <ContenuBarreLaterale nomApp="GD&A" sousTitre="RH & Finance" icone={GraduationCap} groupes={groupes} />
          }
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-6 lg:pb-10">
          {children}
        </main>
      </div>
      <BarreBasse entrees={entreesBasse} chemin={chemin} />
    </div>
  );
}

/** Barre d'onglets basse, sur telephone et tablette — inchangee. */
function BarreBasse({ entrees, chemin }: { entrees: EntreeNav[]; chemin: string }) {
  const styles = (actif: boolean) =>
    cx(
      "flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium transition",
      actif ? "text-primary" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-0.5 border-t bg-background/95 px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
    >
      {entrees.map((entree) => {
        const actif = estActif(chemin, entree.href);
        return (
          <Link key={entree.href} href={entree.href} aria-current={actif ? "page" : undefined} className={styles(actif)}>
            <Icone nom={entree.icone} className="size-5" />
            <span className="w-full truncate text-center leading-tight">{entree.libelle}</span>
          </Link>
        );
      })}
    </nav>
  );
}

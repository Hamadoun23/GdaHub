"use client";

/**
 * La barre laterale partagee par toutes les applications du hub.
 *
 * Reprise de Jus d'orange (jus/composants/app/app-sidebar.tsx), premiere
 * application a l'avoir construite : logo + sous-titre en entete, groupes de
 * liens avec puce de couleur, lien actif en surbrillance, pied de page.
 * Uniformiser le hub, c'est que chaque application compose CE composant avec
 * sa propre liste de liens plutot que de redessiner sa propre barre.
 *
 * Toujours sombre (classe `dark` posee ici, sur `ContenuBarreLaterale` —
 * repris tel quel dans le tiroir mobile) : la maquette de reference "Virtus"
 * a une sidebar unie sombre quel que soit le theme du reste de la page, qui
 * elle reste claire. Le theme sombre par defaut du hub (`globals.css`,
 * `.dark { --sidebar: ...; --sidebar-primary: <orange de marque>; }`) suffit
 * tel quel, aucune variable a retinter.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { GroupeNav, IconeComposant } from "./types";

function estActif(chemin: string, href: string) {
  if (href === chemin) return true;
  // Sous-pages actives (« /rh/absences/123 » sous « /rh/absences »), mais pas
  // l'accueil d'une section sur ses propres enfants.
  const segments = href.split("/").filter(Boolean);
  if (segments.length <= 1) return false;
  return chemin.startsWith(href + "/");
}

export function ContenuBarreLaterale({
  nomApp,
  sousTitre,
  icone: Icone,
  groupes,
  pied,
  avantGroupes,
}: {
  nomApp: string;
  sousTitre: string;
  icone: IconeComposant;
  groupes: GroupeNav[];
  pied?: string;
  /** Contenu propre a l'application, entre l'entete et les groupes de liens —
   * un commutateur de projet (Chantiers), un client actif (Planning)... */
  avantGroupes?: ReactNode;
}) {
  const chemin = usePathname();

  return (
    <div className="dark flex h-full flex-col bg-black/45 text-sidebar-foreground backdrop-blur-sm">
      <div className="flex h-16 items-center gap-2 px-5 border-b border-sidebar-border">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Icone className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="font-semibold text-sidebar-foreground">{nomApp}</p>
          <p className="text-xs text-muted-foreground">{sousTitre}</p>
        </div>
      </div>

      {avantGroupes}

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groupes.map((groupe) => (
          <div key={groupe.cle}>
            <div className="mb-1 flex items-center gap-2 px-3">
              <span className={cn("size-1.5 rounded-full", groupe.couleur)} />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {groupe.label}
              </p>
            </div>
            <div className="space-y-0.5">
              {groupe.items.map((item) => {
                const Icon = item.icon;
                const actif = estActif(chemin, item.href);
                const classe = cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  actif
                    ? "text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                );
                const indicateur = actif ? (
                  <motion.span
                    layoutId="sidebar-hub-actif"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    className="absolute inset-0 rounded-lg bg-sidebar-primary shadow-sm"
                  />
                ) : null;
                const contenu = (
                  <span className="relative flex items-center gap-3">
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </span>
                );
                return item.externe ? (
                  <a key={item.href} href={item.href} className={classe}>
                    {indicateur}
                    {contenu}
                  </a>
                ) : (
                  <Link key={item.href} href={item.href} className={classe}>
                    {indicateur}
                    {contenu}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {pied ? (
        <div className="border-t border-sidebar-border p-4 text-xs text-muted-foreground">{pied}</div>
      ) : null}
    </div>
  );
}

export function BarreLaterale(props: {
  nomApp: string;
  sousTitre: string;
  icone: IconeComposant;
  groupes: GroupeNav[];
  pied?: string;
  avantGroupes?: ReactNode;
}) {
  return (
    <aside className="dark hidden md:flex md:w-64 md:shrink-0 md:flex-col border-r border-sidebar-border">
      <ContenuBarreLaterale {...props} />
    </aside>
  );
}

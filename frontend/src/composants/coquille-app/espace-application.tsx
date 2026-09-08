"use client";

/**
 * L'assemblage complet : barre laterale + entete + contenu.
 *
 * Chaque application du hub compose ce seul wrapper avec sa propre
 * navigation, sa propre source de session (chacune garde la sienne — hub,
 * Jus d'orange, etc. — ce composant ne prejuge pas de comment elle
 * s'authentifie) et son propre contenu. C'est ce qui fait l'uniformite du
 * hub sans dupliquer le HTML/CSS d'une application a l'autre.
 *
 * La barre laterale seule porte l'identite sombre du hub (`theme-sombre.tsx`)
 * — l'entete et le contenu restent clairs, comme dans la maquette de
 * reference "Virtus" (sidebar sombre unie, canevas et entete clairs, cartes
 * blanches). D'abord montee ici pour Jus d'orange seulement, puis etendue a
 * RH, Chantiers et Planning — un seul point de montage plutot que dupliquer
 * la classe `dark` dans chaque `espace-*.tsx`.
 *
 * Un essai de « carte flottante avec marge » (l'app entiere retrecie avec
 * bordure/ombre/coins arrondis, le motif visible autour) a ete tente puis
 * rejete par l'utilisateur — « ça n'y ressemble pas du tout... retire la box,
 * il doit pas avoir les bordures ». L'application reste donc plein ecran,
 * sans marge ni coin arrondi.
 *
 * Le canevas (cette racine + `<main>`) est TRANSPARENT, pas `bg-slate-50` —
 * retour explicite de l'utilisateur apres avoir vu un fond gris clair opaque
 * la : « tu dois retirer la partie blanc, ça doit etre transparente pour
 * laisser place au bg orange ». `FondMotifPoster` (motif GDA, fixe plein
 * ecran, `-z-10`) se voit donc partout ou aucune carte opaque ne le couvre —
 * seules les cartes elles-memes (blanches, sombres, orange vif) restent
 * opaques, exactement comme dans la reference "Virtus" ou l'espace entre les
 * cartes laisse voir le fond, pas une couleur de canevas plate.
 */

import type { ReactNode } from "react";
import { BarreLaterale, ContenuBarreLaterale } from "./barre-laterale";
import { Entete } from "./entete";
import { FondMotifPoster } from "./theme-sombre";
import type { GroupeNav, IconeComposant, InfosUtilisateur } from "./types";

export function EspaceApplication({
  nomApp,
  sousTitre,
  icone,
  groupes,
  pied,
  avantGroupes,
  badgeLabel,
  badgeCouleur,
  utilisateur,
  onDeconnexion,
  rechercheVisible,
  hubHref,
  retourHubVisible,
  menuUtilisateur,
  children,
}: {
  nomApp: string;
  sousTitre: string;
  icone: IconeComposant;
  groupes: GroupeNav[];
  pied?: string;
  /** Contenu propre a l'application, entre l'entete de la barre laterale et
   * ses groupes de liens — un commutateur de projet (Chantiers)... */
  avantGroupes?: ReactNode;
  badgeLabel?: string;
  badgeCouleur?: string;
  utilisateur: InfosUtilisateur;
  onDeconnexion: () => void;
  rechercheVisible?: boolean;
  hubHref?: string;
  retourHubVisible?: boolean;
  menuUtilisateur?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-1">
      <FondMotifPoster />
      <BarreLaterale
        nomApp={nomApp}
        sousTitre={sousTitre}
        icone={icone}
        groupes={groupes}
        pied={pied}
        avantGroupes={avantGroupes}
      />
      <div className="flex flex-1 flex-col">
        <Entete
          badgeLabel={badgeLabel}
          badgeCouleur={badgeCouleur}
          utilisateur={utilisateur}
          onDeconnexion={onDeconnexion}
          rechercheVisible={rechercheVisible}
          hubHref={hubHref}
          retourHubVisible={retourHubVisible}
          menuUtilisateur={menuUtilisateur}
          contenuMobile={
            <ContenuBarreLaterale
              nomApp={nomApp}
              sousTitre={sousTitre}
              icone={icone}
              groupes={groupes}
              pied={pied}
              avantGroupes={avantGroupes}
            />
          }
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

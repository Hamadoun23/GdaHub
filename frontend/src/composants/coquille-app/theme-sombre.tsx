"use client";

/**
 * L'identite sombre de la barre laterale + le fond de marque de la coquille,
 * partages par toutes les applications du hub.
 *
 * Sidebar sombre (`CLASSE_SIDEBAR_SOMBRE`) : le theme sombre par defaut deja
 * present dans `globals.css` (`.dark { --sidebar: oklch(0.19 0.015 55);
 * --sidebar-primary: oklch(0.705 0.191 47.6) = l'orange de marque; ... }`)
 * est deja exactement ce qu'il faut — c'etait la version de Jus d'orange
 * avant que les tons du poster ne soient ajoutes par-dessus. Aucune variable
 * a retinter, juste la classe `dark` sur la sidebar (rien d'autre : entete
 * et contenu restent clairs).
 *
 * Fond de marque (`FondMotifPoster`) : le motif GDA (assets/motif/orange.jpg)
 * comme arriere-plan plein ecran, confirme explicitement par l'utilisateur en
 * comparant a nouveau la maquette de reference "Virtus" (« reprend bien la
 * maquette, comme fond le motif orange »). A la difference de la passe
 * precedente (jugee « pas top »), le motif n'est plus peint sur les cartes ni
 * sur le canevas de contenu lui-meme : il reste DERRIERE toute l'application,
 * qui flotte par-dessus comme une carte arrondie avec marge (`espace-
 * application.tsx`, a partir de `lg:`) — exactement la composition de la
 * reference (un cadre orange texture autour d'une carte sombre/claire), pas
 * un fond uniformement teinte.
 */

import Image from "next/image";

/** Classe a poser sur le conteneur direct de la barre laterale (desktop ET
 * tiroir mobile) pour activer son identite sombre — aucune variable a
 * retinter, le theme sombre par defaut du hub convient tel quel. */
export const CLASSE_SIDEBAR_SOMBRE = "dark";

/** Le motif de marque GDA, fixe plein ecran derriere toute la coquille. */
export function FondMotifPoster() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Image src="/img/motifs/orange.webp" alt="" fill priority className="object-cover" />
    </div>
  );
}

"use client";

/**
 * Le pendant de la tuile "New tasks 67%" de la reference Virtus — reprise
 * telle quelle : carte sombre (`bg-card`, meme jeton que `Card` dans
 * `parClaudeCodeDesktop`), anneau `CircularProgress` a degrade orange de
 * marque. Contenu 100% reel (le compte de `AFaire`), pas de pourcentage
 * invente : l'anneau montre la part urgente du total, pas un avancement
 * (aucune notion de tache "terminee" n'existe au niveau du hub).
 */

import { AnneauProgression } from "@/composants/dashboard-hub/anneau-progression";
import type { ElementAFaire } from "@/composants/dashboard-hub/utiliser-a-faire";

export function Total({ elements }: { elements: ElementAFaire[] | null }) {
  const total = elements?.length ?? 0;
  const urgents = elements?.filter((e) => e.urgent).length ?? 0;
  const partUrgente = total > 0 ? Math.round((urgents / total) * 100) : 0;

  return (
    <div className="flex flex-1 items-center gap-4 rounded-3xl border border-border bg-card p-5">
      <AnneauProgression
        valeur={partUrgente}
        taille={72}
        epaisseur={7}
        degrade={["#ffb673", "#e8481b"]}
        pisteCouleur="oklch(1 0 0 / 8%)"
      >
        <span className="text-base font-bold">{partUrgente}%</span>
      </AnneauProgression>
      <div className="min-w-0">
        <p className="text-3xl font-extrabold leading-none tracking-tight">{total}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {total > 1 ? "éléments à traiter" : "élément à traiter"}
          {total > 0 && <span> · {partUrgente}% urgent</span>}
        </p>
      </div>
    </div>
  );
}

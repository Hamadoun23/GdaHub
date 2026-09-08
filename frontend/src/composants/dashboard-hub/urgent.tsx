"use client";

/**
 * Carte orange pleine — le pendant de la tuile vive de la reference Virtus
 * (« Iisan Jone is going to join you for... »), mais sur du contenu reel :
 * l'element le plus urgent de `AFaire` (un retard Planning, pour l'instant
 * la seule source qui en produit). N'apparait que s'il y a reellement un
 * urgent a montrer — pas de carte vide pour occuper l'espace. Vrai orange de
 * marque (`--color-marque-500/700`), pas le ton plus brun du poster : la
 * reference a un orange vif et sature, pas une teinte terreuse.
 */

import Link from "next/link";
import { ArrowUpRight, AlertTriangle } from "lucide-react";

import type { ElementAFaire } from "@/composants/dashboard-hub/utiliser-a-faire";

export function Urgent({ elements }: { elements: ElementAFaire[] | null }) {
  const premier = elements?.find((e) => e.urgent);
  if (!premier) return null;

  return (
    <Link
      href={premier.href}
      className="group flex flex-1 flex-col justify-between rounded-3xl bg-gradient-to-br from-marque-500 to-marque-700 p-5 text-white shadow-lg shadow-marque-700/30 transition hover:brightness-110"
    >
      <div className="flex items-start justify-between">
        <span className="flex size-9 items-center justify-center rounded-full bg-white/20">
          <AlertTriangle size={16} />
        </span>
        <ArrowUpRight size={18} className="text-white/70 transition group-hover:text-white" />
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Le plus urgent</p>
        <p className="mt-1 font-bold leading-snug">{premier.titre}</p>
        <p className="mt-1 text-sm text-white/80">{premier.sousTitre}</p>
      </div>
    </Link>
  );
}

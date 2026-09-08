"use client";

/**
 * Ce qui attend l'utilisateur connecte sur ses propres applications — pas
 * des statistiques de connexion au hub, mais de vrais elements a traiter ou
 * a surveiller : demandes RH/Finance en attente de sa decision, tournages ou
 * publications Planning en retard ou imminents.
 *
 * Le chargement vit dans `utiliser-a-faire.ts` (partage avec `resume.tsx`) ;
 * ce composant ne fait plus que l'affichage. Chaque ligne montre un avatar
 * d'initiales (la personne ou le client concerne — donnee reelle,
 * `element.personne`) plutot qu'une simple icone d'application, avec un petit
 * badge d'application en incrustation.
 *
 * Rangee de filtres pilule (Tout / En retard / À venir / À valider), reprise
 * du motif d'onglets de `PerformanceSection` dans la reference "Virtus"
 * devenue reelle (`GdaHub/assets/dash/parClaudeCodeDesktop`) — seule une
 * pilule dont l'etat existe reellement dans les elements charges s'affiche,
 * jamais une categorie vide juste pour completer la rangee.
 *
 * Carte sombre (`bg-card`) : le canevas de cette page est desormais lui-meme
 * sombre (voir `app/tableau-de-bord/page.tsx`), comme le reste du paquet
 * `parClaudeCodeDesktop` — les badges d'etat passent a des teintes
 * translucides lisibles sur fond sombre plutot qu'aux fonds pastel clairs
 * d'origine.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/cn";
import { iconePourApplication } from "@/lib/icones-applications";
import { initialesDepuis } from "@/composants/coquille-app/initiales";
import type { ElementAFaire } from "@/composants/dashboard-hub/utiliser-a-faire";

const BADGE_ETAT: Record<ElementAFaire["etat"], { libelle: string; classe: string }> = {
  retard: { libelle: "En retard", classe: "bg-red-500/15 text-red-400" },
  a_venir: { libelle: "À venir", classe: "bg-primary/15 text-primary" },
  a_valider: { libelle: "À valider", classe: "bg-amber-500/15 text-amber-400" },
};

type Filtre = "tout" | ElementAFaire["etat"];

export function AFaire({
  elements,
  couleurParCode,
}: {
  elements: ElementAFaire[] | null;
  couleurParCode: Record<string, string>;
}) {
  const [filtre, setFiltre] = useState<Filtre>("tout");

  const tries = elements ? [...elements].sort((a, b) => Number(b.urgent) - Number(a.urgent)) : [];
  const parEtat = useMemo(() => {
    const compte: Record<ElementAFaire["etat"], number> = { retard: 0, a_venir: 0, a_valider: 0 };
    for (const element of tries) compte[element.etat] += 1;
    return compte;
  }, [tries]);
  const affiches = filtre === "tout" ? tries : tries.filter((element) => element.etat === filtre);

  const toutesPilules: { cle: Filtre; libelle: string; compte: number }[] = [
    { cle: "tout", libelle: "Tout", compte: tries.length },
    { cle: "retard", libelle: "En retard", compte: parEtat.retard },
    { cle: "a_venir", libelle: "À venir", compte: parEtat.a_venir },
    { cle: "a_valider", libelle: "À valider", compte: parEtat.a_valider },
  ];
  const pilules = toutesPilules.filter((pilule) => pilule.cle === "tout" || pilule.compte > 0);

  return (
    <div className="h-full rounded-3xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">À faire</h2>
        {tries.length > 0 && pilules.length > 1 && (
          <div className="flex flex-wrap gap-1 rounded-full bg-secondary p-1">
            {pilules.map((pilule) => (
              <button
                key={pilule.cle}
                type="button"
                onClick={() => setFiltre(pilule.cle)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  filtre === pilule.cle
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {pilule.libelle} · {pilule.compte}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        {elements === null ? (
          <p className="px-2 text-sm text-muted-foreground">Chargement…</p>
        ) : tries.length === 0 ? (
          <p className="px-2 text-sm text-muted-foreground">Tout est a jour sur vos applications.</p>
        ) : (
          <ul className="space-y-2">
            {affiches.slice(0, 8).map((element) => {
              const Icone = iconePourApplication(element.code);
              const couleur = couleurParCode[element.code] || "#eb6834";
              const badge = BADGE_ETAT[element.etat];
              return (
                <li key={element.cle}>
                  <Link
                    href={element.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition",
                      element.urgent
                        ? "border-red-500/20 bg-red-500/10 hover:border-red-500/40"
                        : "border-transparent hover:bg-secondary",
                    )}
                  >
                    <span className="relative shrink-0">
                      <span
                        className="flex size-10 items-center justify-center rounded-2xl text-xs font-semibold text-white"
                        style={{ background: couleur }}
                      >
                        {initialesDepuis(element.personne)}
                      </span>
                      <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-secondary ring-2 ring-card">
                        <Icone size={10} strokeWidth={2.5} />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{element.titre}</span>
                      <span className="block truncate text-xs text-muted-foreground">{element.sousTitre}</span>
                    </span>
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
                        badge.classe,
                      )}
                    >
                      {element.urgent && <AlertTriangle size={11} />}
                      {badge.libelle}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

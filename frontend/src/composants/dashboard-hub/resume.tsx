"use client";

/**
 * Carte sombre de synthese — le pendant "Performance exceptionnelle" de la
 * reference Virtus, mais nourrie par les memes elements reels que `AFaire`
 * (aucune donnee inventee) : un vrai graphique (recharts, deja utilise
 * ailleurs dans le hub — voir `graphique-connexions.tsx`) de la repartition
 * par application, pas une courbe de tendance inventee.
 *
 * Carte pleine (`bg-card`, meme jeton que `Card` dans le paquet
 * `parClaudeCodeDesktop`) : le canevas de cette page est desormais lui-meme
 * sombre et opaque (voir `app/tableau-de-bord/page.tsx`), plus besoin d'un
 * degrade a opacite reduite pour laisser deviner un motif dessous.
 */

import { Cell, Pie, PieChart } from "recharts";

import { ChartContainer } from "@/ui/chart";
import { iconePourApplication } from "@/lib/icones-applications";
import type { ElementAFaire } from "@/composants/dashboard-hub/utiliser-a-faire";

const ORANGE_MARQUE = "#eb6834";

/** Regroupement par defaut : les trois sources du hub. Un appelant hors hub
 * (RH, Jus d'orange) passe ses propres `groupes` — memes composant et
 * habillage, une repartition adaptee a son domaine plutot qu'a des
 * applications. */
const GROUPES_HUB = [
  { code: "rh", nom: "RH" },
  { code: "finance", nom: "Finance" },
  { code: "planning", nom: "Planning" },
];

export function Resume({
  elements,
  couleurParCode,
  groupes = GROUPES_HUB,
  titre = "Résumé",
  sousTitre = "Ce qui attend sur vos applications",
  messageVide = "Rien en attente sur vos applications.",
}: {
  elements: ElementAFaire[] | null;
  couleurParCode: Record<string, string>;
  /** Categories du donut (code + libelle) ; par defaut les trois sources du
   * hub (RH/Finance/Planning). */
  groupes?: { code: string; nom: string }[];
  titre?: string;
  sousTitre?: string;
  messageVide?: string;
}) {
  const total = elements?.length ?? 0;
  const urgents = elements?.filter((e) => e.urgent).length ?? 0;

  const parApplication = groupes
    .map(({ code, nom }) => ({ code, nom, valeur: elements?.filter((e) => e.code === code).length ?? 0 }))
    .filter((ligne) => ligne.valeur > 0);

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full blur-[70px]"
        style={{ background: `color-mix(in srgb, ${ORANGE_MARQUE} 35%, transparent)` }}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">{titre}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{sousTitre}</p>
        </div>
        {urgents > 0 && (
          <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
            {urgents} urgent{urgents > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="relative mt-8 mb-2 text-sm text-muted-foreground">{messageVide}</p>
      ) : (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-6">
          <div className="relative size-[180px] shrink-0">
            <ChartContainer config={{}} className="aspect-square size-[180px]">
              <PieChart>
                <Pie
                  data={parApplication}
                  dataKey="valeur"
                  nameKey="nom"
                  innerRadius={64}
                  outerRadius={90}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {parApplication.map((ligne) => (
                    <Cell key={ligne.code} fill={couleurParCode[ligne.code] || ORANGE_MARQUE} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-extrabold tracking-tight">{total}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">au total</span>
            </div>
          </div>

          <ul className="w-full max-w-xs space-y-2.5">
            {parApplication.map((ligne) => {
              const Icone = iconePourApplication(ligne.code);
              const couleur = couleurParCode[ligne.code] || ORANGE_MARQUE;
              return (
                <li key={ligne.code} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `color-mix(in srgb, ${couleur} 25%, transparent)` }}
                  >
                    <Icone size={13} style={{ color: couleur }} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{ligne.nom}</span>
                  <span className="font-semibold">{ligne.valeur}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

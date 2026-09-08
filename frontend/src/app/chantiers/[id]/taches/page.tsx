"use client";

/**
 * Toutes les taches du chantier, groupees par phase — fidele a
 * `renderAllTasks()` (public/js/gda-app.js) : un bandeau par phase avec son
 * pourcentage moyen, puis ses taches avec une barre a quatre paliers
 * (le detail par tache distingue « en cours » de « bien avance », ce que le
 * tableau de bord n'a pas besoin de faire au niveau d'une phase entiere).
 */

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Alerte, Chargement } from "@/chantiers/composants/ui";
import { chantiers, ErreurChantiers } from "@/chantiers/lib/api";
import type { StatutTache, Tache } from "@/chantiers/lib/types";

const LABELS_STATUT: Record<StatutTache, string> = {
  non_demarre: "Non demarre",
  en_cours: "En cours",
  termine: "Termine",
  annule: "Annule",
};

const STATUTS_FILTRE = ["", "non_demarre", "en_cours", "termine", "annule"] as const;

function classesBarre(progress: number) {
  if (progress === 100) return "bg-emerald-600";
  if (progress > 50) return "bg-[#b87c10]";
  if (progress > 0) return "bg-primary";
  return "bg-muted";
}

export default function PageTaches() {
  const { id } = useParams<{ id: string }>();
  const projetId = Number(id);

  const [taches, setTaches] = useState<Tache[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [phaseChoisie, setPhaseChoisie] = useState("");
  const [statutChoisi, setStatutChoisi] = useState<(typeof STATUTS_FILTRE)[number]>("");

  useEffect(() => {
    chantiers
      .taches(projetId)
      .then((page) => setTaches(page.results))
      .catch((probleme) =>
        setErreur(probleme instanceof ErreurChantiers ? probleme.message : "La liste des taches ne repond pas."),
      );
  }, [projetId]);

  const phases = useMemo(() => [...new Set((taches ?? []).map((t) => t.phase))], [taches]);

  const groupes = useMemo(() => {
    if (!taches) return [];
    const filtrees = taches.filter(
      (t) => (!phaseChoisie || t.phase === phaseChoisie) && (!statutChoisi || t.status === statutChoisi),
    );
    const parPhase = new Map<string, Tache[]>();
    for (const tache of filtrees) {
      parPhase.set(tache.phase, [...(parPhase.get(tache.phase) ?? []), tache]);
    }
    return [...parPhase.entries()].map(([phase, lignes]) => ({
      phase,
      lignes,
      progression: Math.round(lignes.reduce((s, t) => s + t.progress, 0) / lignes.length),
    }));
  }, [taches, phaseChoisie, statutChoisi]);

  if (erreur) return <Alerte>{erreur}</Alerte>;
  if (!taches) return <Chargement />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[28px] font-bold uppercase tracking-wide text-foreground sm:text-[36px]">
          Toutes les taches
        </h1>
        <div className="flex gap-2">
          <select
            value={phaseChoisie}
            onChange={(e) => setPhaseChoisie(e.target.value)}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary"
          >
            <option value="">Toutes les phases</option>
            {phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={statutChoisi}
            onChange={(e) => setStatutChoisi(e.target.value as typeof statutChoisi)}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary"
          >
            <option value="">Tous les statuts</option>
            {STATUTS_FILTRE.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {LABELS_STATUT[s as StatutTache]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {taches.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune tache pour l&apos;instant.</p>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-border bg-white">
          {groupes.map(({ phase, lignes, progression }) => (
            <div key={phase}>
              <div className="flex items-center justify-between bg-muted px-5 py-2.5">
                <p className="text-xs font-bold uppercase tracking-wide text-foreground">{phase}</p>
                <p className={`text-xs font-bold ${progression === 100 ? "text-emerald-600" : "text-primary"}`}>
                  {progression}% termine
                </p>
              </div>
              <ul className="divide-y divide-[#e8e4dc]">
                {lignes.map((tache) => (
                  <li key={tache.id} className="grid grid-cols-[1fr_140px_60px] items-center gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{tache.activity}</p>
                      <p className="truncate text-xs text-muted-foreground">{tache.subphase}</p>
                    </div>
                    <span className="h-[5px] overflow-hidden rounded-full bg-border">
                      <span
                        className={`block h-full rounded-full ${classesBarre(tache.progress)}`}
                        style={{ width: `${tache.progress}%` }}
                      />
                    </span>
                    <span
                      className={`text-right text-sm font-bold tabular-nums ${
                        tache.progress === 100 ? "text-emerald-600" : "text-primary"
                      }`}
                    >
                      {tache.progress}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

/** Tableau de bord d'un chantier : avancement global, par phase, activite recente. */

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Alerte, BarrePhase, BoutonChantier, Carte, Chargement, EnTetePageChantier, StatChantier } from "@/chantiers/composants/ui";
import { chantiers, ErreurChantiers } from "@/chantiers/lib/api";
import type { TableauDeBord } from "@/chantiers/lib/types";

export default function PageTableauDeBordChantier() {
  const { id } = useParams<{ id: string }>();
  const projetId = Number(id);

  const [donnees, setDonnees] = useState<TableauDeBord | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    chantiers
      .tableauDeBord(projetId)
      .then(setDonnees)
      .catch((probleme) =>
        setErreur(probleme instanceof ErreurChantiers ? probleme.message : "Le tableau de bord ne repond pas."),
      );
  }, [projetId]);

  if (erreur) return <Alerte>{erreur}</Alerte>;
  if (!donnees) return <Chargement />;

  return (
    <div>
      <EnTetePageChantier
        titre="Tableau de bord"
        sousTitre="Vue d'ensemble du projet"
        actions={
          <a href={`/chantiers/${projetId}/saisie`}>
            <BoutonChantier>Saisie du jour</BoutonChantier>
          </a>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChantier libelle="Taches totales" valeur={donnees.stats.total} ton="bleu" />
        <StatChantier libelle="Terminees" valeur={donnees.stats.done} ton="vert" />
        <StatChantier libelle="En cours" valeur={donnees.stats.in_progress} ton="orange" />
        <StatChantier libelle="Annulees" valeur={donnees.stats.cancelled} ton="rouge" />
      </div>

      {donnees.progress_by_phase.length > 0 ? (
        <Carte titre="Avancement par phase">
          {donnees.progress_by_phase.map((phase) => (
            <BarrePhase key={phase.phase} nom={phase.phase} pourcentage={phase.progress} />
          ))}
        </Carte>
      ) : null}

      <Carte titre="Activite recente" sansPadding>
        {donnees.recent_activity.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Aucune saisie pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-[#e8e4dc]">
            {donnees.recent_activity.map((entree) => (
              <li key={`${entree.task_id}-${entree.date}`} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{entree.task_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {entree.date} — {entree.user}
                    {entree.comment ? ` — ${entree.comment}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-primary">{entree.progress}%</span>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </div>
  );
}

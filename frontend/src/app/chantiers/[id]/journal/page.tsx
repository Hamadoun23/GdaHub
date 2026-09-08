"use client";

/**
 * Journal d'activite — reserve a l'equipe interne.
 *
 * Le backend refuse deja l'acces a un partenaire (403, cf.
 * `chantiers.permissions.EstEquipeInterne`) : cet ecran ne fait qu'afficher
 * ce refus proprement plutot que de laisser paraitre une erreur brute.
 */

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Alerte, Cellule, Chargement, LigneTableau, Tableau } from "@/chantiers/composants/ui";
import { chantiers, ErreurChantiers } from "@/chantiers/lib/api";
import type { JournalActivite } from "@/chantiers/lib/types";

const TONS_ACTION: Record<string, string> = {
  delete: "bg-[#fce8e8] text-destructive",
  login_failed: "bg-[#fce8e8] text-destructive",
  login: "bg-[#e8eef5] text-sky-600",
};

function tonAction(action: string) {
  for (const [motif, classes] of Object.entries(TONS_ACTION)) {
    if (action.includes(motif)) return classes;
  }
  return "bg-[#ede9e0] text-muted-foreground";
}

export default function PageJournal() {
  const { id } = useParams<{ id: string }>();
  const projetId = Number(id);

  const [journal, setJournal] = useState<JournalActivite | null>(null);
  const [erreur, setErreur] = useState("");
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    chantiers
      .journal({ projetId, page, q: q || undefined, action: action || undefined })
      .then(setJournal)
      .catch((probleme) =>
        setErreur(
          probleme instanceof ErreurChantiers && probleme.statut === 403
            ? "Le journal d'activite est reserve a l'equipe interne."
            : "Le journal ne repond pas.",
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetId, page]);

  function rechercher(evenement: React.FormEvent) {
    evenement.preventDefault();
    setPage(1);
    chantiers
      .journal({ projetId, page: 1, q: q || undefined, action: action || undefined })
      .then(setJournal)
      .catch(() => setErreur("Le journal ne repond pas."));
  }

  if (erreur) return <Alerte>{erreur}</Alerte>;
  if (!journal) return <Chargement />;

  return (
    <div>
      <h1 className="mb-6 text-[28px] font-bold uppercase tracking-wide text-foreground sm:text-[36px]">
        Journal d&apos;activite
      </h1>

      <form onSubmit={rechercher} className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher..."
          className="min-w-[12rem] flex-1 rounded-xl border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-primary"
        >
          <option value="">Toutes les actions</option>
          {journal.filters.actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl border border-border px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-foreground hover:bg-muted"
        >
          Filtrer
        </button>
      </form>

      <Tableau entetes={["Date", "Utilisateur", "Action", "Description"]} vide={journal.logs.length === 0}>
        {journal.logs.map((ligne) => (
          <LigneTableau key={ligne.id}>
            <Cellule className="whitespace-nowrap text-muted-foreground">
              {new Date(ligne.created_at).toLocaleString("fr-FR")}
            </Cellule>
            <Cellule>{ligne.user_name || "—"}</Cellule>
            <Cellule>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tonAction(ligne.action)}`}>
                {ligne.action}
              </span>
            </Cellule>
            <Cellule>{ligne.description || "—"}</Cellule>
          </LigneTableau>
        ))}
      </Tableau>

      {journal.meta.last_page > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-border px-3 py-1 disabled:opacity-40"
          >
            Precedent
          </button>
          <span className="text-muted-foreground">
            Page {journal.meta.current_page} / {journal.meta.last_page} ({journal.meta.total})
          </span>
          <button
            type="button"
            disabled={page >= journal.meta.last_page}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-border px-3 py-1 disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      ) : null}
    </div>
  );
}

"use client";

/** La derniere activite de connexion du hub — les memes lignes que le journal, en plus court. */

import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import type { ConnexionJournal } from "./types";

function relatif(dateIso: string): string {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "a l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.round(heures / 24);
  return `il y a ${jours} j`;
}

export function ActiviteRecente({ connexions }: { connexions: ConnexionJournal[] }) {
  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>Activite recente</CardTitle>
        <CardDescription>Dernieres tentatives de connexion au hub</CardDescription>
      </CardHeader>
      <CardContent>
        {connexions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune connexion enregistree.</p>
        ) : (
          <ul className="-mx-2">
            {connexions.slice(0, 6).map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-ardoise-50 dark:hover:bg-ardoise-800/60"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                  style={{
                    background: c.reussie
                      ? "linear-gradient(135deg, var(--chart-3), color-mix(in srgb, var(--chart-3) 65%, black))"
                      : "linear-gradient(135deg, #ef4444, #b91c1c)",
                  }}
                >
                  {c.reussie ? <Check size={14} /> : <X size={14} />}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{c.identifiant_saisi}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{relatif(c.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

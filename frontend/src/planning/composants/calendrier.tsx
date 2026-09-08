"use client";

/**
 * La grille de calendrier partagee par le tableau de bord, les tournages, les
 * publications et la vue client — meme structure de semaines/jours que
 * `buildCombinedCalendar()` cote Laravel, memes couleurs d'evenement que la
 * legende de production (dashboard.blade.php).
 */

import { useRouter } from "next/navigation";
import { cx, MOIS_FR } from "./ui";
import type { Grille, Publication, Tournage } from "../lib/types";

const JOURS_ENTETE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function couleurTournage(t: Tournage) {
  if (t.status === "cancelled") return { fond: "#6c757d", bordure: "#5a6268", icone: "❌" };
  if (t.status === "completed") return { fond: "#28a745", bordure: "#1e7e34", icone: "✅" };
  if (t.is_overdue) return { fond: "#dc3545", bordure: "#c82333", icone: "🚨" };
  if (t.is_upcoming) return { fond: "#ffc107", bordure: "#ff9800", icone: "⏰" };
  return { fond: "var(--primary)", bordure: "var(--primary)", icone: "📹" };
}

function couleurPublication(p: Publication) {
  if (p.status === "not_realized") return { fond: "#6c757d", bordure: "#5a6268", icone: "❌" };
  if (p.status === "cancelled") return { fond: "#6c757d", bordure: "#5a6268", icone: "🚫" };
  if (p.status === "rescheduled") return { fond: "#17a2b8", bordure: "#138496", icone: "📅" };
  if (p.status === "completed") return { fond: "#28a745", bordure: "#1e7e34", icone: "✅" };
  if (p.is_overdue) return { fond: "#dc3545", bordure: "#c82333", icone: "🚨" };
  if (p.is_upcoming) return { fond: "#ffc107", bordure: "#ff9800", icone: "⏰" };
  if (p.day_not_recommended_warning) return { fond: "#ffc107", bordure: "#ff9800", icone: "⚠️" };
  return { fond: "#28a745", bordure: "#1e7e34", icone: "📢" };
}

export function Calendrier({
  grille,
  mois,
  annee,
  onMoisChange,
  onAnneeChange,
  afficherTournages = true,
  afficherPublications = true,
  lienExport,
  titre,
}: {
  grille: Grille;
  mois: number;
  annee: number;
  onMoisChange: (m: number) => void;
  onAnneeChange: (a: number) => void;
  afficherTournages?: boolean;
  afficherPublications?: boolean;
  lienExport?: string;
  titre?: string;
}) {
  const routeur = useRouter();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-foreground">
          {titre || "Planning"} — {MOIS_FR[mois]} {annee}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={mois}
            onChange={(e) => onMoisChange(Number(e.target.value))}
            className="rounded border border-input px-3 py-1.5 text-sm font-medium"
          >
            {MOIS_FR.slice(1).map((nom, index) => (
              <option key={nom} value={index + 1}>
                {nom}
              </option>
            ))}
          </select>
          <select
            value={annee}
            onChange={(e) => onAnneeChange(Number(e.target.value))}
            className="rounded border border-input px-3 py-1.5 text-sm font-medium"
          >
            {Array.from({ length: 11 }, (_, i) => 2020 + i).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          {lienExport ? (
            <a href={lienExport} className="rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--primary)]">
              📊 Exporter
            </a>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr>
              {JOURS_ENTETE.map((jour, i) => (
                <th
                  key={jour}
                  className={cx(
                    "border border-border p-3 text-center text-sm font-semibold text-white",
                    i < 5 ? "bg-[var(--primary)]" : "bg-muted-foreground opacity-70",
                  )}
                  style={{ width: "14.28%" }}
                >
                  {jour}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grille.map((semaine, si) => (
              <tr key={si}>
                {semaine.map((jour) => {
                  const dateObj = new Date(jour.date + "T00:00:00");
                  const weekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                  const fond = !jour.est_mois_courant
                    ? "#f5f5f5"
                    : weekend
                      ? "#e9e9e9"
                      : jour.avertissement
                        ? "#fff3cd"
                        : "#fff";
                  return (
                    <td
                      key={jour.date}
                      className="h-[150px] border border-border p-2 align-top"
                      style={{ backgroundColor: fond, opacity: weekend ? 0.85 : 1 }}
                    >
                      <div className="mb-1 flex items-center gap-1.5 text-sm font-bold" style={{ color: jour.est_mois_courant ? "var(--foreground)" : "#999" }}>
                        <span>{dateObj.getDate()}</span>
                        {jour.avertissement ? <span className="text-xs">⚠️</span> : null}
                      </div>
                      <div className="max-h-[105px] space-y-1 overflow-y-auto">
                        {afficherTournages
                          ? jour.tournages.map((t) => {
                              const c = couleurTournage(t);
                              return (
                                <button
                                  key={`t${t.id}`}
                                  type="button"
                                  onClick={() => routeur.push(`/planning/tournages?id=${t.id}`)}
                                  title={`Tournage — ${t.client_nom} — ${t.status}`}
                                  className="block w-full rounded px-1.5 py-1 text-left text-[11px] leading-tight text-white"
                                  style={{ backgroundColor: c.fond, borderLeft: `3px solid ${c.bordure}` }}
                                >
                                  <strong className="block truncate">
                                    {c.icone} {t.client_nom}
                                  </strong>
                                </button>
                              );
                            })
                          : null}
                        {afficherPublications
                          ? jour.publications.map((p) => {
                              const c = couleurPublication(p);
                              return (
                                <button
                                  key={`p${p.id}`}
                                  type="button"
                                  onClick={() => routeur.push(`/planning/publications?id=${p.id}`)}
                                  title={`Publication — ${p.client_nom} — ${p.status}`}
                                  className="block w-full rounded px-1.5 py-1 text-left text-[11px] leading-tight text-white"
                                  style={{ backgroundColor: c.fond, borderLeft: `3px solid ${c.bordure}` }}
                                >
                                  <strong className="block truncate">
                                    {c.icone} {p.client_nom}
                                  </strong>
                                  {p.content_idea_detail ? (
                                    <span className="block truncate opacity-90">{p.content_idea_detail.titre}</span>
                                  ) : null}
                                </button>
                              );
                            })
                          : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded bg-muted p-4">
        <h4 className="mb-2 text-sm font-semibold text-foreground">Légende :</h4>
        <div className="flex flex-wrap gap-4 text-sm text-foreground">
          <span className="flex items-center gap-2"><span className="h-4 w-4 rounded bg-[var(--primary)]" />📹 Tournage</span>
          <span className="flex items-center gap-2"><span className="h-4 w-4 rounded bg-[#28a745]" />📢 Publication</span>
          <span className="flex items-center gap-2"><span className="h-4 w-4 rounded bg-[#ffc107]" />⏰ Approche (3 jours)</span>
          <span className="flex items-center gap-2"><span className="h-4 w-4 rounded bg-[#dc3545]" />🚨 En retard</span>
          <span className="flex items-center gap-2"><span className="h-4 w-4 rounded bg-[#28a745]" />✅ Complété</span>
          <span className="flex items-center gap-2"><span className="h-4 w-4 rounded bg-[#6c757d]" />❌ Échec/Annulé</span>
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * Rapport de chantier : parametres, apercu, generation et telechargement PDF.
 *
 * Le PDF genere par le backend (reportlab) est plus sobre que le veritable
 * rapport DomPDF de l'original — bandeaux colores, table fusionnee par phase,
 * graphiques integres en image. Reproduire cette richesse demande de
 * generer des images de graphiques cote client et de les transmettre au
 * serveur ; ce n'est pas encore fait. L'apercu a l'ecran, lui, reprend fidele
 * ment la structure reelle (cartes KPI, table par phase).
 */

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Alerte,
  BoutonChantier,
  Carte,
  Cellule,
  Chargement,
  LigneTableau,
  StatChantier,
  Tableau,
} from "@/chantiers/composants/ui";
import { chantiers, ErreurChantiers } from "@/chantiers/lib/api";
import type { Rapport, TableauDeBord } from "@/chantiers/lib/types";

const OPTIONS_METEO = ["Ensoleille", "Ensoleille et venteux", "Nuageux", "Pluvieux", "Venteux", "Orageux"];

export default function PageRapport() {
  const { id } = useParams<{ id: string }>();
  const projetId = Number(id);

  const [donnees, setDonnees] = useState<TableauDeBord | null>(null);
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [erreur, setErreur] = useState("");
  const [temperature, setTemperature] = useState(37);
  const [meteo, setMeteo] = useState(OPTIONS_METEO[1]);
  const [notes, setNotes] = useState("");
  const [generation, setGeneration] = useState(false);

  const charger = () => {
    Promise.all([chantiers.tableauDeBord(projetId), chantiers.rapports(projetId)])
      .then(([tableau, page]) => {
        setDonnees(tableau);
        setRapports(page.results);
      })
      .catch((probleme) =>
        setErreur(probleme instanceof ErreurChantiers ? probleme.message : "Le rapport ne repond pas."),
      );
  };

  useEffect(charger, [projetId]);

  async function genererEtTelecharger() {
    setGeneration(true);
    setErreur("");
    try {
      const { report } = await chantiers.genererRapport(projetId, { weather: meteo, temperature, notes });
      window.open(chantiers.urlRapportPdf(report.id), "_blank");
      charger();
    } catch (probleme) {
      setErreur(probleme instanceof ErreurChantiers ? probleme.message : "Generation impossible.");
    } finally {
      setGeneration(false);
    }
  }

  if (erreur && !donnees) return <Alerte>{erreur}</Alerte>;
  if (!donnees) return <Chargement />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-[28px] font-bold uppercase tracking-wide text-foreground sm:text-[36px]">
          Rapport de chantier
        </h1>
        <BoutonChantier onClick={genererEtTelecharger} disabled={generation}>
          {generation ? "Generation..." : "Generer et telecharger le PDF"}
        </BoutonChantier>
      </div>

      {erreur ? <Alerte>{erreur}</Alerte> : null}

      <Carte titre="Parametres du rapport">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Temperature (°C)
            </span>
            <input
              type="number"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meteo</span>
            <select
              value={meteo}
              onChange={(e) => setMeteo(e.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {OPTIONS_METEO.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-3">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
      </Carte>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatChantier libelle="Avancement" valeur={`${donnees.overall_progress}%`} ton="orange" />
        <StatChantier libelle="Taches" valeur={donnees.stats.total} ton="bleu" />
        <StatChantier libelle="Terminees" valeur={donnees.stats.done} ton="vert" />
        <StatChantier libelle="En cours" valeur={donnees.stats.in_progress} ton="orange" />
        <StatChantier libelle="Annulees" valeur={donnees.stats.cancelled} ton="rouge" />
      </div>

      <Carte titre="Detail par tache" sansPadding>
        <Tableau entetes={["Phase", "Activite", "Avancement", "Statut"]} sansCadre>
          {donnees.activities.map((a) => (
            <LigneTableau key={a.id}>
              <Cellule className="text-muted-foreground">
                {a.phase} — {a.subphase}
              </Cellule>
              <Cellule>{a.activity}</Cellule>
              <Cellule>
                <div className="flex items-center gap-2">
                  <span className="h-[5px] w-24 overflow-hidden rounded-full bg-border">
                    <span
                      className={`block h-full rounded-full ${a.progress === 100 ? "bg-emerald-600" : "bg-primary"}`}
                      style={{ width: `${a.progress}%` }}
                    />
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">{a.progress}%</span>
                </div>
              </Cellule>
              <Cellule className="text-muted-foreground">{a.status}</Cellule>
            </LigneTableau>
          ))}
        </Tableau>
      </Carte>

      {rapports.length > 0 ? (
        <Carte titre="Rapports precedents" sansPadding>
          <ul className="divide-y divide-border">
            {rapports.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-foreground">
                  {r.report_date} — {r.overall_progress}% — {r.weather}
                  {r.temperature ? ` (${r.temperature}°C)` : ""}
                </span>
                <a
                  href={chantiers.urlRapportPdf(r.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold uppercase tracking-wide text-primary hover:underline"
                >
                  Telecharger
                </a>
              </li>
            ))}
          </ul>
        </Carte>
      ) : null}
    </div>
  );
}

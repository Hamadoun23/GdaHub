"use client";

/**
 * Saisie du jour : l'ecran que l'equipe sur le terrain ouvre chaque matin.
 *
 * Fidele au fonctionnement reel (public/js/gda-app.js, `renderDaily` /
 * `saveDailyAll`) : chaque curseur ne modifie qu'un etat local — aucun appel
 * reseau tant que « Enregistrer toutes les modifications » n'est pas
 * actionne. C'est ce qui rend la saisie de vingt taches supportable sur un
 * telephone, en bord de reseau.
 */

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Alerte, BoutonChantier, Carte, Chargement } from "@/chantiers/composants/ui";
import { chantiers, ErreurChantiers } from "@/chantiers/lib/api";
import type { StatutTache, Tache } from "@/chantiers/lib/types";

type LigneSaisie = {
  task: Tache;
  daily_update: { progress: number; status: StatutTache; comment: string } | null;
  effective_progress: number;
  effective_status: StatutTache;
};

type Modification = { progress: number; comment: string; progress_note: string };

const LABELS_STATUT: Record<StatutTache, string> = {
  non_demarre: "Non demarre",
  en_cours: "En cours",
  termine: "Termine",
  annule: "Annule",
};

function statutDeProgression(progress: number): StatutTache {
  if (progress >= 100) return "termine";
  if (progress > 0) return "en_cours";
  return "non_demarre";
}

function couleurBarre(pourcentage: number) {
  if (pourcentage === 100) return "bg-emerald-600";
  if (pourcentage > 0) return "bg-primary";
  return "bg-muted";
}

const FILTRES = [
  { cle: "all", libelle: "Toutes" },
  { cle: "ip", libelle: "En cours" },
  { cle: "nd", libelle: "Non demarrees" },
] as const;

export default function PageSaisieDuJour() {
  const { id } = useParams<{ id: string }>();
  const projetId = Number(id);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lignes, setLignes] = useState<LigneSaisie[] | null>(null);
  const [modifications, setModifications] = useState<Record<number, Modification>>({});
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]["cle"]>("all");
  const [erreur, setErreur] = useState("");
  const [erreursParTache, setErreursParTache] = useState<Record<number, string>>({});
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState("");

  const charger = (dateChoisie: string) => {
    setLignes(null);
    setModifications({});
    setErreur("");
    chantiers
      .saisieDuJour(projetId, dateChoisie)
      .then((reponse) => setLignes(reponse.items as LigneSaisie[]))
      .catch((probleme) =>
        setErreur(probleme instanceof ErreurChantiers ? probleme.message : "La saisie du jour ne repond pas."),
      );
  };

  useEffect(() => charger(date), [projetId, date]);

  const lignesFiltrees = useMemo(() => {
    if (!lignes) return [];
    if (filtre === "all") return lignes;
    if (filtre === "ip") return lignes.filter((l) => l.effective_status === "en_cours");
    return lignes.filter((l) => l.effective_status === "non_demarre");
  }, [lignes, filtre]);

  function modifier(tacheId: number, progress: number) {
    setModifications((actuelles) => ({
      ...actuelles,
      [tacheId]: { progress, comment: actuelles[tacheId]?.comment ?? "", progress_note: actuelles[tacheId]?.progress_note ?? "" },
    }));
  }

  function modifierNote(tacheId: number, progress_note: string) {
    setModifications((actuelles) => ({
      ...actuelles,
      [tacheId]: { ...actuelles[tacheId], progress_note },
    }));
  }

  async function enregistrerTout() {
    const entrees = Object.entries(modifications);
    if (entrees.length === 0) return;
    setEnregistrement(true);
    setErreur("");
    setErreursParTache({});
    setMessage("");
    try {
      const reponse = await chantiers.enregistrerLot(
        projetId,
        date,
        entrees.map(([tacheId, mod]) => ({
          task_id: Number(tacheId),
          progress: mod.progress,
          status: statutDeProgression(mod.progress),
          comment: mod.comment || undefined,
          progress_note: mod.progress_note || undefined,
        })),
      );
      setMessage(`${reponse.created.length} mise(s) a jour enregistree(s).`);
      charger(date);
    } catch (probleme) {
      // Le lot est tout-ou-rien (transaction atomique cote serveur) : une
      // seule tache sans justification renvoie 400 avec le detail de
      // chacune. `appeler()` leve une exception des qu'un statut n'est pas
      // 2xx — le corps structure {created, errors} arrive donc ici, dans
      // `details`, et non dans une reponse normale.
      const erreurs = (probleme instanceof ErreurChantiers && (probleme.details as { errors?: unknown })?.errors) || [];
      if (Array.isArray(erreurs) && erreurs.length > 0) {
        const parId: Record<number, string> = {};
        for (const e of erreurs as { data?: { task_id?: number }; detail: string }[]) {
          if (e.data?.task_id) parId[e.data.task_id] = e.detail;
        }
        setErreursParTache(parId);
        setErreur(
          `${erreurs.length} tache(s) n'ont pas pu etre enregistrees — voir le detail sous chaque ligne. Aucune modification n'a ete appliquee (le lot est valide en bloc).`,
        );
      } else {
        setErreur("Enregistrement impossible.");
      }
    } finally {
      setEnregistrement(false);
    }
  }

  if (erreur && !lignes) return <Alerte>{erreur}</Alerte>;

  const nombreModifications = Object.keys(modifications).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold uppercase tracking-wide text-foreground sm:text-[36px]">
            Saisie du jour
          </h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            {new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          {FILTRES.map((f) => (
            <button
              key={f.cle}
              type="button"
              onClick={() => setFiltre(f.cle)}
              className={`rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                filtre === f.cle
                  ? "border-primary bg-primary text-white"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              {f.libelle}
            </button>
          ))}
        </div>
      </div>

      {erreur ? <Alerte>{erreur}</Alerte> : null}
      {message ? (
        <div className="mb-4 rounded-lg border border-emerald-600 bg-[#e8f3ec] px-4 py-3 text-sm text-[#1a5c38]">
          {message}
        </div>
      ) : null}

      {!lignes ? (
        <Chargement />
      ) : lignesFiltrees.length === 0 ? (
        <Carte>
          <p className="py-8 text-center text-sm text-muted-foreground">Aucune tache pour ce filtre.</p>
        </Carte>
      ) : (
        <div className="space-y-3">
          {lignesFiltrees.map((ligne) => {
            const modif = modifications[ligne.task.id];
            const progressionActuelle = modif?.progress ?? ligne.effective_progress;
            const avancee = progressionActuelle > ligne.effective_progress;
            const erreurLigne = erreursParTache[ligne.task.id];

            return (
              <Carte key={ligne.task.id}>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{ligne.task.activity}</p>
                    <p className="text-xs text-muted-foreground">
                      {ligne.task.phase} — {ligne.task.subphase}
                    </p>
                  </div>
                  <span className="w-14 shrink-0 text-right text-lg font-bold tabular-nums text-primary">
                    {progressionActuelle}%
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={progressionActuelle}
                    onChange={(e) => modifier(ligne.task.id, Number(e.target.value))}
                    className="w-full accent-[#c8521a]"
                  />
                </div>
                <span className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-border">
                  <span
                    className={`block h-full rounded-full transition-[width] ${couleurBarre(progressionActuelle)}`}
                    style={{ width: `${progressionActuelle}%` }}
                  />
                </span>

                {avancee ? (
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Justification de l&apos;avancee
                    </span>
                    <textarea
                      rows={2}
                      value={modif?.progress_note ?? ""}
                      onChange={(e) => modifierNote(ligne.task.id, e.target.value)}
                      placeholder="Obligatoire des que la progression augmente"
                      className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-primary ${
                        erreurLigne ? "border-destructive" : "border-border"
                      }`}
                    />
                  </label>
                ) : null}
                {erreurLigne ? <p className="mt-1.5 text-xs text-destructive">{erreurLigne}</p> : null}
              </Carte>
            );
          })}
        </div>
      )}

      {nombreModifications > 0 ? (
        <div className="sticky bottom-4 mt-5 flex justify-end">
          <BoutonChantier onClick={enregistrerTout} disabled={enregistrement} className="shadow-lg">
            {enregistrement
              ? "Enregistrement..."
              : `Enregistrer ${nombreModifications} modification${nombreModifications > 1 ? "s" : ""}`}
          </BoutonChantier>
        </div>
      ) : null}
    </div>
  );
}

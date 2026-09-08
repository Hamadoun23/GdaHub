"use client";

/** Tournages : calendrier + CRUD + changement de statut — ShootingController. */

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Alerte, Badge, Bouton, Cellule, CLASSE_ENTREE, Carte, Champ, Chargement, EnTetePagePlanning, EtatVide, LigneTableau, STATUTS_EVENEMENT, STATUTS_NECESSITANT_RAISON, Tableau } from "@/planning/composants/ui";
import { Calendrier } from "@/planning/composants/calendrier";
import { useRolePlanning } from "@/planning/composants/espace-planning";
import { planning, ErreurPlanning } from "@/planning/lib/api";
import type { ClientPlanning, Grille, IdeeContenu, Tournage } from "@/planning/lib/types";

function maintenant() {
  const d = new Date();
  return { mois: d.getMonth() + 1, annee: d.getFullYear() };
}

function versEntreeDateHeure(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PageTournages() {
  const { peutEcrire } = useRolePlanning();
  const parametres = useSearchParams();
  const [{ mois, annee }, setPeriode] = useState(maintenant());
  const [grille, setGrille] = useState<Grille | null>(null);
  const [tournages, setTournages] = useState<Tournage[] | null>(null);
  const [clients, setClients] = useState<ClientPlanning[]>([]);
  const [idees, setIdees] = useState<IdeeContenu[]>([]);
  const [erreur, setErreur] = useState("");

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<Tournage | null>(null);
  const [clientId, setClientId] = useState<number | "">("");
  const [dateHeure, setDateHeure] = useState("");
  const [ideeIds, setIdeeIds] = useState<number[]>([]);
  const [description, setDescription] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  const charger = () => {
    planning.calendrierTournages(mois, annee).then((r) => setGrille(r.calendrier));
    planning
      .tournages()
      .then((page) => setTournages(page.results))
      .catch((probleme) => setErreur(probleme instanceof ErreurPlanning ? probleme.message : "La liste des tournages ne répond pas."));
    planning.clients().then((page) => setClients(page.results));
    planning.idees().then((page) => setIdees(page.results));
  };

  useEffect(charger, [mois, annee]);

  useEffect(() => {
    const idParam = parametres.get("id");
    if (idParam && tournages) {
      const cible = tournages.find((t) => t.id === Number(idParam));
      if (cible) ouvrirEdition(cible);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametres, tournages]);

  const ouvrirCreation = () => {
    setEnEdition(null);
    setClientId("");
    setDateHeure("");
    setIdeeIds([]);
    setDescription("");
    setFormulaireOuvert(true);
  };

  const ouvrirEdition = (t: Tournage) => {
    setEnEdition(t);
    setClientId(t.client);
    setDateHeure(versEntreeDateHeure(t.date));
    setIdeeIds(t.content_ideas_detail.map((i) => i.id));
    setDescription(t.description || "");
    setFormulaireOuvert(true);
  };

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !dateHeure) return;
    setEnregistrement(true);
    try {
      const donnees = {
        client: Number(clientId),
        date: new Date(dateHeure).toISOString(),
        content_idea_ids: ideeIds,
        description: description || undefined,
      };
      if (enEdition) await planning.modifierTournage(enEdition.id, donnees);
      else await planning.creerTournage(donnees);
      setFormulaireOuvert(false);
      charger();
    } catch (probleme) {
      setErreur(probleme instanceof ErreurPlanning ? probleme.message : "L'enregistrement a échoué.");
    } finally {
      setEnregistrement(false);
    }
  };

  const supprimer = async (id: number) => {
    await planning.supprimerTournage(id);
    charger();
  };

  const changerStatut = async (t: Tournage, status: string) => {
    let status_reason: string | undefined;
    let reschedule_date: string | undefined;
    if (STATUTS_NECESSITANT_RAISON.has(status)) {
      status_reason = window.prompt("Motif (obligatoire) :") || "";
      if (!status_reason) return;
    }
    if (status === "rescheduled") {
      reschedule_date = window.prompt("Nouvelle date (AAAA-MM-JJTHH:MM) :") || "";
      if (!reschedule_date) return;
      reschedule_date = new Date(reschedule_date).toISOString();
    }
    try {
      await planning.changerStatutTournage(t.id, { status, status_reason, reschedule_date });
      charger();
    } catch (probleme) {
      setErreur(probleme instanceof ErreurPlanning ? probleme.message : "Le changement de statut a échoué.");
    }
  };

  const idClientVersNom = useMemo(() => new Map(clients.map((c) => [c.id, c.nom_entreprise])), [clients]);

  return (
    <div>
      <EnTetePagePlanning
        titre="Tournages"
        sousTitre="Calendrier et gestion des tournages"
        actions={peutEcrire ? <Bouton onClick={ouvrirCreation}>+ Nouveau tournage</Bouton> : undefined}
      />

      {erreur ? <Alerte>{erreur}</Alerte> : null}

      {formulaireOuvert ? (
        <Carte titre={enEdition ? "Modifier le tournage" : "Nouveau tournage"}>
          <form onSubmit={soumettre} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label="Client">
              <select value={clientId} onChange={(e) => setClientId(Number(e.target.value))} className={CLASSE_ENTREE} required>
                <option value="">— Choisir —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom_entreprise}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ label="Date et heure">
              <input type="datetime-local" value={dateHeure} onChange={(e) => setDateHeure(e.target.value)} className={CLASSE_ENTREE} required />
            </Champ>
            <div className="sm:col-span-2">
              <Champ label="Idées de contenu">
                <div className="flex flex-wrap gap-3">
                  {idees.map((idee) => (
                    <label key={idee.id} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={ideeIds.includes(idee.id)}
                        onChange={(e) =>
                          setIdeeIds((prev) => (e.target.checked ? [...prev, idee.id] : prev.filter((i) => i !== idee.id)))
                        }
                      />
                      {idee.titre}
                    </label>
                  ))}
                </div>
              </Champ>
            </div>
            <div className="sm:col-span-2">
              <Champ label="Description">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={CLASSE_ENTREE} rows={3} />
              </Champ>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Bouton type="submit" disabled={enregistrement}>
                {enregistrement ? "Enregistrement..." : enEdition ? "Modifier" : "Créer"}
              </Bouton>
              <Bouton type="button" variante="secondaire" onClick={() => setFormulaireOuvert(false)}>
                Annuler
              </Bouton>
            </div>
          </form>
        </Carte>
      ) : null}

      <Carte>
        {!grille ? (
          <Chargement />
        ) : (
          <Calendrier
            grille={grille}
            mois={mois}
            annee={annee}
            onMoisChange={(m) => setPeriode({ mois: m, annee })}
            onAnneeChange={(a) => setPeriode({ mois, annee: a })}
            afficherPublications={false}
            lienExport={planning.urlExportTournages(mois, annee)}
            titre="Tournages"
          />
        )}
      </Carte>

      <Carte titre="Tous les tournages" sansPadding>
        {!tournages ? (
          <Chargement />
        ) : tournages.length === 0 ? (
          <EtatVide>Aucun tournage.</EtatVide>
        ) : (
          <Tableau
            entetes={peutEcrire ? ["Date", "Client", "Statut", "Actions"] : ["Date", "Client", "Statut"]}
            sansCadre
          >
            {tournages.map((t) => (
              <LigneTableau key={t.id}>
                <Cellule>{new Date(t.date).toLocaleString("fr-FR")}</Cellule>
                <Cellule className="font-medium">{idClientVersNom.get(t.client) || t.client_nom}</Cellule>
                <Cellule>
                  <Badge status={t.status} isOverdue={t.is_overdue} isUpcoming={t.is_upcoming} />
                </Cellule>
                {peutEcrire ? (
                  <Cellule>
                    <div className="flex flex-wrap gap-3 text-sm font-medium">
                      <button type="button" onClick={() => ouvrirEdition(t)} className="text-primary hover:underline">
                        Modifier
                      </button>
                      <select
                        onChange={(e) => {
                          if (e.target.value) changerStatut(t, e.target.value);
                          e.target.value = "";
                        }}
                        className="rounded-lg border border-border px-2 py-1 text-xs"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Statut...
                        </option>
                        {STATUTS_EVENEMENT.map((s) => (
                          <option key={s.valeur} value={s.valeur}>
                            {s.libelle}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => supprimer(t.id)} className="text-destructive hover:underline">
                        Supprimer
                      </button>
                    </div>
                  </Cellule>
                ) : null}
              </LigneTableau>
            ))}
          </Tableau>
        )}
      </Carte>
    </div>
  );
}

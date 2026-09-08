"use client";

/** Publications : calendrier + CRUD + changement de statut — PublicationController. */

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Alerte, Badge, Bouton, Cellule, CLASSE_ENTREE, Carte, Champ, Chargement, EnTetePagePlanning, EtatVide, LigneTableau, STATUTS_EVENEMENT, STATUTS_NECESSITANT_RAISON, Tableau } from "@/planning/composants/ui";
import { Calendrier } from "@/planning/composants/calendrier";
import { useRolePlanning } from "@/planning/composants/espace-planning";
import { planning, ErreurPlanning } from "@/planning/lib/api";
import type { ClientPlanning, Grille, IdeeContenu, Publication, Tournage } from "@/planning/lib/types";

function maintenant() {
  const d = new Date();
  return { mois: d.getMonth() + 1, annee: d.getFullYear() };
}

function versEntreeDateHeure(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PagePublications() {
  const { peutEcrire } = useRolePlanning();
  const parametres = useSearchParams();
  const [{ mois, annee }, setPeriode] = useState(maintenant());
  const [grille, setGrille] = useState<Grille | null>(null);
  const [publications, setPublications] = useState<Publication[] | null>(null);
  const [clients, setClients] = useState<ClientPlanning[]>([]);
  const [idees, setIdees] = useState<IdeeContenu[]>([]);
  const [tournagesDisponibles, setTournagesDisponibles] = useState<Tournage[]>([]);
  const [erreur, setErreur] = useState("");
  const [avertissements, setAvertissements] = useState<string[]>([]);

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<Publication | null>(null);
  const [clientId, setClientId] = useState<number | "">("");
  const [dateHeure, setDateHeure] = useState("");
  const [ideeId, setIdeeId] = useState<number | "">("");
  const [tournageId, setTournageId] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  const charger = () => {
    planning.calendrierPublications(mois, annee).then((r) => setGrille(r.calendrier));
    planning
      .publications()
      .then((page) => setPublications(page.results))
      .catch((probleme) => setErreur(probleme instanceof ErreurPlanning ? probleme.message : "La liste des publications ne répond pas."));
    planning.clients().then((page) => setClients(page.results));
    planning.idees().then((page) => setIdees(page.results));
    planning.tournages().then((page) => setTournagesDisponibles(page.results));
  };

  useEffect(charger, [mois, annee]);

  useEffect(() => {
    const idParam = parametres.get("id");
    if (idParam && publications) {
      const cible = publications.find((p) => p.id === Number(idParam));
      if (cible) ouvrirEdition(cible);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametres, publications]);

  const ouvrirCreation = () => {
    setEnEdition(null);
    setClientId("");
    setDateHeure("");
    setIdeeId("");
    setTournageId("");
    setDescription("");
    setAvertissements([]);
    setFormulaireOuvert(true);
  };

  const ouvrirEdition = (p: Publication) => {
    setEnEdition(p);
    setClientId(p.client);
    setDateHeure(versEntreeDateHeure(p.date));
    setIdeeId(p.content_idea || "");
    setTournageId(p.shooting || "");
    setDescription(p.description || "");
    setAvertissements([]);
    setFormulaireOuvert(true);
  };

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !dateHeure || !ideeId) return;
    setEnregistrement(true);
    try {
      const donnees = {
        client: Number(clientId),
        date: new Date(dateHeure).toISOString(),
        content_idea: Number(ideeId),
        shooting: tournageId ? Number(tournageId) : null,
        description: description || undefined,
      };
      const resultat = enEdition
        ? await planning.modifierPublication(enEdition.id, donnees)
        : await planning.creerPublication(donnees);
      setAvertissements(resultat.avertissements || []);
      if (!resultat.avertissements || resultat.avertissements.length === 0) setFormulaireOuvert(false);
      charger();
    } catch (probleme) {
      setErreur(probleme instanceof ErreurPlanning ? probleme.message : "L'enregistrement a échoué.");
    } finally {
      setEnregistrement(false);
    }
  };

  const supprimer = async (id: number) => {
    await planning.supprimerPublication(id);
    charger();
  };

  const changerStatut = async (p: Publication, status: string) => {
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
      await planning.changerStatutPublication(p.id, { status, status_reason, reschedule_date });
      charger();
    } catch (probleme) {
      setErreur(probleme instanceof ErreurPlanning ? probleme.message : "Le changement de statut a échoué.");
    }
  };

  const idClientVersNom = useMemo(() => new Map(clients.map((c) => [c.id, c.nom_entreprise])), [clients]);

  return (
    <div>
      <EnTetePagePlanning
        titre="Publications"
        sousTitre="Calendrier et gestion des publications"
        actions={peutEcrire ? <Bouton onClick={ouvrirCreation}>+ Nouvelle publication</Bouton> : undefined}
      />

      {erreur ? <Alerte>{erreur}</Alerte> : null}

      {formulaireOuvert ? (
        <Carte titre={enEdition ? "Modifier la publication" : "Nouvelle publication"}>
          {avertissements.length > 0 ? (
            <Alerte variante="warning">
              <strong className="mb-1 block">Avertissements :</strong>
              <ul className="list-inside list-disc">
                {avertissements.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </Alerte>
          ) : null}
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
            <Champ label="Idée de contenu">
              <select value={ideeId} onChange={(e) => setIdeeId(Number(e.target.value))} className={CLASSE_ENTREE} required>
                <option value="">— Choisir —</option>
                {idees.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.titre}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ label="Tournage lié (optionnel)">
              <select value={tournageId} onChange={(e) => setTournageId(e.target.value ? Number(e.target.value) : "")} className={CLASSE_ENTREE}>
                <option value="">Aucun</option>
                {tournagesDisponibles
                  .filter((t) => t.client === clientId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {new Date(t.date).toLocaleDateString("fr-FR")}
                    </option>
                  ))}
              </select>
            </Champ>
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
            afficherTournages={false}
            lienExport={planning.urlExportPublications(mois, annee)}
            titre="Publications"
          />
        )}
      </Carte>

      <Carte titre="Toutes les publications" sansPadding>
        {!publications ? (
          <Chargement />
        ) : publications.length === 0 ? (
          <EtatVide>Aucune publication.</EtatVide>
        ) : (
          <Tableau
            entetes={peutEcrire ? ["Date", "Client", "Idée", "Statut", "Actions"] : ["Date", "Client", "Idée", "Statut"]}
            sansCadre
          >
            {publications.map((p) => (
              <LigneTableau key={p.id}>
                <Cellule>
                  {new Date(p.date).toLocaleString("fr-FR")}
                  {p.day_not_recommended_warning ? <span className="ml-1" title={p.day_not_recommended_warning}>⚠️</span> : null}
                </Cellule>
                <Cellule className="font-medium">{idClientVersNom.get(p.client) || p.client_nom}</Cellule>
                <Cellule>{p.content_idea_detail?.titre || "—"}</Cellule>
                <Cellule>
                  <Badge status={p.status} isOverdue={p.is_overdue} isUpcoming={p.is_upcoming} />
                </Cellule>
                {peutEcrire ? (
                  <Cellule>
                    <div className="flex flex-wrap gap-3 text-sm font-medium">
                      <button type="button" onClick={() => ouvrirEdition(p)} className="text-primary hover:underline">
                        Modifier
                      </button>
                      <select
                        onChange={(e) => {
                          if (e.target.value) changerStatut(p, e.target.value);
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
                      <button type="button" onClick={() => supprimer(p.id)} className="text-destructive hover:underline">
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

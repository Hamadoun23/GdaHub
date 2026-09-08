"use client";

/** Planning d'un client : calendrier, stats, evenements, rapports, regles — ClientController::show/dashboard. */

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  Alerte,
  Bouton,
  CLASSE_ENTREE,
  Carte,
  Champ,
  Chargement,
  EnTetePagePlanning,
  EtatVide,
  StatCard,
} from "@/planning/composants/ui";
import { Calendrier } from "@/planning/composants/calendrier";
import { planning, ErreurPlanning } from "@/planning/lib/api";
import { JOURS_SEMAINE, type CalendrierClient, type RegleePublication } from "@/planning/lib/types";

function maintenant() {
  const d = new Date();
  return { mois: d.getMonth() + 1, annee: d.getFullYear() };
}

export default function PageClientDetailPlanning() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);

  const [{ mois, annee }, setPeriode] = useState(maintenant());
  const [donnees, setDonnees] = useState<CalendrierClient | null>(null);
  const [regles, setRegles] = useState<RegleePublication[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [nouvelleRegle, setNouvelleRegle] = useState("lundi");
  const fichierRapport = useRef<HTMLInputElement>(null);
  const [typeRapport, setTypeRapport] = useState<"monthly" | "annual">("monthly");
  const [dateRapport, setDateRapport] = useState("");
  const [televersement, setTeleversement] = useState(false);

  const charger = () => {
    planning
      .calendrierClient(clientId, mois, annee)
      .then(setDonnees)
      .catch((probleme) =>
        setErreur(probleme instanceof ErreurPlanning ? probleme.message : "Le planning de ce client ne répond pas."),
      );
    planning.reglesClient(clientId).then((page) => setRegles(page.results));
  };

  useEffect(charger, [clientId, mois, annee]);

  const ajouterRegle = async () => {
    try {
      await planning.creerRegle(clientId, nouvelleRegle);
      charger();
    } catch (probleme) {
      setErreur(probleme instanceof ErreurPlanning ? probleme.message : "L'ajout de la règle a échoué.");
    }
  };

  const supprimerRegle = async (regleId: number) => {
    await planning.supprimerRegle(regleId);
    charger();
  };

  const televerserRapport = async (e: React.FormEvent) => {
    e.preventDefault();
    const fichier = fichierRapport.current?.files?.[0];
    if (!fichier || !dateRapport) return;
    setTeleversement(true);
    try {
      await planning.televerserRapport(clientId, { report_type: typeRapport, report_date: dateRapport, file: fichier });
      setDateRapport("");
      if (fichierRapport.current) fichierRapport.current.value = "";
      charger();
    } catch (probleme) {
      setErreur(probleme instanceof ErreurPlanning ? probleme.message : "Le téléversement a échoué.");
    } finally {
      setTeleversement(false);
    }
  };

  if (erreur) return <Alerte>{erreur}</Alerte>;
  if (!donnees) return <Chargement />;

  return (
    <div>
      <EnTetePagePlanning
        titre={donnees.client.nom_entreprise}
        sousTitre="Planning, statistiques et rapports"
        actions={
          !donnees.lecture_seule ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={planning.urlRapportClientGenere(clientId, "monthly", mois, annee)}
                className="rounded bg-foreground px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1a1a]"
              >
                📄 Rapport mensuel
              </a>
              <a
                href={planning.urlRapportClientGenere(clientId, "annual", mois, annee)}
                className="rounded bg-foreground px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1a1a]"
              >
                📄 Rapport annuel
              </a>
            </div>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard libelle="Tournages" valeur={donnees.stats.total_shootings} />
        <StatCard libelle="Publications" valeur={donnees.stats.total_publications} />
        <StatCard libelle="Complétés" valeur={donnees.stats.completed_shootings + donnees.stats.completed_publications} />
        <StatCard libelle="Non réalisés" valeur={donnees.stats.non_realises_shootings + donnees.stats.non_realises_publications} />
        <StatCard libelle="Règles actives" valeur={donnees.stats.publication_rules} />
      </div>

      <Carte>
        <Calendrier
          grille={donnees.calendrier}
          mois={mois}
          annee={annee}
          onMoisChange={(m) => setPeriode({ mois: m, annee })}
          onAnneeChange={(a) => setPeriode({ mois, annee: a })}
          titre={donnees.client.nom_entreprise}
        />
      </Carte>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Carte titre="Tournages à venir (30 jours)">
          {donnees.tournages_a_venir.length === 0 ? (
            <EtatVide>Aucun tournage à venir</EtatVide>
          ) : (
            <ul className="space-y-2">
              {donnees.tournages_a_venir.map((t) => (
                <li key={t.id} className="rounded bg-muted px-3 py-2 text-sm">
                  {new Date(t.date).toLocaleDateString("fr-FR")} — {t.description || "Tournage"}
                </li>
              ))}
            </ul>
          )}
        </Carte>
        <Carte titre="Publications à venir (30 jours)">
          {donnees.publications_a_venir.length === 0 ? (
            <EtatVide>Aucune publication à venir</EtatVide>
          ) : (
            <ul className="space-y-2">
              {donnees.publications_a_venir.map((p) => (
                <li key={p.id} className="rounded bg-muted px-3 py-2 text-sm">
                  {new Date(p.date).toLocaleDateString("fr-FR")} — {p.content_idea_detail?.titre || "—"}
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      {!donnees.lecture_seule ? (
        <Carte titre="Règles de publication (jours non recommandés)">
          <div className="mb-4 flex flex-wrap gap-2">
            {regles?.map((r) => (
              <span key={r.id} className="flex items-center gap-2 rounded-full bg-[#fff3cd] px-3 py-1 text-sm text-[#856404]">
                {r.day_of_week_libelle}
                <button type="button" onClick={() => supprimerRegle(r.id)} className="font-bold hover:text-[#dc3545]">
                  ×
                </button>
              </span>
            ))}
            {regles?.length === 0 ? <span className="text-sm text-muted-foreground">Aucune règle définie.</span> : null}
          </div>
          <div className="flex items-end gap-3">
            <select value={nouvelleRegle} onChange={(e) => setNouvelleRegle(e.target.value)} className={CLASSE_ENTREE + " max-w-[200px]"}>
              {JOURS_SEMAINE.map((j) => (
                <option key={j} value={j}>
                  {j.charAt(0).toUpperCase() + j.slice(1)}
                </option>
              ))}
            </select>
            <Bouton onClick={ajouterRegle}>Ajouter</Bouton>
          </div>
        </Carte>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Carte titre="Rapports mensuels">
          <ListeRapports rapports={donnees.rapports_mensuels} clientId={clientId} lectureSeule={donnees.lecture_seule} onSupprimer={charger} />
        </Carte>
        <Carte titre="Rapports annuels">
          <ListeRapports rapports={donnees.rapports_annuels} clientId={clientId} lectureSeule={donnees.lecture_seule} onSupprimer={charger} />
        </Carte>
      </div>

      {!donnees.lecture_seule ? (
        <Carte titre="Téléverser un rapport PDF">
          <form onSubmit={televerserRapport} className="flex flex-wrap items-end gap-3">
            <Champ label="Type">
              <select value={typeRapport} onChange={(e) => setTypeRapport(e.target.value as "monthly" | "annual")} className={CLASSE_ENTREE}>
                <option value="monthly">Mensuel</option>
                <option value="annual">Annuel</option>
              </select>
            </Champ>
            <Champ label="Date du rapport">
              <input type="date" value={dateRapport} onChange={(e) => setDateRapport(e.target.value)} className={CLASSE_ENTREE} required />
            </Champ>
            <Champ label="Fichier PDF">
              <input ref={fichierRapport} type="file" accept="application/pdf" className={CLASSE_ENTREE} required />
            </Champ>
            <Bouton type="submit" disabled={televersement}>
              {televersement ? "Envoi..." : "Téléverser"}
            </Bouton>
          </form>
        </Carte>
      ) : null}
    </div>
  );
}

function ListeRapports({
  rapports,
  clientId,
  lectureSeule,
  onSupprimer,
}: {
  rapports: CalendrierClient["rapports_mensuels"];
  clientId: number;
  lectureSeule: boolean;
  onSupprimer: () => void;
}) {
  if (rapports.length === 0) return <EtatVide>Aucun rapport.</EtatVide>;
  return (
    <ul className="space-y-2">
      {rapports.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 rounded bg-muted px-3 py-2 text-sm">
          <span className="truncate">
            {new Date(r.report_date).toLocaleDateString("fr-FR", { year: "numeric", month: "long" })} — {r.original_filename}
          </span>
          <span className="flex shrink-0 gap-3">
            <a href={planning.urlTelechargerRapport(clientId, r.id)} className="font-medium text-primary hover:underline">
              Télécharger
            </a>
            {!lectureSeule ? (
              <button
                type="button"
                onClick={() => planning.supprimerRapport(clientId, r.id).then(onSupprimer)}
                className="font-medium text-[#dc3545] hover:underline"
              >
                Supprimer
              </button>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

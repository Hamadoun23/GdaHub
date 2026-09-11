"use client";

/** Tableau de bord global : calendrier combine, alertes, stats — DashboardController::index. */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alerte, Carte, Chargement, StatCard } from "@/planning/composants/ui";
import { Calendrier } from "@/planning/composants/calendrier";
import { useRolePlanning } from "@/planning/composants/espace-planning";
import { planning, ErreurPlanning } from "@/planning/lib/api";
import type { Publication, TableauDeBord, Tournage } from "@/planning/lib/types";

import { AFaire } from "@/composants/dashboard-hub/a-faire";
import { Total } from "@/composants/dashboard-hub/total";
import { Urgent } from "@/composants/dashboard-hub/urgent";
import type { ElementAFaire } from "@/composants/dashboard-hub/utiliser-a-faire";

const COULEUR_PAR_CODE = { tournage: "#eb6834", publication: "#2a78d6" };

function versElementAFaire(evenement: Tournage | Publication, urgent: boolean): ElementAFaire {
  const estPublication = "content_idea" in evenement;
  const date = new Date(evenement.date);
  return {
    cle: `${estPublication ? "p" : "t"}-${evenement.id}`,
    code: estPublication ? "publication" : "tournage",
    app: estPublication ? "Publication" : "Tournage",
    href: estPublication ? "/planning/publications" : "/planning/tournages",
    titre: `${estPublication ? "Publication" : "Tournage"} — ${evenement.client_nom}`,
    sousTitre: `${date.toLocaleDateString("fr-FR")} ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
    personne: evenement.client_nom,
    etat: urgent ? "retard" : "a_venir",
    urgent,
  };
}

function maintenant() {
  const d = new Date();
  return { mois: d.getMonth() + 1, annee: d.getFullYear() };
}

export default function PagePlanningAccueil() {
  const routeur = useRouter();
  const { estClient } = useRolePlanning();
  const [{ mois, annee }, setPeriode] = useState(maintenant());
  const [donnees, setDonnees] = useState<TableauDeBord | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (estClient) {
      planning
        .clients()
        .then((page) => {
          if (page.results[0]) routeur.replace(`/planning/clients/${page.results[0].id}`);
        })
        .catch(() => setErreur("Votre espace client n'a pas pu être chargé."));
      return;
    }
    planning
      .tableauDeBord(mois, annee)
      .then(setDonnees)
      .catch((probleme) => setErreur(probleme instanceof ErreurPlanning ? probleme.message : "Le tableau de bord ne répond pas."));
  }, [mois, annee, estClient, routeur]);

  if (estClient) return <Chargement />;
  if (erreur) return <Alerte>{erreur}</Alerte>;
  if (!donnees) return <Chargement />;

  const evenementsRetard = [...donnees.tournages_en_retard, ...donnees.publications_en_retard];
  const evenementsAVenir = [...donnees.tournages_a_venir, ...donnees.publications_a_venir];

  // Evenements en retard/a venir -> ElementAFaire, pour reutiliser
  // Total/Urgent/AFaire (deja alignes sur la reference "Virtus") plutot
  // qu'une paire d'alertes bespoke.
  const elements: ElementAFaire[] = [
    ...evenementsRetard.map((e) => versElementAFaire(e, true)),
    ...evenementsAVenir.map((e) => versElementAFaire(e, false)),
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-foreground">Tableau de bord</h1>
      <p className="mb-6 text-sm text-muted-foreground">Gérez vos plannings et générez des rapports en un clic.</p>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5 lg:items-stretch">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Total elements={elements} />
          <Urgent elements={elements} />
        </div>
        <div className="lg:col-span-3">
          <AFaire elements={elements} couleurParCode={COULEUR_PAR_CODE} />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard libelle="Total clients" valeur={donnees.stats.clients_count} />
        <StatCard libelle="Tournages ce mois" valeur={donnees.stats.shootings_this_month} />
        <StatCard libelle="Publications ce mois" valeur={donnees.stats.publications_this_month} />
      </div>

      <Carte sansPadding>
        <div className="p-4 sm:p-6">
          <Calendrier
            grille={donnees.calendrier}
            mois={mois}
            annee={annee}
            onMoisChange={(m) => setPeriode({ mois: m, annee })}
            onAnneeChange={(a) => setPeriode({ mois, annee: a })}
            lienExport={planning.urlExportGlobal(mois, annee)}
            titre="Planning global"
          />
        </div>
      </Carte>
    </div>
  );
}

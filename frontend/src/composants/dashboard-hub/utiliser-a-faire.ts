"use client";

/**
 * Le chargement des elements « a faire » (RH/Finance/Planning), extrait de
 * `a-faire.tsx` pour etre partage avec `resume.tsx` : les deux widgets
 * affichent la meme liste sous deux formes (le detail, puis le compte par
 * application), un seul appel reseau doit suffire pour les nourrir tous les
 * deux.
 */

import { useEffect, useState } from "react";

import type { Application } from "@/lib/api";
import { useSession } from "@/lib/session";

const RESSOURCES_FINANCE = [
  { chemin: "requisitions", libelle: "Requisition" },
  { chemin: "bons-commande", libelle: "Bon de commande" },
  { chemin: "sorties-caisse", libelle: "Sortie de caisse" },
  { chemin: "depenses", libelle: "Depense" },
  { chemin: "missions", libelle: "Mission" },
  { chemin: "prestations", libelle: "Prestation" },
] as const;

type PageDrf<T> = { count: number; results: T[] };

type DocumentAValider = {
  id: number;
  numero: string;
  demandeur_nom: string;
  objet?: string;
  motif?: string;
  libelle?: string;
  type_absence_libelle?: string;
};

type EvenementPlanning = {
  id: number;
  client_nom: string;
  date: string;
  description: string;
};

type TableauDeBordPlanning = {
  tournages_en_retard: EvenementPlanning[];
  publications_en_retard: EvenementPlanning[];
  tournages_a_venir: EvenementPlanning[];
  publications_a_venir: EvenementPlanning[];
};

export type ElementAFaire = {
  cle: string;
  /** Identifiant libre (application ou sous-categorie metier) — sert de cle
   * pour `couleurParCode`/l'icone ; pas limite au hub, reutilise par les
   * dashboards RH et Jus d'orange avec leurs propres codes. */
  code: string;
  app: string;
  href: string;
  titre: string;
  sousTitre: string;
  /** Le nom de la personne ou du client concerne — sert d'avatar (initiales). */
  personne: string;
  etat: "retard" | "a_venir" | "a_valider";
  urgent?: boolean;
};

function libelleDocument(document: DocumentAValider): string {
  return document.objet || document.motif || document.libelle || "Document";
}

function dateCourte(dateIso: string): string {
  return new Date(dateIso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function useElementsAFaire(applications: Application[]): ElementAFaire[] | null {
  const { requete } = useSession();
  const [elements, setElements] = useState<ElementAFaire[] | null>(null);

  const aRh = applications.some((application) => application.code === "rh");
  const aFinance = applications.some((application) => application.code === "finance");
  const aPlanning = applications.some((application) => application.code === "planning");

  useEffect(() => {
    if (!aRh && !aFinance && !aPlanning) {
      setElements([]);
      return;
    }

    let annule = false;

    async function charger() {
      const trouves: ElementAFaire[] = [];

      if (aRh) {
        try {
          const page = await requete<PageDrf<DocumentAValider>>("/rh/demandes-absence/a-valider/");
          for (const document of page.results) {
            trouves.push({
              cle: `rh-${document.id}`,
              code: "rh",
              app: "RH",
              href: "/rh/validations",
              titre: `${document.type_absence_libelle || "Absence"} — ${document.demandeur_nom}`,
              sousTitre: `${document.numero} a valider`,
              personne: document.demandeur_nom,
              etat: "a_valider",
            });
          }
        } catch {
          // Pas approbateur sur aucune demande en cours : rien a montrer.
        }
      }

      if (aFinance) {
        for (const ressource of RESSOURCES_FINANCE) {
          try {
            const page = await requete<PageDrf<DocumentAValider>>(`/finance/${ressource.chemin}/a-valider/`);
            for (const document of page.results) {
              trouves.push({
                cle: `finance-${ressource.chemin}-${document.id}`,
                code: "finance",
                app: "Finance",
                href: "/rh/validations",
                titre: `${ressource.libelle} — ${libelleDocument(document)}`,
                sousTitre: `${document.numero} · ${document.demandeur_nom}`,
                personne: document.demandeur_nom,
                etat: "a_valider",
              });
            }
          } catch {
            // Idem, par type de document.
          }
        }
      }

      if (aPlanning) {
        try {
          const tableau = await requete<TableauDeBordPlanning>("/planning/tableau-de-bord/");
          for (const t of tableau.tournages_en_retard) {
            trouves.push({
              cle: `planning-tr-${t.id}`,
              code: "planning",
              app: "Planning",
              href: "/planning",
              titre: `Tournage en retard — ${t.client_nom}`,
              sousTitre: t.description || "A reprogrammer",
              personne: t.client_nom,
              etat: "retard",
              urgent: true,
            });
          }
          for (const p of tableau.publications_en_retard) {
            trouves.push({
              cle: `planning-pr-${p.id}`,
              code: "planning",
              app: "Planning",
              href: "/planning",
              titre: `Publication en retard — ${p.client_nom}`,
              sousTitre: p.description || "A reprogrammer",
              personne: p.client_nom,
              etat: "retard",
              urgent: true,
            });
          }
          for (const t of tableau.tournages_a_venir) {
            trouves.push({
              cle: `planning-ta-${t.id}`,
              code: "planning",
              app: "Planning",
              href: "/planning",
              titre: `Tournage a venir — ${t.client_nom}`,
              sousTitre: dateCourte(t.date),
              personne: t.client_nom,
              etat: "a_venir",
            });
          }
          for (const p of tableau.publications_a_venir) {
            trouves.push({
              cle: `planning-pa-${p.id}`,
              code: "planning",
              app: "Planning",
              href: "/planning",
              titre: `Publication a venir — ${p.client_nom}`,
              sousTitre: dateCourte(p.date),
              personne: p.client_nom,
              etat: "a_venir",
            });
          }
        } catch {
          // Pas dans l'equipe Planning : rien a montrer.
        }
      }

      if (!annule) setElements(trouves);
    }

    charger();
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aRh, aFinance, aPlanning]);

  return elements;
}

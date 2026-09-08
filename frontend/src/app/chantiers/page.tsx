"use client";

/**
 * Liste des chantiers.
 *
 * L'ecran d'accueil du module : choisir un chantier avant de travailler
 * dessus. Un compte qui n'en pilote aucun encore voit un etat vide plutot
 * qu'une liste qui semble juste ne pas avoir charge.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { EspaceChantiers } from "@/chantiers/composants/espace-chantiers";
import { Alerte, BoutonChantier, Carte, Chargement, EnTetePageChantier } from "@/chantiers/composants/ui";
import { AnneauProgression } from "@/composants/dashboard-hub/anneau-progression";
import { chantiers, ErreurChantiers } from "@/chantiers/lib/api";
import type { Projet } from "@/chantiers/lib/types";

export default function PageChantiers() {
  const [projets, setProjets] = useState<Projet[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);

  const charger = () => {
    setErreur("");
    chantiers
      .projets()
      .then((page) => setProjets(page.results))
      .catch((probleme) =>
        setErreur(probleme instanceof ErreurChantiers ? probleme.message : "Le service ne repond pas."),
      );
  };

  useEffect(charger, []);

  return (
    <EspaceChantiers>
      <div className="dark relative -m-4 min-h-[calc(100svh-4rem)] bg-background p-4 text-foreground md:-m-6 md:p-8">
      <div className="mx-auto max-w-5xl">
      <EnTetePageChantier
        titre="Chantiers"
        sousTitre="Suivi d'avancement, photos et rapports"
        actions={<BoutonChantier onClick={() => setFormulaireOuvert(true)}>Nouveau chantier</BoutonChantier>}
      />

      {erreur ? <Alerte>{erreur}</Alerte> : null}

      {projets === null ? (
        <Chargement />
      ) : projets.length === 0 ? (
        <Carte>
          <div className="py-8 text-center">
            <p className="font-semibold text-foreground">Aucun chantier</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Creez le premier chantier a suivre.</p>
            <div className="mt-4">
              <BoutonChantier onClick={() => setFormulaireOuvert(true)}>Nouveau chantier</BoutonChantier>
            </div>
          </div>
        </Carte>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projets.map((projet) => (
            <Link key={projet.id} href={`/chantiers/${projet.id}`} className="block">
              <Carte>
                <p className="font-semibold text-foreground">{projet.name}</p>
                {projet.client ? <p className="text-xs text-muted-foreground">{projet.client}</p> : null}
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <AnneauProgression
                      valeur={projet.overall_progress}
                      taille={60}
                      epaisseur={6}
                      degrade={["#ffb673", "#e8481b"]}
                      pisteCouleur="color-mix(in oklch, var(--foreground) 10%, transparent)"
                    >
                      <span className="text-xs font-bold text-foreground">{projet.overall_progress}%</span>
                    </AnneauProgression>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Avancement</p>
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-sky-600">{projet.tasks_count}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Taches</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{projet.status_display}</p>
              </Carte>
            </Link>
          ))}
        </div>
      )}

      {formulaireOuvert ? (
        <FormulaireNouveauChantier
          onAnnuler={() => setFormulaireOuvert(false)}
          onCree={() => {
            setFormulaireOuvert(false);
            charger();
          }}
        />
      ) : null}
      </div>
      </div>
    </EspaceChantiers>
  );
}

function FormulaireNouveauChantier({
  onAnnuler,
  onCree,
}: {
  onAnnuler: () => void;
  onCree: () => void;
}) {
  const [nom, setNom] = useState("");
  const [client, setClient] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    if (!nom.trim()) return;
    setEnvoi(true);
    setErreur("");
    try {
      await chantiers.creerProjet({ name: nom.trim(), client: client.trim() });
      onCree();
    } catch (probleme) {
      setErreur(probleme instanceof ErreurChantiers ? probleme.message : "Creation impossible.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-24"
      role="dialog"
      aria-modal="true"
      onClick={onAnnuler}
    >
      <form
        onSubmit={soumettre}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl"
      >
        <h2 className="font-bold uppercase tracking-wide text-foreground">Nouveau chantier</h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nom du chantier
            </span>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              autoFocus
              required
              className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</span>
            <input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
        {erreur ? <p className="mt-3 text-sm text-destructive">{erreur}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onAnnuler}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Annuler
          </button>
          <BoutonChantier type="submit" disabled={envoi}>
            {envoi ? "Creation..." : "Creer"}
          </BoutonChantier>
        </div>
      </form>
    </div>
  );
}

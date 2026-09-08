"use client";

/**
 * Structure du chantier : phases, sous-phases, taches.
 *
 * L'ecran qui manquait pour que quelqu'un puisse monter un chantier sans
 * passer par l'API a la main. Le reordonnancement (glisser-deposer) n'est
 * pas encore ici — l'ordre de creation fait l'ordre d'affichage pour
 * l'instant.
 */

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Alerte, BoutonChantier, Carte, Chargement } from "@/chantiers/composants/ui";
import { chantiers, ErreurChantiers } from "@/chantiers/lib/api";

type Structure = Awaited<ReturnType<typeof chantiers.structureProjet>>;

export default function PageStructure() {
  const { id } = useParams<{ id: string }>();
  const projetId = Number(id);

  const [structure, setStructure] = useState<Structure | null>(null);
  const [erreur, setErreur] = useState("");

  const charger = () => {
    chantiers
      .structureProjet(projetId)
      .then(setStructure)
      .catch((probleme) =>
        setErreur(probleme instanceof ErreurChantiers ? probleme.message : "La structure ne repond pas."),
      );
  };

  useEffect(charger, [projetId]);

  if (erreur) return <Alerte>{erreur}</Alerte>;
  if (!structure) return <Chargement />;

  return (
    <div>
      <h1 className="mb-6 text-[28px] font-bold uppercase tracking-wide text-foreground sm:text-[36px]">Structure</h1>

      <div className="space-y-4">
        {structure.phases.map((phase) => (
          <Carte key={phase.id} titre={phase.name}>
            <div className="space-y-3">
              {phase.sub_phases.map((sousPhase) => (
                <div key={sousPhase.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">{sousPhase.name}</p>
                  <ul className="mt-2 space-y-1">
                    {sousPhase.tasks.map((tache) => (
                      <li key={tache.id} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{tache.activity}</span>
                        <span className="text-xs text-muted-foreground">{tache.progress}%</span>
                      </li>
                    ))}
                    {sousPhase.tasks.length === 0 ? (
                      <li className="text-xs text-muted-foreground">Aucune tache.</li>
                    ) : null}
                  </ul>
                  <FormulaireTache sousPhaseId={sousPhase.id} onCree={charger} />
                </div>
              ))}
              <FormulaireSousPhase phaseId={phase.id} onCree={charger} />
            </div>
          </Carte>
        ))}

        <FormulairePhase projetId={projetId} onCree={charger} />
      </div>
    </div>
  );
}

function LigneAjout({
  placeholder,
  onValider,
}: {
  placeholder: string;
  onValider: (valeur: string) => Promise<void>;
}) {
  const [valeur, setValeur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    if (!valeur.trim()) return;
    setEnvoi(true);
    try {
      await onValider(valeur.trim());
      setValeur("");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre} className="mt-2 flex gap-2">
      <input
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
      />
      <BoutonChantier type="submit" variante="discret" disabled={envoi}>
        Ajouter
      </BoutonChantier>
    </form>
  );
}

function FormulairePhase({ projetId, onCree }: { projetId: number; onCree: () => void }) {
  return (
    <Carte>
      <p className="text-sm font-semibold text-foreground">Nouvelle phase</p>
      <LigneAjout
        placeholder="Nom de la phase"
        onValider={async (nom) => {
          await chantiers.creerPhase({ projet: projetId, name: nom });
          onCree();
        }}
      />
    </Carte>
  );
}

function FormulaireSousPhase({ phaseId, onCree }: { phaseId: number; onCree: () => void }) {
  return (
    <LigneAjout
      placeholder="Nouvelle sous-phase"
      onValider={async (nom) => {
        await chantiers.creerSousPhase({ phase: phaseId, name: nom });
        onCree();
      }}
    />
  );
}

function FormulaireTache({ sousPhaseId, onCree }: { sousPhaseId: number; onCree: () => void }) {
  return (
    <LigneAjout
      placeholder="Nouvelle tache"
      onValider={async (nom) => {
        await chantiers.creerTache({ sous_phase: sousPhaseId, activity: nom });
        onCree();
      }}
    />
  );
}

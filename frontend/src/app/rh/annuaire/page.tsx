"use client";

import { useState } from "react";

import {
  Alerte,
  Carte,
  Cellule,
  Champ,
  Chargement,
  EnTetePage,
  Selection,
  Tableau,
  TuileStat,
} from "@/rh/composants/ui";
import { versParametres } from "@/rh/lib/api";
import { useAuth } from "@/rh/lib/auth";
import { date, initiales } from "@/rh/lib/format";
import { useListe } from "@/rh/lib/hooks";
import type { Departement, Utilisateur } from "@/rh/lib/types";

export default function PageAnnuaire() {
  const { estRH } = useAuth();
  const [recherche, setRecherche] = useState("");
  const [departement, setDepartement] = useState("");

  const departements = useListe<Departement>("/departements/");
  const agents = useListe<Utilisateur>(
    `/utilisateurs/${versParametres({
      search: recherche,
      departement,
      is_active: "true",
      ordering: "last_name",
    })}`,
  );

  return (
    <>
      <EnTetePage
        titre="Annuaire interne"
        description="Coordonnees professionnelles des agents. Aucune donnee personnelle sensible n'est exposee dans cet annuaire."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 max-sm:[&>*:last-child]:col-span-2">
        <TuileStat
          libelle="Agents actifs"
          valeur={agents.donnees?.length ?? 0}
          detail="Sur le perimetre filtre"
          ton="marque"
        />
        <TuileStat
          libelle="Departements"
          valeur={departements.donnees?.length ?? 0}
        />
        <TuileStat
          libelle="Back-office"
          valeur={
            (agents.donnees ?? []).filter((agent) => agent.role !== "SALARIE").length
          }
          detail="RH, Finance et Direction"
          ton="info"
        />
      </div>

      <Carte sansPadding>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2">
          <Champ
            libelle="Recherche"
            value={recherche}
            onChange={(evenement) => setRecherche(evenement.target.value)}
            placeholder="Nom, poste, courriel"
          />
          <Selection
            libelle="Departement"
            value={departement}
            onChange={(evenement) => setDepartement(evenement.target.value)}
            placeholder="Tous les departements"
            options={(departements.donnees ?? []).map((element) => ({
              valeur: element.id,
              libelle: `${element.nom} (${element.effectif})`,
            }))}
          />
        </div>

        {agents.chargement ? (
          <Chargement />
        ) : agents.erreur ? (
          <div className="p-4 sm:p-5">
            <Alerte>{agents.erreur}</Alerte>
          </div>
        ) : (
          <Tableau
            entetes={[
              "Agent",
              "Poste",
              "Departement",
              "Responsable",
              "Contact",
              ...(estRH ? ["Anciennete"] : []),
            ]}
            vide={!agents.donnees?.length}
          >
            {agents.donnees?.map((agent) => (
              <tr key={agent.id} className="hover:bg-slate-50/60">
                <Cellule>
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-marque-100 text-xs font-semibold text-marque-700">
                      {initiales(agent.nom_complet)}
                    </span>
                    <p className="font-medium text-slate-800">{agent.nom_complet}</p>
                  </div>
                </Cellule>
                <Cellule className="text-slate-600">{agent.poste || "—"}</Cellule>
                <Cellule className="text-slate-600">
                  {agent.departement_nom || "—"}
                </Cellule>
                <Cellule className="text-slate-500">{agent.manager_nom || "—"}</Cellule>
                <Cellule className="text-slate-500">
                  <p>{agent.email || "—"}</p>
                  <p className="text-xs">{agent.telephone}</p>
                </Cellule>
                {estRH && (
                  <Cellule className="whitespace-nowrap text-slate-500">
                    {agent.date_embauche ? (
                      <>
                        {Math.floor(agent.anciennete_mois / 12)} an(s)
                        <span className="ml-1 text-xs text-slate-400">
                          depuis {date(agent.date_embauche)}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </Cellule>
                )}
              </tr>
            ))}
          </Tableau>
        )}
      </Carte>
    </>
  );
}

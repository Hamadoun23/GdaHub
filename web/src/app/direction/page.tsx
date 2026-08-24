"use client";

/**
 * Module Direction : la vue consolidée du groupe.
 *
 * Rien n'est calculé ici : les chiffres viennent de chaque service, rassemblés
 * par le service `direction` avec le jeton du directeur. Un domaine
 * injoignable affiche son motif plutôt que de faire échouer la page — un
 * tableau de bord qui refuse de s'afficher parce qu'une application sur cinq
 * se tait est moins utile qu'un tableau de bord honnête.
 */

import { useState } from "react";

import { Coquille } from "@/composants/Coquille";
import {
  Alerte,
  Badge,
  Carte,
  Chargement,
  EnTetePage,
  EtatVide,
  Grille,
  LigneListe,
  ListeLignes,
  Onglets,
  Selection,
  Statistique,
} from "@/composants/ui";
import { montant, nombre } from "@/lib/format";
import { useListe, useRessource } from "@/lib/ressources";

type BlocApplication = {
  libelle: string;
  disponible: boolean;
  motif?: string;
  indicateurs?: Record<string, number | string>;
};

type Consolidation = {
  date: string;
  applications: Record<string, BlocApplication>;
  files_d_attente: Record<
    string,
    { disponible: boolean; en_attente?: number; motif?: string }
  >;
};

type RegleCircuit = {
  id: number;
  libelle: string;
  type_document: string;
  type_document_libelle: string;
  ordre: number;
  role_valideur: string;
  valideur_hierarchique: boolean;
  valideur_nom: string;
  nature: string;
  nature_libelle: string;
  actif: boolean;
};

type Synthese = {
  id: number;
  mois: string;
  application: string;
  indicateurs: Record<string, number | string>;
};

/** Comment présenter un indicateur, selon ce qu'il mesure. */
const PRESENTATION: Record<string, { libelle: string; monnaie?: boolean }> = {
  a_traiter: { libelle: "Dossiers à traiter" },
  effectif_en_conge: { libelle: "Agents en congé aujourd'hui" },
  mes_demandes_en_cours: { libelle: "Mes demandes en cours" },
  mes_demandes_annee: { libelle: "Mes demandes cette année" },
  depenses_du_mois: { libelle: "Dépenses du mois", monnaie: true },
  mes_depenses_du_mois: { libelle: "Mes dépenses du mois", monnaie: true },
  caisses_sous_alerte: { libelle: "Caisses sous alerte" },
};

export default function PageDirection() {
  return (
    <Coquille>
      <Contenu />
    </Coquille>
  );
}

function Contenu() {
  const [onglet, setOnglet] = useState<"consolide" | "circuits" | "syntheses">(
    "consolide",
  );
  const [application, setApplication] = useState("rh");

  const consolidation = useRessource<Consolidation>("/direction/tableau-de-bord");
  const circuits = useRessource<{
    disponible: boolean;
    motif?: string;
    regles?: { resultats: RegleCircuit[] };
  }>(onglet === "circuits" ? `/direction/circuits/${application}` : null);
  const syntheses = useListe<Synthese>(
    onglet === "syntheses" ? "/direction/syntheses?taille=50" : null,
  );

  return (
    <>
      <EnTetePage
        titre="Direction"
        description="Les indicateurs du groupe, les circuits de validation et leur historique."
      />

      <Onglets
        onglets={[
          { cle: "consolide" as const, libelle: "Tableau de bord" },
          { cle: "circuits" as const, libelle: "Circuits de validation" },
          { cle: "syntheses" as const, libelle: "Historique" },
        ]}
        actif={onglet}
        onChange={setOnglet}
      />

      {onglet === "consolide" ? (
        consolidation.chargement ? (
          <Chargement libelle="Consolidation en cours..." />
        ) : consolidation.erreur ? (
          <Alerte>{consolidation.erreur}</Alerte>
        ) : consolidation.donnees ? (
          <div className="space-y-6">
            <FilesDAttente donnees={consolidation.donnees.files_d_attente} />
            {Object.entries(consolidation.donnees.applications).map(
              ([code, bloc]) => (
                <BlocIndicateurs key={code} bloc={bloc} />
              ),
            )}
          </div>
        ) : null
      ) : null}

      {onglet === "circuits" ? (
        <div className="space-y-4">
          <div className="max-w-xs">
            <Selection
              libelle="Application"
              value={application}
              onChange={(evenement) => setApplication(evenement.target.value)}
              options={[
                { valeur: "rh", libelle: "Ressources humaines" },
                { valeur: "finance", libelle: "Finance" },
              ]}
            />
          </div>

          <Carte
            titre="Qui valide quoi"
            sousTitre="Les règles vivent dans chaque service ; cette console les lit chez lui."
            sansPadding
          >
            <div className="px-4 sm:px-5">
              {circuits.chargement ? (
                <Chargement />
              ) : circuits.erreur ? (
                <div className="py-5">
                  <Alerte>{circuits.erreur}</Alerte>
                </div>
              ) : !circuits.donnees?.disponible ? (
                <div className="py-5">
                  <Alerte ton="avertissement">
                    {circuits.donnees?.motif ?? "Service indisponible."}
                  </Alerte>
                </div>
              ) : !circuits.donnees.regles?.resultats.length ? (
                <EtatVide
                  titre="Aucune règle"
                  description="Sans règle, un document soumis est approuvé d'office, sans étape ni trace."
                />
              ) : (
                <ListeLignes>
                  {circuits.donnees.regles.resultats.map((regle) => (
                    <LigneListe
                      key={regle.id}
                      titre={`[${regle.ordre}] ${regle.libelle}`}
                      detail={
                        <>
                          {regle.type_document_libelle} ·{" "}
                          {regle.valideur_nom
                            ? regle.valideur_nom
                            : regle.valideur_hierarchique
                              ? `responsable direct (sinon ${regle.role_valideur})`
                              : `rôle « ${regle.role_valideur} »`}
                        </>
                      }
                      statut={
                        <Badge
                          ton={regle.nature === "DECISION" ? "info" : "neutre"}
                        >
                          {regle.nature_libelle}
                        </Badge>
                      }
                    />
                  ))}
                </ListeLignes>
              )}
            </div>
          </Carte>
        </div>
      ) : null}

      {onglet === "syntheses" ? (
        <Carte
          titre="Photographies mensuelles"
          sousTitre="Ce que la direction a archivé, mois par mois."
          sansPadding
        >
          <div className="px-4 sm:px-5">
            {syntheses.chargement ? (
              <Chargement />
            ) : !syntheses.donnees?.length ? (
              <EtatVide
                titre="Aucune synthèse"
                description="Elles se construisent avec « manage.py construire_synthese »."
              />
            ) : (
              <ListeLignes>
                {syntheses.donnees.map((synthese) => (
                  <LigneListe
                    key={synthese.id}
                    titre={`${synthese.application} — ${synthese.mois.slice(0, 7)}`}
                    detail={Object.entries(synthese.indicateurs)
                      .map(([cle, valeur]) => `${cle} : ${valeur}`)
                      .join(" · ")}
                  />
                ))}
              </ListeLignes>
            )}
          </div>
        </Carte>
      ) : null}
    </>
  );
}

function FilesDAttente({
  donnees,
}: {
  donnees: Consolidation["files_d_attente"];
}) {
  const entrees = Object.entries(donnees);
  if (!entrees.length) return null;
  return (
    <Grille colonnes={entrees.length >= 3 ? 3 : 2}>
      {entrees.map(([code, file]) => (
        <Statistique
          key={code}
          libelle={`En attente de vous — ${code}`}
          valeur={file.disponible ? (file.en_attente ?? 0) : "—"}
          detail={file.disponible ? "Dossiers à trancher" : file.motif}
          ton={file.disponible && file.en_attente ? "alerte" : "succes"}
        />
      ))}
    </Grille>
  );
}

function BlocIndicateurs({ bloc }: { bloc: BlocApplication }) {
  if (!bloc.disponible) {
    return (
      <Carte titre={bloc.libelle}>
        <Alerte ton="avertissement">{bloc.motif ?? "Indisponible."}</Alerte>
      </Carte>
    );
  }

  const entrees = Object.entries(bloc.indicateurs ?? {});
  if (!entrees.length) {
    return (
      <Carte titre={bloc.libelle}>
        <EtatVide titre="Aucun indicateur publié" />
      </Carte>
    );
  }

  return (
    <Carte titre={bloc.libelle}>
      <Grille colonnes={entrees.length >= 4 ? 4 : 3}>
        {entrees.map(([cle, valeur]) => {
          const presentation = PRESENTATION[cle];
          const affichage = presentation?.monnaie
            ? montant(valeur as string)
            : typeof valeur === "number"
              ? nombre(valeur)
              : String(valeur);
          return (
            <Statistique
              key={cle}
              libelle={presentation?.libelle ?? cle.replace(/_/g, " ")}
              valeur={affichage}
            />
          );
        })}
      </Grille>
    </Carte>
  );
}

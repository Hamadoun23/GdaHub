"use client";

import { useMemo, useState } from "react";

import { BadgeStatut, CircuitValidation } from "@/rh/composants/metier";
import {
  Alerte,
  Badge,
  Carte,
  Cellule,
  Chargement,
  EnTetePage,
  EtatVide,
  Modale,
  Tableau,
} from "@/rh/composants/ui";
import { useAuth } from "@/rh/lib/auth";
import { date, dateHeure, heure, montant } from "@/rh/lib/format";
import { useListe } from "@/rh/lib/hooks";
import { estValideur } from "@/rh/lib/navigation";
import type {
  DemandeAbsence,
  Depense,
  EtapeValidation,
  StatutDocument,
} from "@/rh/lib/types";

type Categorie = "conge" | "retard" | "demande";

interface Ligne {
  cle: string;
  categorie: Categorie;
  libelleCategorie: string;
  numero: string;
  demandeur: string;
  objet: string;
  valeur: string;
  motif: string;
  departement: string;
  statut: StatutDocument;
  statutLibelle: string;
  motifRejet: string;
  soumisLe: string | null;
  creeLe: string;
  etapes: EtapeValidation[];
}

const TONS: Record<Categorie, "marque" | "alerte" | "neutre"> = {
  conge: "marque",
  retard: "alerte",
  demande: "neutre",
};

/**
 * Registre de tout ce qui a circule.
 *
 * Rien ne disparait apres decision : une demande approuvee ou rejetee reste
 * consultable avec son circuit et les commentaires de chaque intervenant.
 * C'est la piste d'audit du systeme — et la raison d'etre de la base
 * Postgres qui porte l'application.
 */
export default function PageHistorique() {
  const { utilisateur } = useAuth();
  const [selection, setSelection] = useState<Ligne | null>(null);
  const [filtre, setFiltre] = useState<Categorie | "tout">("tout");
  const [departement, setDepartement] = useState("tous");

  const absences = useListe<DemandeAbsence>("/demandes-absence/");
  const demandes = useListe<Depense>("/depenses/", { racine: "finance" });

  const chargement = absences.chargement || demandes.chargement;
  const erreur = absences.erreur ?? demandes.erreur;

  const lignes = useMemo<Ligne[]>(() => {
    const desAbsences = (absences.donnees ?? []).map((absence): Ligne => {
      const retard = absence.categorie === "RETARD";
      return {
        cle: `absence-${absence.id}`,
        categorie: retard ? "retard" : "conge",
        libelleCategorie: retard ? "Retard" : "Conge",
        numero: absence.numero,
        demandeur: absence.demandeur_nom,
        objet: absence.type_absence_libelle,
        valeur: retard
          ? absence.heure_debut
            ? heure(absence.heure_debut)
            : "—"
          : `${date(absence.date_debut)} → ${date(absence.date_fin)}`,
        motif: absence.motif,
        departement: absence.demandeur_departement_nom || "Sans departement",
        statut: absence.statut,
        statutLibelle: absence.statut_libelle,
        motifRejet: absence.motif_rejet,
        soumisLe: absence.date_soumission,
        creeLe: absence.cree_le,
        etapes: absence.etapes,
      };
    });

    const desDemandes = (demandes.donnees ?? []).map(
      (demande): Ligne => ({
        cle: `demande-${demande.id}`,
        categorie: "demande",
        libelleCategorie: "Demande",
        numero: demande.numero,
        demandeur: demande.demandeur_nom,
        objet: demande.libelle,
        valeur: montant(demande.montant, demande.devise),
        motif: demande.description,
        departement: demande.demandeur_departement_nom || "Sans departement",
        statut: demande.statut,
        statutLibelle: demande.statut_libelle,
        motifRejet: demande.motif_rejet,
        soumisLe: demande.date_soumission,
        creeLe: demande.cree_le,
        etapes: demande.etapes,
      }),
    );

    return [...desAbsences, ...desDemandes].sort(
      (a, b) =>
        new Date(b.soumisLe ?? b.creeLe).getTime() -
        new Date(a.soumisLe ?? a.creeLe).getTime(),
    );
  }, [absences.donnees, demandes.donnees]);

  const parCategorie =
    filtre === "tout" ? lignes : lignes.filter((ligne) => ligne.categorie === filtre);
  const departements = useMemo(
    () => [...new Set(lignes.map((ligne) => ligne.departement))].sort(),
    [lignes],
  );
  const filtrees =
    departement === "tous"
      ? parCategorie
      : parCategorie.filter((ligne) => ligne.departement === departement);

  const global = utilisateur ? estValideur(utilisateur) : false;

  return (
    <>
      <EnTetePage
        titre="Historique"
        description={
          global
            ? "Tout ce qui a ete demande dans votre perimetre, decide ou non. Rien n'est efface apres validation."
            : "Vos demandes passees et leur circuit. Rien n'est efface apres validation."
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Filtre
          libelle="Tout"
          compteur={lignes.length}
          actif={filtre === "tout"}
          onClick={() => setFiltre("tout")}
        />
        {(["conge", "retard", "demande"] as Categorie[]).map((categorie) => (
          <Filtre
            key={categorie}
            libelle={
              categorie === "conge"
                ? "Conges"
                : categorie === "retard"
                  ? "Retards"
                  : "Demandes"
            }
            compteur={lignes.filter((ligne) => ligne.categorie === categorie).length}
            actif={filtre === categorie}
            onClick={() => setFiltre(categorie)}
          />
        ))}
      </div>

      {departements.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-slate-500">Departement</span>
          <Filtre
            libelle="Tous"
            compteur={parCategorie.length}
            actif={departement === "tous"}
            onClick={() => setDepartement("tous")}
          />
          {departements.map((nom) => (
            <Filtre
              key={nom}
              libelle={nom}
              compteur={parCategorie.filter((ligne) => ligne.departement === nom).length}
              actif={departement === nom}
              onClick={() => setDepartement(nom)}
            />
          ))}
        </div>
      )}

      <Carte sansPadding>
        {chargement ? (
          <Chargement libelle="Lecture du registre..." />
        ) : erreur ? (
          <div className="p-4 sm:p-5">
            <Alerte>{erreur}</Alerte>
          </div>
        ) : filtrees.length === 0 ? (
          <EtatVide
            titre="Registre vide"
            description="Aucune demande n'a encore ete soumise."
          />
        ) : (
          <Tableau
            entetes={[
              "Numero",
              "Type",
              "Demandeur",
              "Departement",
              "Objet",
              "Periode / montant",
              "Statut",
            ]}
          >
            {filtrees.map((ligne) => (
              <tr
                key={ligne.cle}
                className="cursor-pointer hover:bg-slate-50/60"
                onClick={() => setSelection(ligne)}
              >
                <Cellule className="whitespace-nowrap font-medium text-slate-800">
                  {ligne.numero}
                </Cellule>
                <Cellule>
                  <Badge ton={TONS[ligne.categorie]}>{ligne.libelleCategorie}</Badge>
                </Cellule>
                <Cellule>{ligne.demandeur}</Cellule>
                <Cellule className="whitespace-nowrap text-slate-500">
                  {ligne.departement}
                </Cellule>
                <Cellule className="max-w-64 truncate text-slate-600">
                  {ligne.objet}
                </Cellule>
                <Cellule className="whitespace-nowrap tabular-nums">
                  {ligne.valeur}
                </Cellule>
                <Cellule>
                  <BadgeStatut statut={ligne.statut} libelle={ligne.statutLibelle} />
                </Cellule>
              </tr>
            ))}
          </Tableau>
        )}
      </Carte>

      <Modale
        ouverte={selection !== null}
        titre={selection ? `${selection.libelleCategorie} ${selection.numero}` : ""}
        description={selection ? `Demande de ${selection.demandeur}` : ""}
        onFermer={() => setSelection(null)}
        large
      >
        {selection && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="etiquette">Objet</p>
                <p className="text-sm text-slate-800">{selection.objet}</p>
              </div>
              <div>
                <p className="etiquette">Periode / montant</p>
                <p className="text-sm text-slate-800">{selection.valeur}</p>
              </div>
              <div>
                <p className="etiquette">Departement</p>
                <p className="text-sm text-slate-800">{selection.departement}</p>
              </div>
              <div>
                <p className="etiquette">Soumis le</p>
                <p className="text-sm text-slate-800">
                  {selection.soumisLe ? dateHeure(selection.soumisLe) : "—"}
                </p>
              </div>
              <div>
                <p className="etiquette">Statut</p>
                <BadgeStatut
                  statut={selection.statut}
                  libelle={selection.statutLibelle}
                />
              </div>
            </div>

            <div>
              <p className="etiquette">Motif</p>
              {selection.motif ? (
                <p className="whitespace-pre-line text-sm text-slate-700">
                  {selection.motif}
                </p>
              ) : (
                <p className="text-sm italic text-slate-400">Rien de precise.</p>
              )}
            </div>

            {selection.statut === "REJETE" && selection.motifRejet && (
              <Alerte titre="Motif du rejet">{selection.motifRejet}</Alerte>
            )}

            <div>
              <p className="etiquette mb-3">Circuit de validation</p>
              <CircuitValidation etapes={selection.etapes} />
            </div>
          </div>
        )}
      </Modale>
    </>
  );
}

function Filtre({
  libelle,
  compteur,
  actif,
  onClick,
}: {
  libelle: string;
  compteur: number;
  actif: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        actif
          ? "rounded-full bg-marque-600 px-3 py-1.5 text-xs font-medium text-white"
          : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
      }
    >
      {libelle}
      <span className="ml-1.5 tabular-nums opacity-70">{compteur}</span>
    </button>
  );
}

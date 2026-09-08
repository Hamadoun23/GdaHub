"use client";

import { useMemo, useState } from "react";

import { Icone } from "@/rh/composants/icones";
import { ActionsCirculation, BadgeStatut, CircuitValidation } from "@/rh/composants/metier";
import {
  Alerte,
  Badge,
  Carte,
  Cellule,
  Chargement,
  EnTetePage,
  EtatVide,
  Modale,
  Onglets,
  Tableau,
  TuileStat,
} from "@/rh/composants/ui";
import { useAuth } from "@/rh/lib/auth";
import { date, heure, montant } from "@/rh/lib/format";
import { useListe } from "@/rh/lib/hooks";
import type {
  DemandeAbsence,
  Depense,
  DocumentCirculant,
  EtapeValidation,
  StatutDocument,
} from "@/rh/lib/types";

type Onglet = "a-traiter" | "en-circulation";

interface Dossier {
  cle: string;
  id: number;
  ressource: string;
  racine: "rh" | "finance";
  type: "Conge" | "Retard" | "Demande";
  numero: string;
  demandeur: number;
  demandeurNom: string;
  objet: string;
  valeur: string;
  motif: string;
  libelleMotif: string;
  justificatif: string | null;
  statut: StatutDocument;
  statutLibelle: string;
  soumisLe: string | null;
  creeLe: string;
  etapes: EtapeValidation[];
  /** Tous ceux qui peuvent encore se prononcer. */
  chez: string[];
  /** Le dossier attend une decision de l'utilisateur courant. */
  aMoi: boolean;
  /** Document brut, transmis aux actions de circulation. */
  document: DocumentCirculant;
  departement: string;
}

const TONS = {
  Conge: "marque",
  Retard: "alerte",
  Demande: "neutre",
} as const;

/**
 * Tous ceux qui peuvent encore se prononcer.
 *
 * Les etapes sont ouvertes en parallele : il n'y a pas un detenteur mais
 * plusieurs, et chacun decide quand il veut.
 */
function enAttenteDe(etapes: EtapeValidation[]): string[] {
  return etapes
    .filter((etape) => etape.decision === "EN_ATTENTE")
    .map((etape) => etape.valideur_attendu_nom || etape.role_valideur_libelle);
}

function depuisAbsence(absence: DemandeAbsence, aMoi: boolean): Dossier {
  const retard = absence.categorie === "RETARD";
  return {
    cle: `absence-${absence.id}`,
    id: absence.id,
    ressource: "/demandes-absence",
    racine: "rh",
    type: retard ? "Retard" : "Conge",
    numero: absence.numero,
    demandeur: absence.demandeur,
    demandeurNom: absence.demandeur_nom,
    objet: absence.type_absence_libelle,
    valeur: retard
      ? absence.heure_debut
        ? `arrivee ${heure(absence.heure_debut)}`
        : date(absence.date_debut)
      : `${date(absence.date_debut)} → ${date(absence.date_fin)}`,
    motif: absence.motif,
    libelleMotif: "Motif de la demande",
    justificatif: absence.justificatif,
    statut: absence.statut,
    statutLibelle: absence.statut_libelle,
    soumisLe: absence.date_soumission,
    creeLe: absence.cree_le,
    etapes: absence.etapes,
    chez: enAttenteDe(absence.etapes),
    aMoi,
    document: absence,
    departement: absence.demandeur_departement_nom || "Sans departement",
  };
}

function depuisDemande(demande: Depense, aMoi: boolean): Dossier {
  return {
    cle: `demande-${demande.id}`,
    id: demande.id,
    ressource: "/depenses",
    racine: "finance",
    type: "Demande",
    numero: demande.numero,
    demandeur: demande.demandeur,
    demandeurNom: demande.demandeur_nom,
    objet: demande.libelle,
    valeur: montant(demande.montant, demande.devise),
    motif: demande.description,
    libelleMotif: "Motif",
    justificatif: demande.piece_justificative,
    statut: demande.statut,
    statutLibelle: demande.statut_libelle,
    soumisLe: demande.date_soumission,
    creeLe: demande.cree_le,
    etapes: demande.etapes,
    chez: enAttenteDe(demande.etapes),
    aMoi,
    document: demande,
    departement: demande.demandeur_departement_nom || "Sans departement",
  };
}

/**
 * Ecran des decideurs.
 *
 * Deux lectures : ce qui attend **ma** decision, et tout ce qui circule dans
 * mon perimetre. La seconde est indispensable — un decideur doit savoir ce qui
 * est en cours meme quand le dossier est encore chez quelqu'un d'autre, sans
 * quoi une file vide se confond avec une absence de demandes.
 */
export default function PageValidations() {
  const { utilisateur } = useAuth();
  const [onglet, setOnglet] = useState<Onglet>("a-traiter");
  const [selection, setSelection] = useState<Dossier | null>(null);
  const [departement, setDepartement] = useState("tous");

  const aValiderAbsences = useListe<DemandeAbsence>("/demandes-absence/a-valider/");
  const aValiderDemandes = useListe<Depense>("/depenses/a-valider/", { racine: "finance" });
  const toutesAbsences = useListe<DemandeAbsence>("/demandes-absence/?statut=EN_VALIDATION");
  const toutesDemandes = useListe<Depense>("/depenses/?statut=EN_VALIDATION", {
    racine: "finance",
  });

  const requetes = [aValiderAbsences, aValiderDemandes, toutesAbsences, toutesDemandes];
  const chargement = requetes.some((requete) => requete.chargement);
  const erreur = requetes.find((requete) => requete.erreur)?.erreur ?? null;

  const aTraiter = useMemo<Dossier[]>(
    () =>
      [
        ...(aValiderAbsences.donnees ?? []).map((a) => depuisAbsence(a, true)),
        ...(aValiderDemandes.donnees ?? []).map((d) => depuisDemande(d, true)),
      ].sort(
        (a, b) =>
          new Date(a.soumisLe ?? a.creeLe).getTime() -
          new Date(b.soumisLe ?? b.creeLe).getTime(),
      ),
    [aValiderAbsences.donnees, aValiderDemandes.donnees],
  );

  const enCirculation = useMemo<Dossier[]>(() => {
    const miens = new Set(aTraiter.map((dossier) => dossier.cle));
    return [
      ...(toutesAbsences.donnees ?? []).map((a) =>
        depuisAbsence(a, miens.has(`absence-${a.id}`)),
      ),
      ...(toutesDemandes.donnees ?? []).map((d) =>
        depuisDemande(d, miens.has(`demande-${d.id}`)),
      ),
    ].sort(
      (a, b) =>
        new Date(a.soumisLe ?? a.creeLe).getTime() -
        new Date(b.soumisLe ?? b.creeLe).getTime(),
    );
  }, [toutesAbsences.donnees, toutesDemandes.donnees, aTraiter]);

  const source = onglet === "a-traiter" ? aTraiter : enCirculation;
  // Les departements proposes sont ceux effectivement representes : un filtre
  // qui ne renvoie jamais rien n'aide personne.
  const departements = useMemo(
    () => [...new Set(source.map((dossier) => dossier.departement))].sort(),
    [source],
  );
  const affiches =
    departement === "tous"
      ? source
      : source.filter((dossier) => dossier.departement === departement);

  const rafraichir = () => {
    requetes.forEach((requete) => void requete.recharger());
    setSelection(null);
  };

  return (
    <>
      <EnTetePage
        titre="A valider"
        description="Les dossiers qui attendent votre decision, et tout ce qui circule dans votre perimetre."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 max-sm:[&>*:last-child]:col-span-2">
        <TuileStat
          libelle="A traiter"
          valeur={aTraiter.length}
          detail="Dossiers attendant votre decision"
          ton={aTraiter.length ? "alerte" : "succes"}
          icone={<Icone nom="alerte" />}
        />
        <TuileStat
          libelle="En circulation"
          valeur={enCirculation.length}
          detail="Soumis, pas encore tranches"
          ton="marque"
          icone={<Icone nom="indicateur" />}
        />
        <TuileStat
          libelle="Plus ancien dossier"
          icone={<Icone nom="presence" />}
          valeur={
            enCirculation.length
              ? date(enCirculation[0].soumisLe ?? enCirculation[0].creeLe)
              : "—"
          }
          detail="Traitez en priorite les dossiers bloques"
        />
      </div>

      <Onglets
        onglets={[
          { cle: "a-traiter", libelle: "A traiter", compteur: aTraiter.length },
          {
            cle: "en-circulation",
            libelle: "En circulation",
            compteur: enCirculation.length,
          },
        ]}
        actif={onglet}
        onChange={setOnglet}
      />

      {departements.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-slate-500">
            Departement
          </span>
          <FiltreDepartement
            libelle="Tous"
            compteur={source.length}
            actif={departement === "tous"}
            onClick={() => setDepartement("tous")}
          />
          {departements.map((nom) => (
            <FiltreDepartement
              key={nom}
              libelle={nom}
              compteur={source.filter((dossier) => dossier.departement === nom).length}
              actif={departement === nom}
              onClick={() => setDepartement(nom)}
            />
          ))}
        </div>
      )}

      <Carte sansPadding>
        {chargement ? (
          <Chargement libelle="Consolidation de vos files..." />
        ) : erreur ? (
          <div className="p-4 sm:p-5">
            <Alerte>{erreur}</Alerte>
          </div>
        ) : affiches.length === 0 ? (
          <EtatVide
            titre={
              onglet === "a-traiter"
                ? "Aucune decision en attente"
                : "Aucun dossier en circulation"
            }
            description={
              onglet === "a-traiter" && enCirculation.length > 0
                ? `Rien a votre etape pour l'instant. ${enCirculation.length} dossier(s) circulent : voyez l'onglet « En circulation ».`
                : "Tous les dossiers de votre perimetre ont ete traites."
            }
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
              "En attente de",
              "",
            ]}
          >
            {affiches.map((dossier) => (
              <tr
                key={dossier.cle}
                className="cursor-pointer hover:bg-slate-50/60"
                onClick={() => setSelection(dossier)}
              >
                <Cellule className="whitespace-nowrap font-medium text-slate-800">
                  {dossier.numero}
                </Cellule>
                <Cellule>
                  <Badge ton={TONS[dossier.type]}>{dossier.type}</Badge>
                </Cellule>
                <Cellule>{dossier.demandeurNom}</Cellule>
                <Cellule className="text-slate-600">{dossier.departement}</Cellule>
                <Cellule className="max-w-72 truncate text-slate-600">
                  {dossier.objet}
                </Cellule>
                <Cellule className="whitespace-nowrap tabular-nums">
                  {dossier.valeur}
                </Cellule>
                <Cellule className="text-slate-500">
                  {dossier.aMoi && (
                    <span className="font-medium text-amber-700">Vous</span>
                  )}
                  {dossier.aMoi && dossier.chez.length > 1 && " · "}
                  {dossier.chez
                    .filter((nom) => !dossier.aMoi || nom !== "Vous")
                    .slice(0, dossier.aMoi ? 2 : 3)
                    .join(" · ") || (dossier.aMoi ? "" : "—")}
                </Cellule>
                <Cellule className="text-right text-xs text-marque-600">Examiner</Cellule>
              </tr>
            ))}
          </Tableau>
        )}
      </Carte>

      <Modale
        ouverte={selection !== null}
        titre={`${selection?.type ?? ""} ${selection?.numero ?? ""}`}
        description={selection ? `Demande de ${selection.demandeurNom}` : undefined}
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
                <p className="text-sm font-medium tabular-nums text-slate-900">
                  {selection.valeur}
                </p>
              </div>
              <div>
                <p className="etiquette">Departement</p>
                <p className="text-sm text-slate-800">{selection.departement}</p>
              </div>
              <div>
                <p className="etiquette">Soumis le</p>
                <p className="text-sm text-slate-800">{date(selection.soumisLe)}</p>
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
              <p className="etiquette">{selection.libelleMotif}</p>
              {selection.motif.trim() ? (
                <p className="whitespace-pre-line text-sm text-slate-700">
                  {selection.motif}
                </p>
              ) : (
                <p className="text-sm italic text-slate-400">
                  Le demandeur n&apos;a rien precise.
                </p>
              )}
            </div>

            {selection.justificatif && (
              <div>
                <p className="etiquette">Justificatif</p>
                <a
                  href={selection.justificatif}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-marque-600 underline underline-offset-2 hover:text-marque-700"
                >
                  Ouvrir la piece jointe
                </a>
              </div>
            )}

            <div>
              <p className="etiquette mb-3">Circuit de validation</p>
              <CircuitValidation etapes={selection.etapes} />
            </div>

            <div className="border-t border-slate-100 pt-4">
              {selection.aMoi ? (
                <ActionsCirculation
                  ressource={selection.ressource}
                  racine={selection.racine}
                  document={selection.document}
                  estDemandeur={selection.demandeur === utilisateur?.id}
                  peutDecider
                  onChangement={rafraichir}
                />
              ) : (
                <p className="text-sm text-slate-500">
                  Aucune etape de ce dossier ne vous revient. Il reste ouvert
                  pour{" "}
                  <strong>{selection.chez.join(", ") || "personne"}</strong>, qui
                  peuvent se prononcer dans l&apos;ordre qu&apos;ils veulent.
                </p>
              )}
            </div>
          </div>
        )}
      </Modale>
    </>
  );
}

function FiltreDepartement({
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

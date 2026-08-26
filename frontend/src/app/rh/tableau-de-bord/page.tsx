"use client";

import { useRouter } from "next/navigation";

import { Icone } from "@/rh/composants/icones";
import { BadgeStatut } from "@/rh/composants/metier";
import {
  Alerte,
  Badge,
  Bouton,
  Carte,
  Chargement,
  EnTetePage,
  EtatVide,
  LigneListe,
  ListeLignes,
  StatPrincipale,
  TuileStat,
} from "@/rh/composants/ui";
import { useAuth } from "@/rh/lib/auth";
import { date, heure, montant, nombre } from "@/rh/lib/format";
import { useListe, useRessource } from "@/rh/lib/hooks";
import { estValideur } from "@/rh/lib/navigation";
import type { DemandeAbsence, Depense, SoldeConge } from "@/rh/lib/types";

/**
 * Accueil.
 *
 * Deux lectures d'un meme ecran, selon ce que la personne vient y faire. Un
 * salarie vient suivre ses propres demandes ; un valideur — RH, Direction ou
 * encadrant — vient traiter celles des autres et savoir qui est absent. Le
 * premier bloc affiche donc ce qui compte pour chacun, sans rien retirer :
 * un valideur garde ses demarches personnelles, plus bas.
 */
export default function PageAccueil() {
  const { utilisateur } = useAuth();
  const valideur = utilisateur ? estValideur(utilisateur) : false;
  return valideur ? <AccueilValideur /> : <AccueilSalarie />;
}

// --- Outils partages -------------------------------------------------------

interface Element {
  cle: string;
  titre: string;
  detail: string;
  valeur?: string;
  statut: DemandeAbsence["statut"];
  statutLibelle: string;
  etape: string;
}

function elementsDe(absences: DemandeAbsence[], demandes: Depense[]): Element[] {
  return [
    ...absences.map((absence) => ({
      cle: `a-${absence.id}`,
      titre: absence.type_absence_libelle,
      detail:
        absence.categorie === "RETARD"
          ? `${date(absence.date_debut)}${absence.heure_debut ? ` · ${heure(absence.heure_debut)}` : ""}`
          : `${date(absence.date_debut)} → ${date(absence.date_fin)}`,
      statut: absence.statut,
      statutLibelle: absence.statut_libelle,
      etape: absence.etape_courante_libelle,
    })),
    ...demandes.map((demande) => ({
      cle: `d-${demande.id}`,
      titre: demande.libelle,
      detail: date(demande.date_depense),
      valeur: montant(demande.montant, demande.devise),
      statut: demande.statut,
      statutLibelle: demande.statut_libelle,
      etape: demande.etape_courante_libelle,
    })),
  ];
}

function ActionRapide({
  titre,
  description,
  icone,
  onClick,
}: {
  titre: string;
  description: string;
  icone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-marque-300 hover:bg-marque-50/40"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-marque-50 text-marque-600">
        <Icone nom={icone} className="size-4.5" />
      </span>
      <span>
        <span className="block text-sm font-medium text-slate-800">{titre}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
    </button>
  );
}

// --- Accueil du valideur ---------------------------------------------------

/** Ligne unifiee : les conges, retards et demandes se lisent cote a cote. */
interface Dossier {
  cle: string;
  type: "Conge" | "Retard" | "Demande";
  titre: string;
  detail: string;
  valeur?: string;
  statut: DemandeAbsence["statut"];
  attendus: string[];
  soumisLe: string | null;
  creeLe: string;
  montantEngage: number;
}

function attendus(etapes: DemandeAbsence["etapes"]): string[] {
  return etapes
    .filter((etape) => etape.decision === "EN_ATTENTE")
    .map((etape) => etape.valideur_attendu_nom || etape.role_valideur_libelle);
}

/**
 * Fond les deux sources en une seule liste.
 *
 * Un decideur ne raisonne pas par module : il veut voir ce qui attend une
 * decision, conges et engagements confondus.
 */
function dossiersDe(absences: DemandeAbsence[], demandes: Depense[]): Dossier[] {
  return [
    ...absences.map((absence): Dossier => {
      const retard = absence.categorie === "RETARD";
      return {
        cle: `a-${absence.id}`,
        type: retard ? "Retard" : "Conge",
        titre: `${absence.demandeur_nom} — ${absence.type_absence_libelle}`,
        detail: retard
          ? `${date(absence.date_debut)}${absence.heure_debut ? ` · arrivee ${heure(absence.heure_debut)}` : ""}`
          : `${date(absence.date_debut)} → ${date(absence.date_fin)}`,
        valeur: retard ? undefined : `${nombre(absence.nb_jours, 1)} j`,
        statut: absence.statut,
        attendus: attendus(absence.etapes),
        soumisLe: absence.date_soumission,
        creeLe: absence.cree_le,
        montantEngage: 0,
      };
    }),
    ...demandes.map(
      (demande): Dossier => ({
        cle: `d-${demande.id}`,
        type: "Demande",
        titre: `${demande.demandeur_nom} — ${demande.libelle}`,
        detail: date(demande.date_depense),
        valeur: montant(demande.montant, demande.devise),
        statut: demande.statut,
        attendus: attendus(demande.etapes),
        soumisLe: demande.date_soumission,
        creeLe: demande.cree_le,
        montantEngage: Number(demande.montant ?? 0),
      }),
    ),
  ].sort(
    (a, b) =>
      new Date(b.soumisLe ?? b.creeLe).getTime() -
      new Date(a.soumisLe ?? a.creeLe).getTime(),
  );
}

const TONS_TYPE = { Conge: "marque", Retard: "alerte", Demande: "neutre" } as const;

function AccueilValideur() {
  const router = useRouter();

  const aValiderAbsences = useListe<DemandeAbsence>("/rh/demandes-absence/a-valider/");
  const aValiderDemandes = useListe<Depense>("/finance/depenses/a-valider/");
  const toutesAbsences = useListe<DemandeAbsence>("/rh/demandes-absence/");
  const toutesDemandes = useListe<Depense>("/finance/depenses/");
  const monSolde = useRessource<SoldeConge>("/rh/soldes-conges/mon-solde/");

  const aTraiter = dossiersDe(
    aValiderAbsences.donnees ?? [],
    aValiderDemandes.donnees ?? [],
  );
  const chargement = aValiderAbsences.chargement || aValiderDemandes.chargement;
  const erreur = aValiderAbsences.erreur ?? aValiderDemandes.erreur;

  const tous = dossiersDe(toutesAbsences.donnees ?? [], toutesDemandes.donnees ?? []);
  const enCirculation = tous.filter((dossier) => dossier.statut === "EN_VALIDATION");
  const decides = tous.filter(
    (dossier) => dossier.statut === "APPROUVE" || dossier.statut === "REJETE",
  );
  const montantEnAttente = enCirculation.reduce(
    (total, dossier) => total + dossier.montantEngage,
    0,
  );
  const chargementRegistre = toutesAbsences.chargement || toutesDemandes.chargement;
  const erreurRegistre = toutesAbsences.erreur ?? toutesDemandes.erreur;

  return (
    <>
      <EnTetePage
        titre="Vue d'ensemble"
        description="Les conges, retards et demandes du personnel, et les dossiers qui attendent votre decision."
        actions={
          aTraiter.length > 0 ? (
            <Bouton onClick={() => router.push("/rh/validations")}>
              Traiter {aTraiter.length} dossier(s)
            </Bouton>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 max-sm:[&>*:last-child]:col-span-2">
        <TuileStat
          libelle="A traiter"
          valeur={aTraiter.length}
          detail="Dossiers attendant votre decision"
          ton={aTraiter.length ? "alerte" : "succes"}
        />
        <TuileStat
          libelle="En circulation"
          valeur={enCirculation.length}
          detail="Conges, retards et demandes confondus"
          ton="marque"
        />
        <TuileStat
          libelle="Montant en attente"
          valeur={montant(montantEnAttente)}
          detail="Engagements pas encore tranches"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Carte
            titre="Dossiers attendant votre decision"
            sousTitre="Conges, retards et demandes, tous modules confondus"
            actions={
              aTraiter.length > 0 ? (
                <Bouton
                  taille="petite"
                  variante="secondaire"
                  onClick={() => router.push("/rh/validations")}
                >
                  Ouvrir la file
                </Bouton>
              ) : undefined
            }
            sansPadding
          >
            <div className="px-4 sm:px-5">
              {chargement ? (
                <Chargement />
              ) : erreur ? (
                <div className="py-5">
                  <Alerte>{erreur}</Alerte>
                </div>
              ) : aTraiter.length === 0 ? (
                <EtatVide
                  titre="Rien a traiter"
                  description={
                    enCirculation.length > 0
                      ? `Rien a votre etape. ${enCirculation.length} dossier(s) circulent, voyez ci-dessous.`
                      : "Aucune demande en cours."
                  }
                />
              ) : (
                <ListeLignes>
                  {aTraiter.map((dossier) => (
                    <LigneListe
                      key={dossier.cle}
                      titre={dossier.titre}
                      detail={dossier.detail}
                      valeur={dossier.valeur}
                      statut={<Badge ton={TONS_TYPE[dossier.type]}>{dossier.type}</Badge>}
                      onClick={() => router.push("/rh/validations")}
                    />
                  ))}
                </ListeLignes>
              )}
            </div>
          </Carte>

          {/* Un decideur doit voir ce qui circule meme quand le dossier ne lui
              revient pas : sans cette liste, une file vide se confond avec une
              absence de demandes. */}
          <Carte
            titre="Tout ce qui circule"
            sousTitre="Les demandes du personnel et qui peut encore se prononcer"
            actions={
              <Bouton
                taille="petite"
                variante="secondaire"
                onClick={() => router.push("/rh/validations")}
              >
                Voir le detail
              </Bouton>
            }
            sansPadding
          >
            <div className="px-4 sm:px-5">
              {chargementRegistre ? (
                <Chargement />
              ) : erreurRegistre ? (
                <div className="py-5">
                  <Alerte>{erreurRegistre}</Alerte>
                </div>
              ) : enCirculation.length === 0 ? (
                <EtatVide
                  titre="Rien en circulation"
                  description="Aucune demande n'est en cours d'instruction."
                />
              ) : (
                <ListeLignes>
                  {enCirculation.map((dossier) => (
                    <LigneListe
                      key={dossier.cle}
                      titre={dossier.titre}
                      detail={`${dossier.detail} · en attente : ${dossier.attendus.join(" · ") || "—"}`}
                      valeur={dossier.valeur}
                      statut={<Badge ton={TONS_TYPE[dossier.type]}>{dossier.type}</Badge>}
                      onClick={() => router.push("/rh/validations")}
                    />
                  ))}
                </ListeLignes>
              )}
            </div>
          </Carte>

          <Carte
            titre="Deja decide"
            sousTitre="Ce qui a ete accorde ou refuse, quel que soit le demandeur"
            actions={
              <Bouton
                taille="petite"
                variante="secondaire"
                onClick={() => router.push("/rh/historique")}
              >
                Tout l&apos;historique
              </Bouton>
            }
            sansPadding
          >
            <div className="px-4 sm:px-5">
              {decides.length === 0 ? (
                <EtatVide
                  titre="Aucune decision rendue"
                  description="Les dossiers tranches apparaitront ici."
                />
              ) : (
                <ListeLignes>
                  {decides.slice(0, 6).map((dossier) => (
                    <LigneListe
                      key={dossier.cle}
                      titre={dossier.titre}
                      detail={dossier.detail}
                      valeur={dossier.valeur}
                      statut={
                        <BadgeStatut
                          statut={dossier.statut}
                          libelle={dossier.statut === "APPROUVE" ? "Accorde" : "Refuse"}
                        />
                      }
                      onClick={() => router.push("/rh/historique")}
                    />
                  ))}
                </ListeLignes>
              )}
            </div>
          </Carte>
        </div>

        <div className="space-y-6">
          <Carte titre="Mon espace" sousTitre="Vos propres demarches">
            <StatPrincipale
              libelle="Mon solde de conges"
              valeur={nombre(monSolde.donnees?.jours_restants, 1)}
              unite="jours"
              detail={`${nombre(monSolde.donnees?.jours_pris, 1)} pris`}
            />
            <div className="mt-4 space-y-2">
              <ActionRapide
                titre="Demander un conge"
                description="Vous aussi pouvez en poser"
                icone="conge"
                onClick={() => router.push("/rh/absences")}
              />
              <ActionRapide
                titre="Signaler un retard"
                description="Prevenir d'une arrivee tardive"
                icone="presence"
                onClick={() => router.push("/rh/retards")}
              />
              <ActionRapide
                titre="Nouvelle demande"
                description="Exprimer un besoin a la Finance"
                icone="demande"
                onClick={() => router.push("/rh/mes-demandes")}
              />
            </div>
          </Carte>
        </div>
      </div>
    </>
  );
}

// --- Accueil du salarie ----------------------------------------------------

function AccueilSalarie() {
  const { utilisateur } = useAuth();
  const router = useRouter();

  const solde = useRessource<SoldeConge>("/rh/soldes-conges/mon-solde/");
  const absences = useListe<DemandeAbsence>("/rh/demandes-absence/mes-demandes/");
  const demandes = useListe<Depense>("/finance/depenses/mes-demandes/");

  const enCours = elementsDe(absences.donnees ?? [], demandes.donnees ?? []).filter(
    (element) => element.statut === "EN_VALIDATION" || element.statut === "SOUMIS",
  );

  const acquis =
    Number(solde.donnees?.jours_acquis ?? 0) + Number(solde.donnees?.jours_reportes ?? 0);

  return (
    <>
      <EnTetePage
        titre={`Bonjour ${utilisateur?.nom_complet ?? ""}`.trim()}
        description="Vos demarches et le suivi de vos demandes."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatPrincipale
          libelle="Mon solde de conges"
          valeur={nombre(solde.donnees?.jours_restants, 1)}
          unite="jours"
          progression={{
            valeur: Number(solde.donnees?.jours_pris ?? 0),
            max: acquis || 1,
          }}
          detail={`${nombre(solde.donnees?.jours_pris, 1)} pris sur ${nombre(acquis, 1)} acquis`}
        />
        <TuileStat
          libelle="Mes demandes en cours"
          valeur={enCours.length}
          detail="En attente d'une decision"
          ton={enCours.length ? "alerte" : "succes"}
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionRapide
          titre="Demander un conge"
          description="Poser des jours sur son solde"
          icone="conge"
          onClick={() => router.push("/rh/absences")}
        />
        <ActionRapide
          titre="Demander une permission"
          description="S'absenter sans entamer son solde"
          icone="permission"
          onClick={() => router.push("/rh/permissions")}
        />
        <ActionRapide
          titre="Signaler un retard"
          description="Prevenir d'une arrivee tardive"
          icone="presence"
          onClick={() => router.push("/rh/retards")}
        />
        <ActionRapide
          titre="Nouvelle demande"
          description="Exprimer un besoin a la Finance"
          icone="demande"
          onClick={() => router.push("/rh/mes-demandes")}
        />
      </div>

      <Carte titre="Mes demandes en cours" sousTitre="Suivi des validations" sansPadding>
        <div className="px-4 sm:px-5">
          {absences.chargement || demandes.chargement ? (
            <Chargement />
          ) : absences.erreur || demandes.erreur ? (
            <div className="py-5">
              <Alerte>{absences.erreur ?? demandes.erreur}</Alerte>
            </div>
          ) : enCours.length === 0 ? (
            <EtatVide
              titre="Aucune demande en cours"
              description="Vos conges, permissions, retards et demandes apparaitront ici."
            />
          ) : (
            <ListeLignes>
              {enCours.map((element) => (
                <LigneListe
                  key={element.cle}
                  titre={element.titre}
                  detail={
                    element.etape
                      ? `${element.detail} · en attente : ${element.etape}`
                      : element.detail
                  }
                  valeur={element.valeur}
                  statut={
                    <BadgeStatut
                      statut={element.statut}
                      libelle={element.statutLibelle}
                    />
                  }
                />
              ))}
            </ListeLignes>
          )}
        </div>
      </Carte>
    </>
  );
}

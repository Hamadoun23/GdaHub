"use client";

import { useRouter } from "next/navigation";

import { AFaire } from "@/composants/dashboard-hub/a-faire";
import { Resume } from "@/composants/dashboard-hub/resume";
import { Total } from "@/composants/dashboard-hub/total";
import { Urgent } from "@/composants/dashboard-hub/urgent";
import type { ElementAFaire } from "@/composants/dashboard-hub/utiliser-a-faire";
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
} from "@/rh/composants/ui";
import { useAuth } from "@/rh/lib/auth";
import { date, heure, montant, nombre } from "@/rh/lib/format";
import { useListe, useRessource } from "@/rh/lib/hooks";
import { estValideur } from "@/rh/lib/navigation";
import type { DemandeAbsence, Depense, SoldeConge } from "@/rh/lib/types";

/**
 * Accueil.
 *
 * Reutilise les memes composants que le tableau de bord du hub
 * (`composants/dashboard-hub/{total,urgent,a-faire,resume}.tsx`, deja
 * alignes sur la reference "Virtus") plutot qu'une mise en page RH
 * bespoke : meme habillage partout ou le hub a deja tranche, seules les
 * donnees reelles RH different (conges/retards/demandes plutot que
 * RH/Finance/Planning). `Resume` a ete generalise (props `groupes`/`titre`/
 * `sousTitre`/`messageVide`) precisement pour ce genre de reemploi.
 *
 * Deux lectures d'un meme ecran, selon ce que la personne vient y faire. Un
 * salarie vient suivre ses propres demandes ; un valideur — RH, Direction ou
 * encadrant — vient traiter celles des autres et savoir qui est absent. Le
 * premier bloc affiche donc ce qui compte pour chacun, sans rien retirer :
 * un valideur garde ses demarches personnelles, plus bas, dans des cartes
 * RH classiques (aucun equivalent dans le gabarit a 4 cartes).
 */
export default function PageAccueil() {
  const { utilisateur } = useAuth();
  const valideur = utilisateur ? estValideur(utilisateur) : false;
  return valideur ? <AccueilValideur /> : <AccueilSalarie />;
}

// --- Outils partages -------------------------------------------------------

/** Couleurs par type de dossier — memes hex que `--chart-1/2/3` de
 * `globals.css`, pour rester dans la palette categorielle deja verifiee
 * (distinction daltonisme) plutot que d'en inventer une nouvelle. */
const COULEUR_PAR_CODE: Record<string, string> = {
  conge: "#2a78d6",
  retard: "#eb6834",
  demande: "#1baf7a",
};

const GROUPES_DOSSIERS = [
  { code: "conge", nom: "Congés" },
  { code: "retard", nom: "Retards" },
  { code: "demande", nom: "Demandes" },
];

interface Element {
  cle: string;
  code: "conge" | "retard" | "demande";
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
      code: (absence.categorie === "RETARD" ? "retard" : "conge") as Element["code"],
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
      code: "demande" as Element["code"],
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
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-marque-300 hover:bg-secondary"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-marque-500/15 text-marque-500">
        <Icone nom={icone} className="size-4.5" />
      </span>
      <span>
        <span className="block text-sm font-medium text-foreground">{titre}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

// --- Accueil du valideur ---------------------------------------------------

/** Ligne unifiee : les conges, retards et demandes se lisent cote a cote. */
interface Dossier {
  cle: string;
  code: "conge" | "retard" | "demande";
  type: "Conge" | "Retard" | "Demande";
  titre: string;
  demandeur: string;
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
        code: retard ? "retard" : "conge",
        type: retard ? "Retard" : "Conge",
        titre: `${absence.demandeur_nom} — ${absence.type_absence_libelle}`,
        demandeur: absence.demandeur_nom,
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
        code: "demande",
        type: "Demande",
        titre: `${demande.demandeur_nom} — ${demande.libelle}`,
        demandeur: demande.demandeur_nom,
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

/** `Dossier` (a traiter) -> `ElementAFaire`, pour reutiliser Total/Urgent/
 * AFaire/Resume tels quels. Un retard est le seul cas reellement urgent au
 * sens temporel — pas de seuil invente pour les autres. */
function versElementsAFaire(dossiers: Dossier[]): ElementAFaire[] {
  return dossiers.map((dossier) => ({
    cle: dossier.cle,
    code: dossier.code,
    app: dossier.type,
    href: "/rh/validations",
    titre: dossier.titre,
    sousTitre: dossier.detail,
    personne: dossier.demandeur,
    etat: "a_valider",
    urgent: dossier.type === "Retard",
  }));
}

function AccueilValideur() {
  const router = useRouter();

  const aValiderAbsences = useListe<DemandeAbsence>("/demandes-absence/a-valider/");
  const aValiderDemandes = useListe<Depense>("/depenses/a-valider/", { racine: "finance" });
  const toutesAbsences = useListe<DemandeAbsence>("/demandes-absence/");
  const toutesDemandes = useListe<Depense>("/depenses/", { racine: "finance" });
  const monSolde = useRessource<SoldeConge>("/soldes-conges/mon-solde/");

  const aTraiter = dossiersDe(
    aValiderAbsences.donnees ?? [],
    aValiderDemandes.donnees ?? [],
  );
  const chargement = aValiderAbsences.chargement || aValiderDemandes.chargement;
  const erreur = aValiderAbsences.erreur ?? aValiderDemandes.erreur;
  const elements = chargement ? null : versElementsAFaire(aTraiter);

  const tous = dossiersDe(toutesAbsences.donnees ?? [], toutesDemandes.donnees ?? []);
  const enCirculation = tous.filter((dossier) => dossier.statut === "EN_VALIDATION");
  const decides = tous.filter(
    (dossier) => dossier.statut === "APPROUVE" || dossier.statut === "REJETE",
  );
  const chargementRegistre = toutesAbsences.chargement || toutesDemandes.chargement;
  const erreurRegistre = toutesAbsences.erreur ?? toutesDemandes.erreur;

  return (
    <div className="dark relative -m-4 min-h-[calc(100svh-4rem)] rounded-3xl bg-background p-4 text-foreground md:-m-6 md:p-8">
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

      {erreur && (
        <div className="mb-4">
          <Alerte>{erreur}</Alerte>
        </div>
      )}

      <div className="space-y-5">
        {/* Rangee 1 : pile [Total + Urgent] a gauche, Resume etire a droite. */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:items-stretch">
          <div className="flex flex-col gap-5 lg:col-span-2">
            <Total elements={elements} />
            <Urgent elements={elements} />
          </div>
          <div className="lg:col-span-3">
            <Resume
              elements={elements}
              couleurParCode={COULEUR_PAR_CODE}
              groupes={GROUPES_DOSSIERS}
              titre="Résumé"
              sousTitre="Dossiers en attente de decision"
              messageVide="Rien a traiter pour le moment."
            />
          </div>
        </div>

        {/* Rangee 2 : A faire (large) a gauche, Mon espace plus etroit a droite. */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:items-stretch">
          <div className="lg:col-span-3">
            <AFaire elements={elements} couleurParCode={COULEUR_PAR_CODE} />
          </div>

          <div className="lg:col-span-2">
            <Carte titre="Mon espace" sousTitre="Vos propres demarches" className="h-full">
              <StatPrincipale
                libelle="Mon solde de conges"
                valeur={nombre(monSolde.donnees?.jours_restants, 1)}
                unite="jours"
                detail={`${nombre(monSolde.donnees?.jours_pris, 1)} pris`}
                icone={<Icone nom="conge" />}
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

        {/* Contenu reel sans equivalent dans le gabarit a 4 cartes : ce qui
            circule ailleurs, et l'historique recent des decisions. */}
        <div className="grid gap-5 lg:grid-cols-2">
          <Carte
            titre="Tout ce qui circule"
            sousTitre="Les demandes du personnel et qui peut encore se prononcer"
            actions={
              <Bouton taille="petite" variante="secondaire" onClick={() => router.push("/rh/validations")}>
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
              <Bouton taille="petite" variante="secondaire" onClick={() => router.push("/rh/historique")}>
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
      </div>
    </div>
  );
}

// --- Accueil du salarie ----------------------------------------------------

function versElementsAFaireSalarie(elements: Element[], nomPersonne: string): ElementAFaire[] {
  return elements.map((element) => ({
    cle: element.cle,
    code: element.code,
    app: element.code === "demande" ? "Demande" : element.code === "retard" ? "Retard" : "Conge",
    href: element.code === "demande" ? "/rh/mes-demandes" : "/rh/absences",
    titre: element.titre,
    sousTitre: element.etape ? `${element.detail} · en attente : ${element.etape}` : element.detail,
    personne: nomPersonne,
    etat: "a_valider",
  }));
}

function AccueilSalarie() {
  const { utilisateur } = useAuth();
  const router = useRouter();

  const solde = useRessource<SoldeConge>("/soldes-conges/mon-solde/");
  const absences = useListe<DemandeAbsence>("/demandes-absence/mes-demandes/");
  const demandes = useListe<Depense>("/depenses/mes-demandes/", { racine: "finance" });

  const chargement = absences.chargement || demandes.chargement;
  const erreur = absences.erreur ?? demandes.erreur;

  const enCours = elementsDe(absences.donnees ?? [], demandes.donnees ?? []).filter(
    (element) => element.statut === "EN_VALIDATION" || element.statut === "SOUMIS",
  );
  const nomPersonne = utilisateur?.nom_complet ?? "Vous";
  const elements = chargement ? null : versElementsAFaireSalarie(enCours, nomPersonne);

  const acquis =
    Number(solde.donnees?.jours_acquis ?? 0) + Number(solde.donnees?.jours_reportes ?? 0);

  return (
    <div className="dark relative -m-4 min-h-[calc(100svh-4rem)] rounded-3xl bg-background p-4 text-foreground md:-m-6 md:p-8">
      <EnTetePage
        titre={`Bonjour ${utilisateur?.nom_complet ?? ""}`.trim()}
        description="Vos demarches et le suivi de vos demandes."
      />

      {erreur && (
        <div className="mb-4">
          <Alerte>{erreur}</Alerte>
        </div>
      )}

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:items-stretch">
          <div className="flex flex-col gap-5 lg:col-span-2">
            <Total elements={elements} />
            <Urgent elements={elements} />
          </div>
          <div className="lg:col-span-3">
            <Resume
              elements={elements}
              couleurParCode={COULEUR_PAR_CODE}
              groupes={GROUPES_DOSSIERS}
              titre="Résumé"
              sousTitre="Vos demandes en attente d'une decision"
              messageVide="Aucune demande en cours."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:items-stretch">
          <div className="lg:col-span-3">
            <AFaire elements={elements} couleurParCode={COULEUR_PAR_CODE} />
          </div>

          <div className="lg:col-span-2">
            <Carte titre="Mon espace" sousTitre="Solde et actions rapides" className="h-full">
              <StatPrincipale
                libelle="Mon solde de conges"
                valeur={nombre(solde.donnees?.jours_restants, 1)}
                unite="jours"
                progression={{
                  valeur: Number(solde.donnees?.jours_pris ?? 0),
                  max: acquis || 1,
                }}
                detail={`${nombre(solde.donnees?.jours_pris, 1)} pris sur ${nombre(acquis, 1)} acquis`}
                icone={<Icone nom="conge" />}
              />
              <div className="mt-4 space-y-2">
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
            </Carte>
          </div>
        </div>
      </div>
    </div>
  );
}

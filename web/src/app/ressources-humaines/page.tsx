"use client";

/**
 * Module Ressources humaines.
 *
 * Quatre gestes, quatre onglets : poser un congé, demander une permission,
 * signaler un retard, et — pour ceux que ça concerne — trancher les dossiers
 * des autres.
 *
 * Congé et permission partagent le même modèle côté serveur mais pas le même
 * écran, et c'est délibéré : on ne demande pas une matinée d'absence comme on
 * pose trois semaines. Tant qu'ils vivaient au même endroit, les agents
 * posaient une journée entière pour un rendez-vous médical.
 */

import { useMemo, useState } from "react";

import { Coquille } from "@/composants/Coquille";
import {
  ActionsCirculation,
  BadgeStatut,
  CircuitValidation,
  Information,
} from "@/composants/metier";
import {
  Alerte,
  Bouton,
  Carte,
  Champ,
  Chargement,
  EnTetePage,
  EtatVide,
  Grille,
  LigneListe,
  ListeLignes,
  Modale,
  Onglets,
  Statistique,
  ZoneTexte,
} from "@/composants/ui";
import { GestionRessource } from "@/composants/ressource";
import { aujourdhui, date, heure, nombre } from "@/lib/format";
import { useAction, useListe, useRessource } from "@/lib/ressources";
import { useSession } from "@/lib/session";
import type { DemandeAbsence, SoldeConge, TypeAbsence } from "@/lib/types";

import * as sections from "./sections";

/** Le solde renvoyé pour un compte sans fiche d'agent porte ce drapeau. */
type SoldeEventuel = SoldeConge & { sans_fiche?: boolean };

/** Les onglets qui listent des demandes. Le service RH a les siens, plus bas. */
type Onglet = "conges" | "permissions" | "retards" | "a-valider";

/** Ce que le service RH administre pour toute l'entreprise. */
type OngletService = "presences" | "carriere" | "formation" | "referentiels";

const ONGLETS_SERVICE: { cle: OngletService; libelle: string }[] = [
  { cle: "presences", libelle: "Présences" },
  { cle: "carriere", libelle: "Évaluations" },
  { cle: "formation", libelle: "Formations" },
  { cle: "referentiels", libelle: "Référentiels" },
];

/** Libellés des types imposés, installés par `manage.py amorcer`. */
const TYPE_PERMISSION = "Permission";
const TYPE_RETARD = "Retard";

const ONGLETS: Record<
  Onglet,
  { libelle: string; categorie?: string; titre: string; description: string }
> = {
  conges: {
    libelle: "Mes congés",
    categorie: "CONGE",
    titre: "Mes congés",
    description: "Posez vos jours sur votre solde annuel.",
  },
  permissions: {
    libelle: "Mes permissions",
    categorie: "PERMISSION",
    titre: "Mes permissions",
    description:
      "Absentez-vous quelques heures ou quelques jours sans entamer votre solde.",
  },
  retards: {
    libelle: "Retards",
    categorie: "RETARD",
    titre: "Signaler un retard",
    description: "Prévenez d'une arrivée tardive. Le signalement reste consigné.",
  },
  "a-valider": {
    libelle: "À valider",
    titre: "Dossiers à traiter",
    description: "Les demandes qui attendent votre décision.",
  },
};

export default function PageRessourcesHumaines() {
  return (
    <Coquille>
      <Contenu />
    </Coquille>
  );
}

function Contenu() {
  const { profil } = useSession();
  const [onglet, setOnglet] = useState<Onglet | OngletService>("conges");
  const [formulaire, setFormulaire] = useState<{
    categorie: Onglet;
    demande?: DemandeAbsence;
  } | null>(null);
  const [selection, setSelection] = useState<DemandeAbsence | null>(null);

  const roles = profil?.habilitations.rh ?? [];
  const peutValider = roles.includes("gestionnaire") || roles.includes("direction");

  // Les onglets du service RH n'affichent pas de demandes : inutile d'aller
  // les chercher tant qu'on n'est pas revenu sur un onglet qui en montre.
  const ongletDemande: Onglet | null = onglet in ONGLETS ? (onglet as Onglet) : null;
  const config = ongletDemande ? ONGLETS[ongletDemande] : null;
  const chemin = !config
    ? null
    : onglet === "a-valider"
      ? "/rh/demandes-absence/a-valider"
      : `/rh/demandes-absence/par-categorie/${config.categorie}`;

  const demandes = useListe<DemandeAbsence>(chemin);
  const aValider = useListe<DemandeAbsence>("/rh/demandes-absence/a-valider");
  const solde = useRessource<SoldeEventuel>("/rh/soldes-conges/mon-solde");
  const types = useListe<TypeAbsence>("/rh/types-absence?actif=true&taille=100");

  const rafraichir = () => {
    void demandes.recharger();
    void aValider.recharger();
    void solde.recharger();
    setSelection(null);
  };

  // Retards et permissions ont leur propre écran : les proposer dans la liste
  // des congés ramènerait le demandeur sur un formulaire qui ne sait pas
  // saisir une heure d'arrivée.
  const typesDeConge = useMemo(
    () =>
      (types.donnees ?? []).filter(
        (type) => type.categorie !== "RETARD" && type.categorie !== "PERMISSION",
      ),
    [types.donnees],
  );

  const onglets = useMemo(() => {
    const liste: { cle: Onglet | OngletService; libelle: string; compteur?: number }[] = [
      { cle: "conges", libelle: ONGLETS.conges.libelle },
      { cle: "permissions", libelle: ONGLETS.permissions.libelle },
      { cle: "retards", libelle: ONGLETS.retards.libelle },
    ];
    const enAttente = aValider.donnees?.length ?? 0;
    if (peutValider || enAttente > 0) {
      liste.push({
        cle: "a-valider",
        libelle: ONGLETS["a-valider"].libelle,
        compteur: enAttente,
      });
    }
    if (peutValider) liste.push(...ONGLETS_SERVICE);
    return liste;
  }, [aValider.donnees, peutValider]);

  const acquis =
    Number(solde.donnees?.jours_acquis ?? 0) +
    Number(solde.donnees?.jours_reportes ?? 0);

  return (
    <>
      <EnTetePage
        titre="Ressources humaines"
        description="Congés, permissions, retards et suivi de vos demandes."
        actions={
          ongletDemande && ongletDemande !== "a-valider" ? (
            <Bouton onClick={() => setFormulaire({ categorie: ongletDemande })}>
              {onglet === "retards" ? "Signaler un retard" : "Nouvelle demande"}
            </Bouton>
          ) : null
        }
      />

      {solde.donnees?.sans_fiche ? (
        <div className="mb-6">
          <Alerte ton="avertissement" titre="Aucune fiche d'agent">
            Votre compte n&apos;est rattaché à aucune fiche dans
            l&apos;organigramme. Vous pouvez consulter les écrans, mais vous ne
            pourrez pas déposer de demande tant que les Ressources humaines ne
            vous auront pas inscrit à l&apos;annuaire.
          </Alerte>
        </div>
      ) : null}

      <div className="mb-6">
        <Grille colonnes={3}>
          <Statistique
            libelle="Mon solde de congés"
            valeur={nombre(solde.donnees?.jours_restants, 1)}
            unite="jours"
            detail={`${nombre(solde.donnees?.jours_pris, 1)} pris sur ${nombre(acquis, 1)} acquis`}
          />
          <Statistique
            libelle="En cours de validation"
            valeur={
              (demandes.donnees ?? []).filter(
                (demande) => demande.statut === "EN_VALIDATION",
              ).length
            }
            detail="Sur l'onglet courant"
            ton="alerte"
          />
          <Statistique
            libelle="À traiter par moi"
            valeur={aValider.donnees?.length ?? 0}
            detail="Dossiers attendant votre décision"
            ton={aValider.donnees?.length ? "alerte" : "succes"}
          />
        </Grille>
      </div>

      <Onglets onglets={onglets} actif={onglet} onChange={setOnglet} />

      {onglet === "presences" ? (
        <GestionRessource spec={sections.presences(peutValider)} />
      ) : null}

      {onglet === "carriere" ? (
        <div className="space-y-6">
          <GestionRessource spec={sections.campagnes(peutValider)} />
          <GestionRessource spec={sections.criteres(peutValider)} />
          <GestionRessource spec={sections.evaluations(peutValider)} />
        </div>
      ) : null}

      {onglet === "formation" ? (
        <div className="space-y-6">
          <GestionRessource spec={sections.formations(peutValider)} />
          <GestionRessource spec={sections.inscriptions(peutValider)} />
        </div>
      ) : null}

      {onglet === "referentiels" ? (
        <div className="space-y-6">
          <GestionRessource spec={sections.typesAbsence(peutValider)} />
          <GestionRessource spec={sections.soldes(peutValider)} />
          <GestionRessource spec={sections.circuits(peutValider)} />
        </div>
      ) : null}

      {config ? (
      <Carte titre={config.titre} sousTitre={config.description} sansPadding>
        <div className="px-4 sm:px-5">
          {demandes.chargement ? (
            <Chargement />
          ) : demandes.erreur ? (
            <div className="py-5">
              <Alerte>{demandes.erreur}</Alerte>
            </div>
          ) : !demandes.donnees?.length ? (
            <EtatVide
              titre={
                onglet === "a-valider"
                  ? "Rien à traiter"
                  : "Aucune demande pour l'instant"
              }
              description={
                onglet === "a-valider"
                  ? "Aucun dossier n'attend votre décision."
                  : "Vos demandes apparaîtront ici."
              }
              action={
                ongletDemande && ongletDemande !== "a-valider" ? (
                  <Bouton
                    taille="petite"
                    onClick={() => setFormulaire({ categorie: ongletDemande })}
                  >
                    Déposer une demande
                  </Bouton>
                ) : null
              }
            />
          ) : (
            <ListeLignes>
              {demandes.donnees.map((demande) => (
                <LigneListe
                  key={demande.id}
                  titre={
                    onglet === "a-valider"
                      ? `${demande.demandeur_nom} — ${demande.type_absence_libelle}`
                      : demande.type_absence_libelle
                  }
                  detail={
                    <>
                      {periode(demande)}
                      {demande.etape_courante_libelle
                        ? ` · en attente : ${demande.etape_courante_libelle}`
                        : ""}
                    </>
                  }
                  valeur={
                    demande.heure_debut
                      ? heure(demande.heure_debut)
                      : `${nombre(demande.nb_jours, 1)} j`
                  }
                  statut={
                    <BadgeStatut
                      statut={demande.statut}
                      libelle={demande.statut_libelle}
                    />
                  }
                  onClick={() => setSelection(demande)}
                />
              ))}
            </ListeLignes>
          )}
        </div>
      </Carte>
      ) : null}

      {formulaire ? (
        <FormulaireDemande
          key={formulaire.demande?.id ?? formulaire.categorie}
          categorie={formulaire.categorie}
          demande={formulaire.demande}
          types={typesDeConge}
          onFermer={() => setFormulaire(null)}
          onEnregistre={() => {
            setFormulaire(null);
            rafraichir();
          }}
        />
      ) : null}

      <Modale
        ouverte={selection !== null}
        titre={selection?.type_absence_libelle ?? ""}
        description={
          selection ? `${selection.numero} · ${selection.demandeur_nom}` : ""
        }
        large
        onFermer={() => setSelection(null)}
      >
        {selection ? (
          <div className="space-y-5">
            <Grille colonnes={2}>
              <Information libelle="Période" valeur={periode(selection)} />
              <Information
                libelle={selection.heure_debut ? "Horaire" : "Durée"}
                valeur={
                  selection.heure_debut
                    ? `${heure(selection.heure_debut)}${selection.heure_fin ? ` – ${heure(selection.heure_fin)}` : ""}`
                    : `${nombre(selection.nb_jours, 1)} jour(s)`
                }
              />
            </Grille>

            <Information
              libelle="Motif"
              valeur={<span className="whitespace-pre-line">{selection.motif}</span>}
            />

            {selection.statut === "REJETE" && selection.motif_rejet ? (
              <Alerte titre="Demande rejetée">{selection.motif_rejet}</Alerte>
            ) : null}

            <div>
              <p className="mb-3 text-xs uppercase tracking-wide text-ardoise-500">
                Circuit de validation
              </p>
              <CircuitValidation etapes={selection.etapes} />
            </div>

            <div className="border-t border-ardoise-200 pt-4 dark:border-ardoise-700">
              <ActionsCirculation
                ressource="/rh/demandes-absence"
                document={selection}
                onModifier={() => {
                  setFormulaire({
                    categorie: categorieVersOnglet(selection.categorie),
                    demande: selection,
                  });
                  setSelection(null);
                }}
                onChangement={rafraichir}
              />
            </div>
          </div>
        ) : null}
      </Modale>
    </>
  );
}

function periode(demande: DemandeAbsence): string {
  if (demande.date_debut === demande.date_fin) return date(demande.date_debut);
  return `${date(demande.date_debut)} → ${date(demande.date_fin)}`;
}

function categorieVersOnglet(categorie: string): Onglet {
  if (categorie === "PERMISSION") return "permissions";
  if (categorie === "RETARD") return "retards";
  return "conges";
}

/**
 * Le même formulaire dépose une demande et la corrige.
 *
 * Une correction n'est possible que tant qu'aucun responsable ne s'est
 * prononcé ; le serveur en juge et refuse le reste.
 */
function FormulaireDemande({
  categorie,
  demande,
  types,
  onFermer,
  onEnregistre,
}: {
  categorie: Onglet;
  demande?: DemandeAbsence;
  types: TypeAbsence[];
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const { requete } = useSession();
  const action = useAction();
  const correction = demande !== undefined;

  const typeImpose =
    categorie === "permissions"
      ? TYPE_PERMISSION
      : categorie === "retards"
        ? TYPE_RETARD
        : "";

  const [type, setType] = useState(
    demande?.type_absence_libelle ?? typeImpose,
  );
  const [debut, setDebut] = useState(demande?.date_debut ?? aujourdhui());
  const [fin, setFin] = useState(demande?.date_fin ?? aujourdhui());
  const [heureDebut, setHeureDebut] = useState(
    demande?.heure_debut?.slice(0, 5) ?? (categorie === "retards" ? "08:30" : ""),
  );
  const [heureFin, setHeureFin] = useState(demande?.heure_fin?.slice(0, 5) ?? "");
  const [motif, setMotif] = useState(demande?.motif ?? "");

  const typeChoisi = types.find(
    (candidat) => candidat.libelle.toLowerCase() === type.trim().toLowerCase(),
  );

  const envoyer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const succes = await action.executer(async () => {
      const corps = {
        type_absence: type,
        date_debut: debut,
        date_fin: categorie === "retards" ? debut : fin,
        heure_debut: heureDebut || null,
        heure_fin: heureFin || null,
        motif,
      };
      if (demande) {
        await requete(`/rh/demandes-absence/${demande.id}`, {
          methode: "PATCH",
          corps,
        });
        return;
      }
      const creee = await requete<DemandeAbsence>("/rh/demandes-absence", {
        methode: "POST",
        corps,
      });
      await requete(`/rh/demandes-absence/${creee.id}/soumettre`, {
        methode: "POST",
        corps: {},
      });
    });
    if (succes) onEnregistre();
  };

  const titres: Record<Onglet, string> = {
    conges: "Demander un congé",
    permissions: "Demander une permission",
    retards: "Signaler un retard",
    "a-valider": "",
  };

  return (
    <Modale
      ouverte
      titre={correction ? "Modifier la demande" : titres[categorie]}
      description={
        correction
          ? "Les valideurs verront la version corrigée."
          : "Votre responsable, puis les Ressources humaines, se prononceront."
      }
      onFermer={onFermer}
    >
      <form onSubmit={envoyer} className="space-y-4">
        {action.erreur ? <Alerte>{action.erreur}</Alerte> : null}

        {categorie === "conges" ? (
          <>
            <Champ
              libelle="Type"
              value={type}
              onChange={(evenement) => setType(evenement.target.value)}
              placeholder="Congé annuel, congé maladie, absence..."
              required
              liste={types.map((candidat) => candidat.libelle)}
              erreurs={action.champs.type_absence}
            />
            {typeChoisi ? (
              <p className="-mt-2 text-xs text-ardoise-500">
                {typeChoisi.decompte_solde
                  ? "Déduit de votre solde de congés."
                  : "N'entame pas votre solde."}
                {typeChoisi.duree_max_jours
                  ? ` Maximum ${typeChoisi.duree_max_jours} jours.`
                  : ""}
                {typeChoisi.justificatif_requis
                  ? " Justificatif obligatoire."
                  : ""}
              </p>
            ) : type.trim() ? (
              <p className="-mt-2 text-xs text-ardoise-500">
                Type inédit : il n'entamera pas votre solde tant que les
                Ressources humaines ne l'auront pas paramétré.
              </p>
            ) : null}
          </>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle={categorie === "retards" ? "Jour" : "Du"}
            type="date"
            value={debut}
            onChange={(evenement) => {
              setDebut(evenement.target.value);
              if (fin < evenement.target.value) setFin(evenement.target.value);
            }}
            required
            erreurs={action.champs.date_debut}
          />
          {categorie !== "retards" ? (
            <Champ
              libelle="Au"
              type="date"
              value={fin}
              min={debut}
              onChange={(evenement) => setFin(evenement.target.value)}
              required
              erreurs={action.champs.date_fin}
            />
          ) : (
            <Champ
              libelle="Heure d'arrivée"
              type="time"
              value={heureDebut}
              onChange={(evenement) => setHeureDebut(evenement.target.value)}
              required
              erreurs={action.champs.heure_debut}
            />
          )}
        </div>

        {categorie === "permissions" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ
                libelle="De (facultatif)"
                type="time"
                value={heureDebut}
                onChange={(evenement) => setHeureDebut(evenement.target.value)}
                erreurs={action.champs.heure_debut}
              />
              <Champ
                libelle="À (facultatif)"
                type="time"
                value={heureFin}
                onChange={(evenement) => setHeureFin(evenement.target.value)}
                erreurs={action.champs.heure_fin}
              />
            </div>
            <p className="-mt-2 text-xs text-ardoise-500">
              Laissez les horaires vides pour une absence sur la journée entière.
            </p>
          </>
        ) : null}

        <ZoneTexte
          libelle="Motif"
          value={motif}
          onChange={(evenement) => setMotif(evenement.target.value)}
          required
          erreurs={action.champs.motif}
          placeholder={
            categorie === "retards"
              ? "Embouteillage, panne de véhicule, rendez-vous médical..."
              : "Précisez la raison de votre demande"
          }
        />

        <div className="flex justify-end gap-2 border-t border-ardoise-200 pt-4 dark:border-ardoise-700">
          <Bouton type="button" variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton
            type="submit"
            chargement={action.enCours}
            disabled={!motif.trim() || !type.trim()}
          >
            {correction ? "Enregistrer" : "Envoyer"}
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}

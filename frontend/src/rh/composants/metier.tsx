"use client";

import { useState } from "react";

import { appelApi } from "@/rh/lib/api";
import { dateHeure } from "@/rh/lib/format";
import { useAction } from "@/rh/lib/hooks";
import type {
  DocumentCirculant,
  EtapeValidation,
  StatutDocument,
} from "@/rh/lib/types";

import { Alerte, Badge, Bouton, cx, Modale, ZoneTexte, type TonBadge } from "./ui";

const TONS_STATUT: Record<StatutDocument, TonBadge> = {
  BROUILLON: "neutre",
  SOUMIS: "info",
  EN_VALIDATION: "alerte",
  APPROUVE: "succes",
  REJETE: "danger",
  ANNULE: "neutre",
  CLOTURE: "marque",
};

export function BadgeStatut({
  statut,
  libelle,
}: {
  statut: StatutDocument;
  libelle?: string;
}) {
  return <Badge ton={TONS_STATUT[statut] ?? "neutre"}>{libelle ?? statut}</Badge>;
}

const TONS_DECISION: Record<EtapeValidation["decision"], string> = {
  EN_ATTENTE: "border-amber-300 bg-amber-50 text-amber-700",
  APPROUVE: "border-emerald-300 bg-emerald-50 text-emerald-700",
  REJETE: "border-rose-300 bg-rose-50 text-rose-700",
  IGNORE: "border-slate-200 bg-slate-50 text-slate-400",
};

/**
 * Une etape consultative rend un avis, elle ne tranche pas : un refus de sa
 * part doit se lire « avis defavorable », sinon le lecteur croit le dossier
 * rejete alors qu'il poursuit sa route vers celui qui decide.
 */
function apparenceEtape(etape: EtapeValidation) {
  const rejete = etape.decision === "REJETE";
  if (etape.avis_consultatif && (rejete || etape.decision === "APPROUVE")) {
    return {
      pastille: rejete
        ? "border-orange-300 bg-orange-50 text-orange-700"
        : TONS_DECISION.APPROUVE,
      symbole: rejete ? "!" : "✓",
      ton: rejete ? ("alerte" as const) : ("succes" as const),
      libelle: rejete ? "Avis defavorable" : "Avis favorable",
    };
  }
  return {
    pastille: TONS_DECISION[etape.decision],
    symbole:
      etape.decision === "APPROUVE"
        ? "✓"
        : etape.decision === "REJETE"
          ? "✕"
          : String(etape.ordre),
    ton:
      etape.decision === "APPROUVE"
        ? ("succes" as const)
        : etape.decision === "REJETE"
          ? ("danger" as const)
          : etape.decision === "IGNORE"
            ? ("neutre" as const)
            : ("alerte" as const),
    libelle: etape.decision_libelle,
  };
}

/** Frise verticale du circuit de validation par seuils. */
export function CircuitValidation({ etapes }: { etapes: EtapeValidation[] }) {
  if (!etapes.length) {
    return (
      <p className="text-sm text-slate-500">
        Aucun circuit genere : la demande n&apos;a pas encore ete soumise.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-6">
      {etapes.map((etape) => {
        const apparence = apparenceEtape(etape);
        return (
        <li key={etape.id} className="relative">
          <span
            className={cx(
              "absolute -left-[31px] flex size-5 items-center justify-center rounded-full border-2 text-[10px] font-bold",
              apparence.pastille,
            )}
          >
            {apparence.symbole}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-800">{etape.libelle}</p>
            <Badge ton={apparence.ton}>{apparence.libelle}</Badge>
            {etape.avis_consultatif && etape.decision === "EN_ATTENTE" && (
              <span className="text-xs text-slate-400">avis consultatif</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {etape.valideur_attendu_nom
              ? `Valideur : ${etape.valideur_attendu_nom}`
              : etape.role_valideur_libelle}
            {etape.date_decision && ` · ${dateHeure(etape.date_decision)}`}
            {etape.decide_par_nom && ` · par ${etape.decide_par_nom}`}
          </p>
          {etape.commentaire && (
            <p className="mt-1 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
              « {etape.commentaire} »
            </p>
          )}
        </li>
        );
      })}
    </ol>
  );
}

/**
 * Actions de circulation d'un document.
 *
 * Trois publics s'y croisent, et l'ordre des boutons suit la vie du dossier :
 * son auteur tant que personne ne s'est prononce (corriger, retirer), les
 * valideurs quand il circule, son auteur encore pour l'annuler une fois la
 * machine lancee.
 *
 * ``ressource`` est le prefixe REST du document, par exemple
 * ``/finance/requisitions``.
 */
export function ActionsCirculation({
  ressource,
  document,
  estDemandeur,
  peutDecider,
  onModifier,
  onChangement,
}: {
  ressource: string;
  document: DocumentCirculant;
  estDemandeur: boolean;
  peutDecider: boolean;
  /** Ouvre le formulaire de correction. Sans lui, seul le retrait est propose. */
  onModifier?: () => void;
  onChangement: () => void;
}) {
  const [modale, setModale] = useState<
    "valider" | "rejeter" | "supprimer" | null
  >(null);
  const [commentaire, setCommentaire] = useState("");
  const action = useAction();

  const appeler = async (chemin: string, corps?: unknown) => {
    const succes = await action.executer(() =>
      appelApi(`${ressource}/${document.id}/${chemin}/`, {
        methode: "POST",
        corps: corps ?? {},
      }),
    );
    if (succes) {
      setModale(null);
      setCommentaire("");
      onChangement();
    }
  };

  const supprimer = async () => {
    const succes = await action.executer(() =>
      appelApi(`${ressource}/${document.id}/`, { methode: "DELETE" }),
    );
    if (succes) {
      setModale(null);
      onChangement();
    }
  };

  const enBrouillon =
    document.statut === "BROUILLON" || document.statut === "REJETE";
  const enCirculation = document.statut === "EN_VALIDATION";
  /**
   * Le dossier est encore entre les mains de son auteur : aucun responsable
   * ne s'est prononce, il peut donc le corriger ou le retirer. C'est l'API
   * qui le dit — elle seule distingue une etape decidee d'une etape franchie
   * pour information.
   */
  const enMainPropre = estDemandeur && document.modifiable;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {estDemandeur && enBrouillon && (
          <Bouton
            taille="petite"
            chargement={action.enCours}
            onClick={() => void appeler("soumettre")}
          >
            Soumettre
          </Bouton>
        )}
        {enMainPropre && onModifier && (
          <Bouton taille="petite" variante="secondaire" onClick={onModifier}>
            Modifier
          </Bouton>
        )}
        {enMainPropre && (
          <Bouton
            taille="petite"
            variante="danger"
            onClick={() => setModale("supprimer")}
          >
            Supprimer
          </Bouton>
        )}
        {peutDecider && enCirculation && (
          <>
            <Bouton
              taille="petite"
              variante="succes"
              onClick={() => setModale("valider")}
            >
              Valider
            </Bouton>
            <Bouton
              taille="petite"
              variante="danger"
              onClick={() => setModale("rejeter")}
            >
              Rejeter
            </Bouton>
          </>
        )}
        {/* Une fois qu'un responsable s'est prononce, le dossier ne s'efface
            plus : il se retire, et le retrait reste consigne. */}
        {estDemandeur && enCirculation && !document.modifiable && (
          <Bouton
            taille="petite"
            variante="secondaire"
            chargement={action.enCours}
            onClick={() => void appeler("annuler")}
          >
            Annuler la demande
          </Bouton>
        )}
      </div>

      {estDemandeur && !document.modifiable && document.verrou_motif && (
        <p className="mt-2 text-xs text-slate-500">{document.verrou_motif}</p>
      )}

      {action.erreur && !modale && (
        <div className="mt-2">
          <Alerte>{action.erreur}</Alerte>
        </div>
      )}

      <Modale
        ouverte={modale === "supprimer"}
        titre="Supprimer la demande"
        description={document.numero}
        onFermer={() => setModale(null)}
      >
        <div className="space-y-4">
          {action.erreur && <Alerte>{action.erreur}</Alerte>}
          <p className="text-sm text-slate-600">
            La demande sera effacee, sans laisser de trace : personne ne s&apos;etant
            encore prononce, il n&apos;y a rien a conserver. Cette action est
            definitive.
          </p>
          <div className="flex justify-end gap-2">
            <Bouton variante="secondaire" onClick={() => setModale(null)}>
              Conserver
            </Bouton>
            <Bouton
              variante="danger"
              chargement={action.enCours}
              onClick={() => void supprimer()}
            >
              Supprimer definitivement
            </Bouton>
          </div>
        </div>
      </Modale>

      <Modale
        ouverte={modale === "valider" || modale === "rejeter"}
        titre={modale === "rejeter" ? "Rejeter la demande" : "Valider la demande"}
        description={
          modale === "rejeter"
            ? "Le motif est obligatoire et sera visible par le demandeur."
            : `Etape en cours : ${document.etape_courante_libelle || "—"}`
        }
        onFermer={() => setModale(null)}
      >
        <div className="space-y-4">
          {action.erreur && <Alerte>{action.erreur}</Alerte>}
          <ZoneTexte
            libelle={modale === "rejeter" ? "Motif du rejet" : "Commentaire (facultatif)"}
            value={commentaire}
            onChange={(evenement) => setCommentaire(evenement.target.value)}
            erreurs={action.champs.commentaire}
            placeholder={
              modale === "rejeter"
                ? "Ex. : justificatif manquant, montant a revoir..."
                : "Observation eventuelle"
            }
          />
          <div className="flex justify-end gap-2">
            <Bouton variante="secondaire" onClick={() => setModale(null)}>
              Annuler
            </Bouton>
            <Bouton
              variante={modale === "rejeter" ? "danger" : "succes"}
              chargement={action.enCours}
              onClick={() =>
                void appeler(modale === "rejeter" ? "rejeter" : "valider", {
                  commentaire,
                })
              }
            >
              Confirmer
            </Bouton>
          </div>
        </div>
      </Modale>
    </>
  );
}

/** Note sur 5 rendue sous forme d'etoiles, utilisee dans les evaluations. */
export function NoteEtoiles({ note }: { note: number | string | null }) {
  const valeur = Number(note ?? 0);
  if (!valeur) return <span className="text-xs text-slate-400">Non evalue</span>;
  return (
    <span className="inline-flex items-center gap-1" title={`${valeur} / 5`}>
      <span className="text-sm tabular-nums font-medium text-slate-700">
        {valeur.toFixed(2).replace(".", ",")}
      </span>
      <span className="text-xs text-amber-500">
        {"★".repeat(Math.round(valeur))}
        <span className="text-slate-200">{"★".repeat(5 - Math.round(valeur))}</span>
      </span>
    </span>
  );
}

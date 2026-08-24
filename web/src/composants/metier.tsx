"use client";

/**
 * Ce que tout document validable affiche, quel que soit le service.
 *
 * Le circuit, le statut, les actions : écrits une fois, réutilisés par les
 * congés, les dépenses, les missions et les bons de commande. C'est cette
 * uniformité qui fait qu'un valideur reconnaît un dossier au premier coup
 * d'œil, sans se demander de quelle application il vient.
 */

import { useState } from "react";

import { Alerte, Badge, Bouton, Modale, ZoneTexte, cx } from "@/composants/ui";
import { dateHeure } from "@/lib/format";
import { useAction } from "@/lib/ressources";
import { useSession } from "@/lib/session";
import type { DocumentValidable, Etape, Statut } from "@/lib/types";

const TONS_STATUT: Record<Statut, "neutre" | "succes" | "alerte" | "danger" | "info"> = {
  BROUILLON: "neutre",
  SOUMIS: "info",
  EN_VALIDATION: "alerte",
  APPROUVE: "succes",
  REJETE: "danger",
  ANNULE: "neutre",
  CLOTURE: "succes",
};

export function BadgeStatut({
  statut,
  libelle,
}: {
  statut: Statut;
  libelle?: string;
}) {
  return <Badge ton={TONS_STATUT[statut] ?? "neutre"}>{libelle ?? statut}</Badge>;
}

/**
 * Le circuit rendu lisible.
 *
 * Un agent doit pouvoir répondre seul à « où en est ma demande ? ». Afficher
 * la liste des étapes, qui est attendu et ce que chacun a décidé, supprime
 * l'essentiel des relances.
 */
export function CircuitValidation({ etapes }: { etapes: Etape[] }) {
  if (!etapes.length) {
    return (
      <p className="text-sm text-ardoise-500">
        Aucune étape : ce dossier a été approuvé sans circuit.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {etapes.map((etape) => {
        const attendu =
          etape.valideur_nom ||
          etape.valideur_identifiant ||
          (etape.role_valideur ? `rôle « ${etape.role_valideur} »` : "—");
        return (
          <li key={etape.id} className="flex gap-3">
            <span
              className={cx(
                "mt-1 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                etape.decision === "APPROUVE"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"
                  : etape.decision === "REJETE"
                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200"
                    : etape.decision === "IGNORE"
                      ? "bg-ardoise-100 text-ardoise-500 dark:bg-ardoise-700"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
              )}
            >
              {etape.ordre}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {etape.libelle}
                <Badge
                  ton={etape.nature === "DECISION" ? "info" : "neutre"}
                >
                  {etape.nature_libelle}
                </Badge>
              </p>
              <p className="text-xs text-ardoise-500">
                {etape.decision === "EN_ATTENTE" ? (
                  <>En attente de {attendu}</>
                ) : etape.decision === "IGNORE" ? (
                  <>Sans objet : le dossier a été tranché avant</>
                ) : (
                  <>
                    {etape.decision_libelle} par{" "}
                    {etape.decide_par_nom || etape.decide_par_identifiant || "—"}
                    {etape.date_decision ? ` · ${dateHeure(etape.date_decision)}` : ""}
                  </>
                )}
              </p>
              {etape.commentaire ? (
                <p className="mt-1 whitespace-pre-line rounded-md bg-ardoise-100 px-2 py-1 text-xs dark:bg-ardoise-700/50">
                  {etape.commentaire}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Les gestes possibles sur un dossier, et seulement ceux-là.
 *
 * L'interface ne devine rien : c'est l'API qui dit si le dossier est encore
 * modifiable (`modifiable`, `verrou_motif`), et le serveur qui refuse une
 * décision qui ne revient pas au demandeur. Ce composant se contente de ne pas
 * proposer ce qui sera refusé.
 */
export function ActionsCirculation({
  ressource,
  document,
  onModifier,
  onChangement,
}: {
  /** Chemin de la collection, par exemple `/rh/demandes-absence`. */
  ressource: string;
  document: DocumentValidable;
  onModifier?: () => void;
  onChangement: () => void;
}) {
  const { profil, requete } = useSession();
  const action = useAction();
  const [rejet, setRejet] = useState(false);
  const [motif, setMotif] = useState("");

  const moi = profil?.utilisateur.identifiant ?? "";
  const estDemandeur = document.demandeur_identifiant === moi;
  const enAttente = document.statut === "EN_VALIDATION";

  // Une étape en attente qui me revient : soit elle me nomme, soit elle vise
  // un rôle que je porte. Le serveur refera le calcul, on ne fait ici que
  // masquer un bouton qui échouerait.
  const mesEtapes = document.etapes.filter(
    (etape) =>
      etape.decision === "EN_ATTENTE" &&
      !estDemandeur &&
      (etape.valideur_identifiant === moi ||
        (!etape.valideur_identifiant &&
          Boolean(profil?.habilitations) &&
          Object.values(profil!.habilitations).some((roles) =>
            roles.includes(etape.role_valideur),
          ))),
  );

  const appeler = async (verbe: string, corps?: unknown) => {
    const succes = await action.executer(() =>
      requete(`${ressource}/${document.id}/${verbe}`, {
        methode: "POST",
        corps: corps ?? {},
      }),
    );
    if (succes) {
      setRejet(false);
      setMotif("");
      onChangement();
    }
  };

  return (
    <div className="space-y-3">
      {action.erreur ? <Alerte>{action.erreur}</Alerte> : null}

      {document.verrou_motif ? (
        <p className="text-xs text-ardoise-500">{document.verrou_motif}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {estDemandeur && document.statut === "BROUILLON" ? (
          <Bouton onClick={() => appeler("soumettre")} chargement={action.enCours}>
            Envoyer la demande
          </Bouton>
        ) : null}

        {estDemandeur && document.modifiable && onModifier ? (
          <Bouton variante="secondaire" onClick={onModifier}>
            Modifier
          </Bouton>
        ) : null}

        {estDemandeur &&
        !["APPROUVE", "CLOTURE", "ANNULE"].includes(document.statut) ? (
          <Bouton
            variante="discret"
            onClick={() => appeler("annuler")}
            chargement={action.enCours}
          >
            Retirer
          </Bouton>
        ) : null}

        {enAttente && mesEtapes.length > 0 ? (
          <>
            <Bouton onClick={() => appeler("valider")} chargement={action.enCours}>
              {mesEtapes.length > 1
                ? `Approuver (${mesEtapes.length} étapes)`
                : "Approuver"}
            </Bouton>
            <Bouton variante="danger" onClick={() => setRejet(true)}>
              Rejeter
            </Bouton>
          </>
        ) : null}
      </div>

      {mesEtapes.length > 1 ? (
        <p className="text-xs text-ardoise-500">
          Vous êtes attendu à plusieurs titres sur ce dossier : une seule
          décision les règle toutes, et chacune reste consignée.
        </p>
      ) : null}

      <Modale
        ouverte={rejet}
        titre="Rejeter ce dossier"
        description="Le motif est transmis au demandeur : il lui sert à corriger."
        onFermer={() => setRejet(false)}
      >
        <form
          onSubmit={(evenement) => {
            evenement.preventDefault();
            void appeler("rejeter", { commentaire: motif });
          }}
          className="space-y-4"
        >
          <ZoneTexte
            libelle="Motif du rejet"
            value={motif}
            onChange={(evenement) => setMotif(evenement.target.value)}
            required
            erreurs={action.champs.commentaire}
            placeholder="Expliquez ce qui doit être corrigé"
          />
          <div className="flex justify-end gap-2 border-t border-ardoise-200 pt-4 dark:border-ardoise-700">
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => setRejet(false)}
            >
              Annuler
            </Bouton>
            <Bouton
              type="submit"
              variante="danger"
              chargement={action.enCours}
              disabled={!motif.trim()}
            >
              Rejeter
            </Bouton>
          </div>
        </form>
      </Modale>
    </div>
  );
}

/** Une paire libellé / valeur, la brique de toutes les fiches. */
export function Information({
  libelle,
  valeur,
}: {
  libelle: string;
  valeur: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ardoise-500">{libelle}</p>
      <p className="mt-0.5 text-sm">{valeur}</p>
    </div>
  );
}

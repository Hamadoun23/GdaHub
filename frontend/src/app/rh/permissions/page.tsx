"use client";

import { useState } from "react";

import {
  ActionsCirculation,
  BadgeStatut,
  CircuitValidation,
} from "@/rh/composants/metier";
import {
  Alerte,
  Bouton,
  Carte,
  Champ,
  Chargement,
  EnTetePage,
  EtatVide,
  LigneListe,
  ListeLignes,
  Modale,
  ZoneTexte,
} from "@/rh/composants/ui";
import { appelApi } from "@/rh/lib/api";
import { useAuth } from "@/rh/lib/auth";
import { aujourdhui, date, heure, nombre } from "@/rh/lib/format";
import { useAction, useListe } from "@/rh/lib/hooks";
import type { DemandeAbsence } from "@/rh/lib/types";

/** Libelle du type d'absence installe par ``manage.py seed_configuration``. */
const TYPE_PERMISSION = "Permission";

/**
 * Demande de permission d'absence.
 *
 * Une permission n'est pas un conge : elle couvre un imprevu de quelques
 * heures ou de deux ou trois jours — un rendez-vous medical, une demarche
 * administrative, un evenement familial — et n'entame pas le solde annuel.
 * Elle a son ecran pour cette raison : tant qu'elle vivait dans « Mes
 * conges », un agent devait poser une journee entiere pour une matinee
 * d'absence.
 *
 * Le circuit de validation, lui, est le meme que pour un conge : responsable
 * puis Ressources Humaines. C'est le serveur qui l'applique, cet ecran ne fait
 * que deposer le dossier.
 */
export default function PagePermissions() {
  const { utilisateur } = useAuth();
  // `null` : aucun formulaire. Un objet sans `permission` : nouvelle demande.
  // Avec `permission` : correction de celle-ci.
  const [formulaire, setFormulaire] = useState<{
    permission?: DemandeAbsence;
  } | null>(null);
  const [selection, setSelection] = useState<DemandeAbsence | null>(null);
  const demandes = useListe<DemandeAbsence>("/rh/demandes-absence/mes-demandes/");

  const permissions = (demandes.donnees ?? []).filter(
    (demande) => demande.categorie === "PERMISSION",
  );

  const rafraichir = () => {
    void demandes.recharger();
    setSelection(null);
  };

  return (
    <>
      <EnTetePage
        titre="Mes permissions"
        description="Absentez-vous quelques heures ou quelques jours sans entamer votre solde de conges. La demande suit le meme circuit qu'un conge."
        actions={
          <Bouton onClick={() => setFormulaire({})}>Demander une permission</Bouton>
        }
      />

      <Carte sansPadding>
        <div className="px-4 sm:px-5">
          {demandes.chargement ? (
            <Chargement />
          ) : demandes.erreur ? (
            <div className="py-5">
              <Alerte>{demandes.erreur}</Alerte>
            </div>
          ) : permissions.length === 0 ? (
            <EtatVide
              titre="Aucune permission demandee"
              description="Vos demandes de permission apparaitront ici."
              action={
                <Bouton taille="petite" onClick={() => setFormulaire({})}>
                  Demander une permission
                </Bouton>
              }
            />
          ) : (
            <ListeLignes>
              {permissions.map((permission) => (
                <LigneListe
                  key={permission.id}
                  titre={periode(permission)}
                  detail={
                    permission.etape_courante_libelle
                      ? `En attente : ${permission.etape_courante_libelle}`
                      : permission.motif
                  }
                  valeur={plage(permission)}
                  statut={
                    <BadgeStatut
                      statut={permission.statut}
                      libelle={permission.statut_libelle}
                    />
                  }
                  onClick={() => setSelection(permission)}
                />
              ))}
            </ListeLignes>
          )}
        </div>
      </Carte>

      {formulaire && (
        // La cle remonte l'etat du formulaire a chaque ouverture : les champs
        // partent des valeurs de la demande corrigee, sans effet de bord.
        <FormulairePermission
          key={formulaire.permission?.id ?? "nouvelle"}
          permission={formulaire.permission}
          onFermer={() => setFormulaire(null)}
          onEnregistre={() => {
            setFormulaire(null);
            rafraichir();
          }}
        />
      )}

      <Modale
        ouverte={selection !== null}
        titre={selection ? `Permission du ${date(selection.date_debut)}` : ""}
        description={selection?.numero ?? ""}
        onFermer={() => setSelection(null)}
        large
      >
        {selection && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Information libelle="Periode" valeur={periode(selection)} />
              <Information
                libelle={selection.heure_debut ? "Horaire" : "Duree"}
                valeur={
                  selection.heure_debut
                    ? plage(selection)
                    : `${nombre(selection.nb_jours, 1)} jour(s)`
                }
              />
            </div>

            <div>
              <p className="etiquette">Motif</p>
              <p className="whitespace-pre-line text-sm text-slate-700">
                {selection.motif}
              </p>
            </div>

            {selection.statut === "REJETE" && selection.motif_rejet && (
              <Alerte titre="Permission refusee">{selection.motif_rejet}</Alerte>
            )}

            <div>
              <p className="etiquette mb-3">Circuit de validation</p>
              <CircuitValidation etapes={selection.etapes} />
            </div>

            <div className="border-t border-slate-100 pt-4">
              <ActionsCirculation
                ressource="/rh/demandes-absence"
                document={selection}
                estDemandeur={selection.demandeur === utilisateur?.id}
                peutDecider={false}
                onModifier={() => {
                  setFormulaire({ permission: selection });
                  setSelection(null);
                }}
                onChangement={rafraichir}
              />
            </div>
          </div>
        )}
      </Modale>
    </>
  );
}

/** « le 12/03 » pour une journee, « du 12/03 au 14/03 » au-dela. */
function periode(permission: DemandeAbsence): string {
  if (permission.date_debut === permission.date_fin) {
    return date(permission.date_debut);
  }
  return `${date(permission.date_debut)} → ${date(permission.date_fin)}`;
}

/** L'horaire quand il est precise, la duree en jours sinon. */
function plage(permission: DemandeAbsence): string {
  if (permission.heure_debut) {
    return permission.heure_fin
      ? `${heure(permission.heure_debut)} – ${heure(permission.heure_fin)}`
      : `a partir de ${heure(permission.heure_debut)}`;
  }
  return `${nombre(permission.nb_jours, 1)} j`;
}

function Information({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div>
      <p className="etiquette">{libelle}</p>
      <p className="text-sm text-slate-800">{valeur}</p>
    </div>
  );
}

/**
 * Le meme formulaire depose une permission et la corrige.
 *
 * Une correction n'est possible que tant qu'aucun responsable ne s'est
 * prononce ; le serveur en juge et refuse le reste. Elle ne repasse pas par la
 * soumission : le dossier circule deja.
 */
function FormulairePermission({
  permission,
  onFermer,
  onEnregistre,
}: {
  permission?: DemandeAbsence;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const action = useAction();
  const correction = permission !== undefined;
  const [dateDebut, setDateDebut] = useState(
    permission?.date_debut ?? aujourdhui(),
  );
  const [dateFin, setDateFin] = useState(permission?.date_fin ?? aujourdhui());
  const [heureDebut, setHeureDebut] = useState(
    permission?.heure_debut?.slice(0, 5) ?? "",
  );
  const [heureFin, setHeureFin] = useState(permission?.heure_fin?.slice(0, 5) ?? "");
  const [motif, setMotif] = useState(permission?.motif ?? "");
  const [justificatif, setJustificatif] = useState<File | null>(null);

  const envoyer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const succes = await action.executer(async () => {
      // Sans piece jointe, on envoie du JSON : c'est le seul moyen de vider un
      // horaire renseigne par erreur, un champ absent d'un FormData laissant
      // la valeur precedente en place.
      const corps = {
        type_absence: TYPE_PERMISSION,
        date_debut: dateDebut,
        date_fin: dateFin,
        heure_debut: heureDebut || null,
        heure_fin: heureFin || null,
        motif,
      };

      const charge = justificatif
        ? { fichiers: enFormData(corps, justificatif) }
        : { corps };

      if (permission) {
        await appelApi(`/rh/demandes-absence/${permission.id}/`, {
          methode: "PATCH",
          ...charge,
        });
        return;
      }

      const creee = await appelApi<DemandeAbsence>("/rh/demandes-absence/", {
        methode: "POST",
        ...charge,
      });
      await appelApi(`/rh/demandes-absence/${creee.id}/soumettre/`, {
        methode: "POST",
        corps: {},
      });
    });
    if (succes) onEnregistre();
  };

  return (
    <Modale
      ouverte
      titre={correction ? "Modifier la permission" : "Demander une permission"}
      description="Une permission n'entame pas votre solde de conges."
      onFermer={onFermer}
    >
      <form onSubmit={envoyer} className="space-y-4">
        {action.erreur && <Alerte>{action.erreur}</Alerte>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle="Du"
            type="date"
            value={dateDebut}
            onChange={(evenement) => {
              setDateDebut(evenement.target.value);
              // Le cas courant est une permission d'une journee : on suit la
              // date de debut tant que l'agent n'a pas fixe la fin lui-meme.
              if (dateFin < evenement.target.value) setDateFin(evenement.target.value);
            }}
            required
            erreurs={action.champs.date_debut}
          />
          <Champ
            libelle="Au"
            type="date"
            value={dateFin}
            min={dateDebut}
            onChange={(evenement) => setDateFin(evenement.target.value)}
            required
            erreurs={action.champs.date_fin}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle="De (facultatif)"
            type="time"
            value={heureDebut}
            onChange={(evenement) => setHeureDebut(evenement.target.value)}
            erreurs={action.champs.heure_debut}
          />
          <Champ
            libelle="A (facultatif)"
            type="time"
            value={heureFin}
            onChange={(evenement) => setHeureFin(evenement.target.value)}
            erreurs={action.champs.heure_fin}
          />
        </div>
        <p className="-mt-2 text-xs text-slate-500">
          Laissez les horaires vides pour une absence sur la journee entiere.
        </p>

        <ZoneTexte
          libelle="Motif"
          value={motif}
          onChange={(evenement) => setMotif(evenement.target.value)}
          required
          placeholder="Rendez-vous medical, demarche administrative, evenement familial..."
          erreurs={action.champs.motif}
        />

        <div>
          <span className="etiquette">Justificatif (facultatif)</span>
          <input
            type="file"
            onChange={(evenement) =>
              setJustificatif(evenement.target.files?.[0] ?? null)
            }
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          {action.champs.justificatif && (
            <p className="mt-1 text-xs text-rose-600">
              {action.champs.justificatif.join(" ")}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Bouton type="button" variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" chargement={action.enCours} disabled={!motif.trim()}>
            {correction ? "Enregistrer" : "Envoyer la demande"}
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}

/** Recompose la demande en multipart quand une piece est jointe. */
function enFormData(
  corps: Record<string, string | null>,
  justificatif: File,
): FormData {
  const donnees = new FormData();
  for (const [champ, valeur] of Object.entries(corps)) {
    // Un horaire vide n'est pas transmis : « » n'est pas une heure valide, et
    // le champ reste alors a sa valeur precedente, ce qui est le comportement
    // attendu lors d'une correction.
    if (valeur !== null) donnees.append(champ, valeur);
  }
  donnees.append("justificatif", justificatif);
  return donnees;
}

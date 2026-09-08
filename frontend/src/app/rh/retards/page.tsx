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
import { aujourdhui, date, heure } from "@/rh/lib/format";
import { useAction, useListe } from "@/rh/lib/hooks";
import type { DemandeAbsence } from "@/rh/lib/types";

/** Libelle du type d'absence installe par ``manage.py seed_configuration``. */
const TYPE_RETARD = "Retard";

/**
 * Signalement d'une arrivee tardive.
 *
 * Volontairement plus court qu'une demande de conge : le retard est un fait
 * du jour, pas une periode a negocier. Trois champs, et la journee est
 * pre-remplie.
 */
export default function PageRetards() {
  const { utilisateur } = useAuth();
  // `null` : aucun formulaire. Un objet sans `retard` : signalement. Avec
  // `retard` : correction de celui-ci.
  const [formulaire, setFormulaire] = useState<{ retard?: DemandeAbsence } | null>(
    null,
  );
  const [selection, setSelection] = useState<DemandeAbsence | null>(null);
  const demandes = useListe<DemandeAbsence>("/demandes-absence/mes-demandes/");

  const retards = (demandes.donnees ?? []).filter(
    (demande) => demande.categorie === "RETARD",
  );

  const rafraichir = () => {
    void demandes.recharger();
    setSelection(null);
  };

  return (
    <>
      <EnTetePage
        titre="Signaler un retard"
        description="Prevenez d'une arrivee tardive. Le signalement suit le meme circuit qu'une demande de conge et reste consigne."
        actions={
          <Bouton onClick={() => setFormulaire({})}>Signaler un retard</Bouton>
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
          ) : retards.length === 0 ? (
            <EtatVide
              titre="Aucun retard signale"
              description="Vos signalements apparaitront ici."
              action={
                <Bouton taille="petite" onClick={() => setFormulaire({})}>
                  Signaler un retard
                </Bouton>
              }
            />
          ) : (
            <ListeLignes>
              {retards.map((retard) => (
                <LigneListe
                  key={retard.id}
                  titre={date(retard.date_debut)}
                  detail={
                    retard.etape_courante_libelle
                      ? `En attente : ${retard.etape_courante_libelle}`
                      : retard.motif
                  }
                  valeur={retard.heure_debut ? heure(retard.heure_debut) : "—"}
                  statut={
                    <BadgeStatut
                      statut={retard.statut}
                      libelle={retard.statut_libelle}
                    />
                  }
                  onClick={() => setSelection(retard)}
                />
              ))}
            </ListeLignes>
          )}
        </div>
      </Carte>

      {formulaire && (
        // La cle remonte l'etat du formulaire a chaque ouverture : les champs
        // partent des valeurs du signalement corrige, sans effet de bord.
        <FormulaireRetard
          key={formulaire.retard?.id ?? "nouveau"}
          retard={formulaire.retard}
          onFermer={() => setFormulaire(null)}
          onEnregistre={() => {
            setFormulaire(null);
            rafraichir();
          }}
        />
      )}

      <Modale
        ouverte={selection !== null}
        titre={selection ? `Retard du ${date(selection.date_debut)}` : ""}
        description={selection?.numero ?? ""}
        onFermer={() => setSelection(null)}
        large
      >
        {selection && (
          <div className="space-y-5">
            <div>
              <p className="etiquette">Heure d&apos;arrivee</p>
              <p className="text-sm text-slate-800">
                {selection.heure_debut ? heure(selection.heure_debut) : "—"}
              </p>
            </div>
            <div>
              <p className="etiquette">Motif</p>
              <p className="whitespace-pre-line text-sm text-slate-700">
                {selection.motif}
              </p>
            </div>
            {selection.statut === "REJETE" && selection.motif_rejet && (
              <Alerte titre="Signalement rejete">{selection.motif_rejet}</Alerte>
            )}
            <div>
              <p className="etiquette mb-3">Circuit</p>
              <CircuitValidation etapes={selection.etapes} />
            </div>

            <div className="border-t border-slate-100 pt-4">
              <ActionsCirculation
                ressource="/demandes-absence"
                document={selection}
                estDemandeur={selection.demandeur === utilisateur?.id}
                peutDecider={false}
                onModifier={() => {
                  setFormulaire({ retard: selection });
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

/**
 * Le meme formulaire depose un signalement et le corrige.
 *
 * Une correction n'est possible que tant qu'aucun responsable ne s'est
 * prononce ; le serveur en juge et refuse le reste.
 */
function FormulaireRetard({
  retard,
  onFermer,
  onEnregistre,
}: {
  retard?: DemandeAbsence;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const action = useAction();
  const correction = retard !== undefined;
  const [jour, setJour] = useState(retard?.date_debut ?? aujourdhui());
  const [heureArrivee, setHeureArrivee] = useState(
    retard?.heure_debut?.slice(0, 5) ?? "08:30",
  );
  const [motif, setMotif] = useState(retard?.motif ?? "");

  const envoyer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const succes = await action.executer(async () => {
      const corps = {
        type_absence: TYPE_RETARD,
        date_debut: jour,
        date_fin: jour,
        heure_debut: heureArrivee,
        motif,
      };

      if (retard) {
        await appelApi(`/demandes-absence/${retard.id}/`, {
          methode: "PATCH",
          corps,
        });
        return;
      }

      const creee = await appelApi<DemandeAbsence>("/demandes-absence/", {
        methode: "POST",
        corps,
      });
      await appelApi(`/demandes-absence/${creee.id}/soumettre/`, {
        methode: "POST",
        corps: {},
      });
    });
    if (succes) onEnregistre();
  };

  return (
    <Modale
      ouverte
      titre={correction ? "Modifier le signalement" : "Signaler un retard"}
      description="Un retard n'entame pas votre solde de conges."
      onFermer={onFermer}
    >
      <form onSubmit={envoyer} className="space-y-4">
        {action.erreur && <Alerte>{action.erreur}</Alerte>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle="Jour"
            type="date"
            value={jour}
            onChange={(evenement) => setJour(evenement.target.value)}
            required
            erreurs={action.champs.date_debut}
          />
          <Champ
            libelle="Heure d'arrivee"
            type="time"
            value={heureArrivee}
            onChange={(evenement) => setHeureArrivee(evenement.target.value)}
            required
            erreurs={action.champs.heure_debut}
          />
        </div>

        <ZoneTexte
          libelle="Motif"
          value={motif}
          onChange={(evenement) => setMotif(evenement.target.value)}
          required
          placeholder="Embouteillage, panne de vehicule, rendez-vous medical..."
          erreurs={action.champs.motif}
        />

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Bouton type="button" variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" chargement={action.enCours} disabled={!motif.trim()}>
            {correction ? "Enregistrer" : "Envoyer le signalement"}
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}

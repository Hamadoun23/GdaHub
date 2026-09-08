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
import { aujourdhui, date, montant } from "@/rh/lib/format";
import { useAction, useListe } from "@/rh/lib/hooks";
import type { Depense } from "@/rh/lib/types";

/**
 * Guichet unique du salarie : une demande, quatre champs.
 *
 * Le demandeur n'a pas a choisir entre requisition, depense, mission ou
 * sortie de caisse — ces distinctions relevent de la comptabilite, pas de
 * celui qui exprime un besoin. La Finance reclasse ensuite si necessaire.
 */
export default function PageMesDemandes() {
  const { utilisateur } = useAuth();
  // `null` : aucun formulaire. Un objet sans `demande` : creation. Avec
  // `demande` : correction de celle-ci.
  const [formulaire, setFormulaire] = useState<{ demande?: Depense } | null>(null);
  const [selection, setSelection] = useState<Depense | null>(null);
  const demandes = useListe<Depense>("/depenses/mes-demandes/", { racine: "finance" });

  const rafraichir = () => {
    void demandes.recharger();
    setSelection(null);
  };

  return (
    <>
      <EnTetePage
        titre="Mes demandes"
        description="Exprimez un besoin a la Finance. Votre responsable, le service financier, les RH et la Direction se prononcent ensuite."
        actions={
          <Bouton onClick={() => setFormulaire({})}>Nouvelle demande</Bouton>
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
          ) : !demandes.donnees?.length ? (
            <EtatVide
              titre="Aucune demande"
              description="Vos demandes et leur avancement apparaitront ici."
              action={
                <Bouton taille="petite" onClick={() => setFormulaire({})}>
                  Nouvelle demande
                </Bouton>
              }
            />
          ) : (
            <ListeLignes>
              {demandes.donnees.map((demande) => (
                <LigneListe
                  key={demande.id}
                  titre={demande.libelle}
                  detail={
                    demande.etape_courante_libelle
                      ? `${date(demande.date_depense)} · en attente : ${demande.etape_courante_libelle}`
                      : date(demande.date_depense)
                  }
                  valeur={montant(demande.montant, demande.devise)}
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

      {formulaire && (
        // La cle remonte l'etat du formulaire a chaque ouverture : les champs
        // partent des valeurs de la demande corrigee, sans effet de bord.
        <FormulaireDemande
          key={formulaire.demande?.id ?? "nouvelle"}
          demande={formulaire.demande}
          onFermer={() => setFormulaire(null)}
          onEnregistre={() => {
            setFormulaire(null);
            rafraichir();
          }}
        />
      )}

      <Modale
        ouverte={selection !== null}
        titre={selection?.libelle ?? ""}
        description={selection ? selection.numero : ""}
        onFermer={() => setSelection(null)}
        large
      >
        {selection && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="etiquette">Montant</p>
                <p className="text-sm font-medium tabular-nums text-slate-900">
                  {montant(selection.montant, selection.devise)}
                </p>
              </div>
              <div>
                <p className="etiquette">Date</p>
                <p className="text-sm text-slate-800">{date(selection.date_depense)}</p>
              </div>
            </div>

            <div>
              <p className="etiquette">Motif</p>
              {selection.description ? (
                <p className="whitespace-pre-line text-sm text-slate-700">
                  {selection.description}
                </p>
              ) : (
                <p className="text-sm italic text-slate-400">Rien de precise.</p>
              )}
            </div>

            {selection.statut === "REJETE" && selection.motif_rejet && (
              <Alerte titre="Demande rejetee">{selection.motif_rejet}</Alerte>
            )}

            <div>
              <p className="etiquette mb-3">Circuit de validation</p>
              <CircuitValidation etapes={selection.etapes} />
            </div>

            <div className="border-t border-slate-100 pt-4">
              <ActionsCirculation
                ressource="/depenses"
                racine="finance"
                document={selection}
                estDemandeur={selection.demandeur === utilisateur?.id}
                peutDecider={false}
                onModifier={() => {
                  setFormulaire({ demande: selection });
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
 * Le meme formulaire depose une demande et la corrige.
 *
 * Une correction n'est possible que tant qu'aucun responsable ne s'est
 * prononce ; le serveur en juge et refuse le reste. Elle ne repasse pas par
 * la soumission : le dossier circule deja.
 */
function FormulaireDemande({
  demande,
  onFermer,
  onEnregistre,
}: {
  demande?: Depense;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const action = useAction();
  const correction = demande !== undefined;
  const [objet, setObjet] = useState(demande?.libelle ?? "");
  const [montantSaisi, setMontantSaisi] = useState(demande?.montant ?? "");
  const [dateSouhaitee, setDateSouhaitee] = useState(
    demande?.date_depense ?? aujourdhui(),
  );
  const [motif, setMotif] = useState(demande?.description ?? "");
  const [piece, setPiece] = useState<File | null>(null);

  const envoyer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const succes = await action.executer(async () => {
      const donnees = new FormData();
      donnees.append("libelle", objet);
      donnees.append("montant", montantSaisi);
      donnees.append("date_depense", dateSouhaitee);
      donnees.append("description", motif);
      // Sans nouveau fichier, on ne touche pas au champ : l'envoyer vide
      // effacerait la piece deja jointe.
      if (piece) donnees.append("piece_justificative", piece);

      if (demande) {
        await appelApi(`/depenses/${demande.id}/`, {
          methode: "PATCH",
          fichiers: donnees,
          racine: "finance",
        });
        return;
      }

      // La categorie comptable n'est pas demandee : le serveur applique la
      // categorie par defaut, que la Finance reclassera si besoin.
      const creee = await appelApi<Depense>("/depenses/", {
        methode: "POST",
        fichiers: donnees,
        racine: "finance",
      });
      await appelApi(`/depenses/${creee.id}/soumettre/`, {
        methode: "POST",
        corps: {},
        racine: "finance",
      });
    });
    if (succes) onEnregistre();
  };

  return (
    <Modale
      ouverte
      titre={correction ? "Modifier la demande" : "Nouvelle demande"}
      description={
        correction
          ? "Les valideurs verront la version corrigee ; le circuit est recalcule si le montant change."
          : "Votre responsable, la Finance, les RH puis la Direction se prononceront."
      }
      onFermer={onFermer}
    >
      <form onSubmit={envoyer} className="space-y-4">
        {action.erreur && <Alerte>{action.erreur}</Alerte>}

        <Champ
          libelle="Objet de la demande"
          value={objet}
          onChange={(evenement) => setObjet(evenement.target.value)}
          placeholder="Achat de cartouches d'encre"
          required
          erreurs={action.champs.libelle}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle="Montant (XOF)"
            type="number"
            min="0"
            step="1"
            value={montantSaisi}
            onChange={(evenement) => setMontantSaisi(evenement.target.value)}
            required
            erreurs={action.champs.montant}
          />
          <Champ
            libelle="Date souhaitee"
            type="date"
            value={dateSouhaitee}
            onChange={(evenement) => setDateSouhaitee(evenement.target.value)}
            required
            erreurs={action.champs.date_depense}
          />
        </div>

        <ZoneTexte
          libelle="Motif"
          value={motif}
          onChange={(evenement) => setMotif(evenement.target.value)}
          required
          placeholder="Expliquez le besoin en quelques lignes"
          erreurs={action.champs.description}
        />

        <div>
          <span className="etiquette">Piece jointe (facultatif)</span>
          <input
            type="file"
            onChange={(evenement) => setPiece(evenement.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Bouton type="button" variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton
            type="submit"
            chargement={action.enCours}
            disabled={!objet.trim() || !montantSaisi}
          >
            {correction ? "Enregistrer" : "Envoyer la demande"}
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}

"use client";

import { useMemo, useState } from "react";

import { ActionsCirculation, BadgeStatut, CircuitValidation } from "@/rh/composants/metier";
import {
  Alerte,
  Badge,
  Bouton,
  Carte,
  Champ,
  Chargement,
  EnTetePage,
  EtatVide,
  LigneListe,
  ListeLignes,
  Modale,
  Onglets,
  StatPrincipale,
  ZoneTexte,
} from "@/rh/composants/ui";
import { appelApi } from "@/rh/lib/api";
import { useAuth } from "@/rh/lib/auth";
import { aujourdhui, date, nombre } from "@/rh/lib/format";
import { useAction, useListe, useRessource } from "@/rh/lib/hooks";
import type { DemandeAbsence, SoldeConge, TypeAbsence } from "@/rh/lib/types";

type Onglet = "mes-demandes" | "a-valider" | "toutes";

const CHEMINS: Record<Onglet, string> = {
  "mes-demandes": "/rh/demandes-absence/mes-demandes/",
  "a-valider": "/rh/demandes-absence/a-valider/",
  toutes: "/rh/demandes-absence/",
};

export default function PageAbsences() {
  const { utilisateur, estRH } = useAuth();
  const [onglet, setOnglet] = useState<Onglet>("mes-demandes");
  // `null` : aucun formulaire. Un objet sans `demande` : creation. Avec
  // `demande` : correction de celle-ci.
  const [formulaire, setFormulaire] = useState<{ demande?: DemandeAbsence } | null>(
    null,
  );
  const [selection, setSelection] = useState<DemandeAbsence | null>(null);

  const types = useListe<TypeAbsence>("/rh/types-absence/?actif=true");
  const solde = useRessource<SoldeConge>("/rh/soldes-conges/mon-solde/");
  const demandes = useListe<DemandeAbsence>(CHEMINS[onglet]);
  const aValider = useListe<DemandeAbsence>(CHEMINS["a-valider"]);

  const rafraichir = () => {
    void demandes.recharger();
    void aValider.recharger();
    void solde.recharger();
    setSelection(null);
  };

  const peutValider = estRH || Boolean(utilisateur?.est_encadrant);

  const onglets = useMemo(() => {
    const liste: { cle: Onglet; libelle: string; compteur?: number }[] = [
      { cle: "mes-demandes", libelle: "Mes demandes" },
    ];
    if (peutValider) {
      liste.push({
        cle: "a-valider",
        libelle: "A valider",
        compteur: aValider.donnees?.length ?? 0,
      });
    }
    if (estRH) liste.push({ cle: "toutes", libelle: "Toutes" });
    return liste;
  }, [aValider.donnees, estRH, peutValider]);

  // Retards et permissions ont chacun leur ecran, avec leurs champs propres :
  // les proposer ici ramenerait le demandeur sur un formulaire qui ne sait pas
  // saisir une heure d'arrivee ni une plage horaire.
  const typesProposes = useMemo(
    () =>
      (types.donnees ?? []).filter(
        (type) => type.categorie !== "RETARD" && type.categorie !== "PERMISSION",
      ),
    [types.donnees],
  );

  const acquis =
    Number(solde.donnees?.jours_acquis ?? 0) + Number(solde.donnees?.jours_reportes ?? 0);
  const afficherAgent = onglet !== "mes-demandes";

  return (
    <>
      <EnTetePage
        titre={estRH ? "Conges et absences" : "Mes conges"}
        description={
          estRH
            ? "Instruisez les demandes du personnel et suivez les soldes."
            : "Posez vos jours de conge ou signalez une absence. Une permission se demande depuis « Mes permissions »."
        }
        actions={
          <Bouton onClick={() => setFormulaire({})}>Nouvelle demande</Bouton>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
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
        {peutValider && (
          <div className="sm:col-span-2">
            <Carte titre="A traiter">
              {aValider.donnees?.length ? (
                <p className="text-sm text-slate-600">
                  <span className="text-2xl font-semibold text-amber-700">
                    {aValider.donnees.length}
                  </span>{" "}
                  demande(s) attendent votre decision. Elles restent bloquees tant
                  qu&apos;elles ne sont pas traitees.
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  Aucune demande en attente de votre decision.
                </p>
              )}
            </Carte>
          </div>
        )}
      </div>

      {onglets.length > 1 && (
        <Onglets onglets={onglets} actif={onglet} onChange={setOnglet} />
      )}

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
              description={
                onglet === "mes-demandes"
                  ? "Vos demandes de conge apparaitront ici."
                  : "Rien a traiter pour le moment."
              }
            />
          ) : (
            <ListeLignes>
              {demandes.donnees.map((demande) => (
                <LigneListe
                  key={demande.id}
                  titre={
                    afficherAgent
                      ? `${demande.demandeur_nom} — ${demande.type_absence_libelle}`
                      : demande.type_absence_libelle
                  }
                  detail={
                    <>
                      {date(demande.date_debut)} → {date(demande.date_fin)}
                      {demande.etape_courante_libelle &&
                        ` · en attente : ${demande.etape_courante_libelle}`}
                    </>
                  }
                  valeur={`${nombre(demande.nb_jours, 1)} j`}
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
          types={typesProposes}
          onFermer={() => setFormulaire(null)}
          onEnregistre={() => {
            setFormulaire(null);
            rafraichir();
          }}
        />
      )}

      <Modale
        ouverte={selection !== null}
        titre={selection?.type_absence_libelle ?? ""}
        description={selection ? `${selection.numero} · ${selection.demandeur_nom}` : ""}
        onFermer={() => setSelection(null)}
        large
      >
        {selection && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Information
                libelle="Periode"
                valeur={`${date(selection.date_debut)} → ${date(selection.date_fin)}`}
              />
              <Information
                libelle="Duree"
                valeur={`${nombre(selection.nb_jours, 1)} jour(s)`}
              />
            </div>

            <div>
              <p className="etiquette">Motif</p>
              <p className="text-sm text-slate-700">{selection.motif}</p>
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
                ressource="/rh/demandes-absence"
                document={selection}
                estDemandeur={selection.demandeur === utilisateur?.id}
                peutDecider={(aValider.donnees ?? []).some(
                  (demande) => demande.id === selection.id,
                )}
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

function Information({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div>
      <p className="etiquette">{libelle}</p>
      <p className="text-sm text-slate-800">{valeur}</p>
    </div>
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
  types,
  onFermer,
  onEnregistre,
}: {
  demande?: DemandeAbsence;
  types: TypeAbsence[];
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const action = useAction();
  const correction = demande !== undefined;
  const [typeAbsence, setTypeAbsence] = useState(
    demande?.type_absence_libelle ?? "",
  );
  const [dateDebut, setDateDebut] = useState(demande?.date_debut ?? aujourdhui());
  const [dateFin, setDateFin] = useState(demande?.date_fin ?? aujourdhui());
  const [motif, setMotif] = useState(demande?.motif ?? "");
  const [justificatif, setJustificatif] = useState<File | null>(null);

  // Le type est saisi en clair. S'il correspond a un type deja parametre, on
  // en rappelle les regles au demandeur avant qu'il n'envoie.
  const typeChoisi = types.find(
    (type) => type.libelle.toLowerCase() === typeAbsence.trim().toLowerCase(),
  );

  const envoyer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const succes = await action.executer(async () => {
      const donnees = new FormData();
      donnees.append("type_absence", typeAbsence);
      donnees.append("date_debut", dateDebut);
      donnees.append("date_fin", dateFin);
      donnees.append("motif", motif);
      // Sans nouveau fichier, on ne touche pas au champ : l'envoyer vide
      // effacerait le justificatif deja joint.
      if (justificatif) donnees.append("justificatif", justificatif);

      if (demande) {
        await appelApi(`/rh/demandes-absence/${demande.id}/`, {
          methode: "PATCH",
          fichiers: donnees,
        });
        return;
      }

      const creee = await appelApi<DemandeAbsence>("/rh/demandes-absence/", {
        methode: "POST",
        fichiers: donnees,
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
      titre={correction ? "Modifier la demande" : "Nouvelle demande"}
      description={
        correction
          ? "Les valideurs verront la version corrigee."
          : "Votre responsable puis les Ressources Humaines valideront la demande."
      }
      onFermer={onFermer}
    >
      <form onSubmit={envoyer} className="space-y-4">
        {action.erreur && <Alerte>{action.erreur}</Alerte>}

        <Champ
          libelle="Type"
          value={typeAbsence}
          onChange={(evenement) => setTypeAbsence(evenement.target.value)}
          placeholder="Conge annuel, conge maladie, absence..."
          required
          erreurs={action.champs.type_absence}
          liste={types.map((type) => type.libelle)}
        />

        {typeChoisi ? (
          <div className="flex flex-wrap gap-1.5">
            <Badge ton={typeChoisi.decompte_solde ? "alerte" : "succes"}>
              {typeChoisi.decompte_solde
                ? "Deduit du solde de conges"
                : "N'entame pas le solde"}
            </Badge>
            {typeChoisi.duree_max_jours && (
              <Badge>Maximum {typeChoisi.duree_max_jours} jours</Badge>
            )}
            {typeChoisi.justificatif_requis && (
              <Badge ton="danger">Justificatif obligatoire</Badge>
            )}
          </div>
        ) : (
          typeAbsence.trim() !== "" && (
            <p className="text-xs text-slate-500">
              Type inedit : il n&apos;entamera pas votre solde tant que les
              Ressources Humaines ne l&apos;auront pas parametre.
            </p>
          )
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle="Du"
            type="date"
            value={dateDebut}
            onChange={(evenement) => setDateDebut(evenement.target.value)}
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

        <ZoneTexte
          libelle="Motif"
          value={motif}
          onChange={(evenement) => setMotif(evenement.target.value)}
          required
          erreurs={action.champs.motif}
          placeholder="Precisez la raison de votre demande"
        />

        {/* Toujours propose : un type saisi librement ne porte aucune regle,
            mais rien n'empeche d'y joindre une piece. */}
        <div>
          <span className="etiquette">
            Justificatif
            {typeChoisi?.justificatif_requis ? " (obligatoire)" : " (facultatif)"}
          </span>
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
          <Bouton
            type="submit"
            chargement={action.enCours}
            disabled={!typeAbsence.trim()}
          >
            {correction ? "Enregistrer" : "Envoyer la demande"}
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}

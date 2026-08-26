"use client";

/**
 * Module Finance.
 *
 * Trois gestes qui couvrent l'essentiel du quotidien — engager une dépense,
 * exprimer un besoin, demander un ordre de mission — plus la caisse et la file
 * de validation. Le reste du domaine (consultations fournisseurs, bons de
 * commande, forfaits) relève du service financier et vit dans ses propres
 * écrans.
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
  Selection,
  Statistique,
  ZoneTexte,
} from "@/composants/ui";
import { GestionRessource } from "@/composants/ressource";
import { aujourdhui, date, montant } from "@/lib/format";
import { useAction, useListe, useRessource } from "@/lib/ressources";
import { useSession } from "@/lib/session";
import type {
  Caisse,
  CategorieDepense,
  Depense,
  DocumentValidable,
  Fournisseur,
  Mission,
  Requisition,
} from "@/lib/types";

import * as sections from "./sections";

type Onglet =
  | "depenses"
  | "requisitions"
  | "missions"
  | "achats"
  | "caisses"
  | "communication"
  | "referentiels"
  | "a-valider";

type TableauFinance = {
  mes_demandes_en_cours: number;
  mes_depenses_du_mois: string;
  depenses_du_mois?: string;
  a_traiter?: number;
  caisses_sous_alerte?: number;
};

export default function PageFinance() {
  return (
    <Coquille>
      <Contenu />
    </Coquille>
  );
}

function Contenu() {
  const { profil } = useSession();
  const [onglet, setOnglet] = useState<Onglet>("depenses");
  const [selection, setSelection] = useState<DocumentValidable | null>(null);
  const [formulaire, setFormulaire] = useState<
    "depenses" | "requisitions" | "missions" | null
  >(null);

  const roles = profil?.habilitations.finance ?? [];
  const estFinancier = roles.includes("gestionnaire") || roles.includes("direction");

  const tableau = useRessource<TableauFinance>("/finance/tableau-de-bord");
  const depenses = useListe<Depense>(
    onglet === "depenses" ? "/finance/depenses?taille=100" : null,
  );
  const requisitions = useListe<Requisition>(
    onglet === "requisitions" ? "/finance/requisitions?taille=100" : null,
  );
  const missions = useListe<Mission>(
    onglet === "missions" ? "/finance/missions?taille=100" : null,
  );
  const caisses = useListe<Caisse>(
    onglet === "caisses" ? "/finance/caisses?taille=100" : null,
  );
  const aValider = useListe<Depense>("/finance/depenses/a-valider");

  const categories = useListe<CategorieDepense>(
    "/finance/categories?actif=true&taille=100",
  );
  const fournisseurs = useListe<Fournisseur>(
    "/finance/fournisseurs?actif=true&taille=200",
  );

  const rafraichir = () => {
    void depenses.recharger();
    void requisitions.recharger();
    void missions.recharger();
    void caisses.recharger();
    void aValider.recharger();
    void tableau.recharger();
    setSelection(null);
  };

  const onglets = useMemo(() => {
    const liste: { cle: Onglet; libelle: string; compteur?: number }[] = [
      { cle: "depenses", libelle: "Dépenses" },
      { cle: "requisitions", libelle: "Réquisitions" },
      { cle: "missions", libelle: "Missions" },
    ];
    if (estFinancier) {
      liste.push({ cle: "achats", libelle: "Achats" });
      liste.push({ cle: "caisses", libelle: "Caisses" });
      liste.push({ cle: "communication", libelle: "Communication" });
      liste.push({ cle: "referentiels", libelle: "Référentiels" });
    }
    liste.push({
      cle: "a-valider",
      libelle: "À valider",
      compteur: aValider.donnees?.length ?? 0,
    });
    return liste;
  }, [aValider.donnees, estFinancier]);

  return (
    <>
      <EnTetePage
        titre="Finance"
        description="Dépenses, réquisitions, missions et caisse."
        actions={
          onglet === "depenses" || onglet === "requisitions" || onglet === "missions" ? (
            <Bouton onClick={() => setFormulaire(onglet)}>Nouvelle demande</Bouton>
          ) : null
        }
      />

      <div className="mb-6">
        <Grille colonnes={estFinancier ? 4 : 2}>
          <Statistique
            libelle="Mes demandes en cours"
            valeur={tableau.donnees?.mes_demandes_en_cours ?? 0}
            ton={tableau.donnees?.mes_demandes_en_cours ? "alerte" : "succes"}
          />
          <Statistique
            libelle="Mes dépenses du mois"
            valeur={montant(tableau.donnees?.mes_depenses_du_mois)}
            detail="Approuvées"
          />
          {estFinancier ? (
            <>
              <Statistique
                libelle="Dépenses du groupe"
                valeur={montant(tableau.donnees?.depenses_du_mois)}
                detail="Ce mois-ci, approuvées"
              />
              <Statistique
                libelle="Caisses sous alerte"
                valeur={tableau.donnees?.caisses_sous_alerte ?? 0}
                ton={tableau.donnees?.caisses_sous_alerte ? "alerte" : "succes"}
                detail="À réapprovisionner"
              />
            </>
          ) : null}
        </Grille>
      </div>

      <Onglets onglets={onglets} actif={onglet} onChange={setOnglet} />

      {onglet === "depenses" ? (
        <ListeDocuments
          etat={depenses}
          vide="Aucune dépense enregistrée."
          ligne={(document) => ({
            titre: document.libelle,
            detail: `${document.categorie_libelle} · ${date(document.date_depense)}`,
            valeur: montant(document.montant, document.devise),
          })}
          onSelection={setSelection}
        />
      ) : null}

      {onglet === "requisitions" ? (
        <ListeDocuments
          etat={requisitions}
          vide="Aucune réquisition."
          ligne={(document) => ({
            titre: document.objet,
            detail: `${document.priorite_libelle} · ${document.lignes.length} ligne(s)`,
            valeur: montant(document.montant, document.devise),
          })}
          onSelection={setSelection}
        />
      ) : null}

      {onglet === "missions" ? (
        <ListeDocuments
          etat={missions}
          vide="Aucune mission."
          ligne={(document) => ({
            titre: `${document.objet} — ${document.destination}`,
            detail: `${date(document.date_depart)} → ${date(document.date_retour)} · ${document.nb_jours} j`,
            valeur: montant(document.montant, document.devise),
          })}
          onSelection={setSelection}
        />
      ) : null}

      {onglet === "a-valider" ? (
        <ListeDocuments
          etat={aValider}
          vide="Aucun dossier n'attend votre décision."
          ligne={(document) => ({
            titre: `${document.demandeur_nom} — ${document.libelle}`,
            detail: document.etape_courante_libelle,
            valeur: montant(document.montant, document.devise),
          })}
          onSelection={setSelection}
        />
      ) : null}

      {onglet === "achats" ? (
        <div className="space-y-6">
          <GestionRessource spec={sections.demandesPrix(estFinancier)} />
          <GestionRessource spec={sections.offres(estFinancier)} />
          <GestionRessource spec={sections.bonsCommande(estFinancier)} />
          <GestionRessource spec={sections.prestations(estFinancier)} />
        </div>
      ) : null}

      {onglet === "caisses" ? (
        <div className="space-y-6">
          <GestionRessource spec={sections.caisses(estFinancier)} />
          <GestionRessource spec={sections.approvisionnements(estFinancier)} />
          <GestionRessource spec={sections.sortiesCaisse(estFinancier)} />
        </div>
      ) : null}

      {onglet === "communication" ? (
        <div className="space-y-6">
          <GestionRessource spec={sections.forfaits(estFinancier)} />
          <GestionRessource spec={sections.consommations(estFinancier)} />
        </div>
      ) : null}

      {onglet === "referentiels" ? (
        <div className="space-y-6">
          <GestionRessource spec={sections.fournisseurs(estFinancier)} />
          <GestionRessource spec={sections.categories(estFinancier)} />
          <GestionRessource spec={sections.baremes(estFinancier)} />
          <GestionRessource spec={sections.circuits(estFinancier)} />
        </div>
      ) : null}

      <Modale
        ouverte={selection !== null}
        titre={selection?.numero ?? ""}
        description={selection?.demandeur_nom}
        large
        onFermer={() => setSelection(null)}
      >
        {selection ? (
          <div className="space-y-5">
            <Grille colonnes={2}>
              <Information
                libelle="Statut"
                valeur={
                  <BadgeStatut
                    statut={selection.statut}
                    libelle={selection.statut_libelle}
                  />
                }
              />
              <Information
                libelle="Département"
                valeur={selection.demandeur_departement_nom || "—"}
              />
            </Grille>

            {selection.statut === "REJETE" && selection.motif_rejet ? (
              <Alerte titre="Dossier rejeté">{selection.motif_rejet}</Alerte>
            ) : null}

            <div>
              <p className="mb-3 text-xs uppercase tracking-wide text-ardoise-500">
                Circuit de validation
              </p>
              <CircuitValidation etapes={selection.etapes} />
            </div>

            <div className="border-t border-ardoise-200 pt-4 dark:border-ardoise-700">
              <ActionsCirculation
                ressource={ressourceDe(onglet)}
                document={selection}
                onChangement={rafraichir}
              />
            </div>
          </div>
        ) : null}
      </Modale>

      {formulaire ? (
        <FormulaireDemande
          nature={formulaire}
          categories={categories.donnees ?? []}
          fournisseurs={fournisseurs.donnees ?? []}
          onFermer={() => setFormulaire(null)}
          onEnregistre={() => {
            setFormulaire(null);
            rafraichir();
          }}
        />
      ) : null}
    </>
  );
}

function ressourceDe(onglet: Onglet): string {
  if (onglet === "requisitions") return "/finance/requisitions";
  if (onglet === "missions") return "/finance/missions";
  return "/finance/depenses";
}

function ListeDocuments<T extends DocumentValidable>({
  etat,
  vide,
  ligne,
  onSelection,
}: {
  etat: {
    donnees: T[] | null;
    chargement: boolean;
    erreur: string;
  };
  vide: string;
  ligne: (document: T) => {
    titre: string;
    detail: string;
    valeur: string;
  };
  onSelection: (document: T) => void;
}) {
  return (
    <Carte sansPadding>
      <div className="px-4 sm:px-5">
        {etat.chargement ? (
          <Chargement />
        ) : etat.erreur ? (
          <div className="py-5">
            <Alerte>{etat.erreur}</Alerte>
          </div>
        ) : !etat.donnees?.length ? (
          <EtatVide titre="Rien à afficher" description={vide} />
        ) : (
          <ListeLignes>
            {etat.donnees.map((document) => {
              const contenu = ligne(document);
              return (
                <LigneListe
                  key={document.id}
                  titre={contenu.titre}
                  detail={contenu.detail}
                  valeur={contenu.valeur}
                  statut={
                    <BadgeStatut
                      statut={document.statut}
                      libelle={document.statut_libelle}
                    />
                  }
                  onClick={() => onSelection(document)}
                />
              );
            })}
          </ListeLignes>
        )}
      </div>
    </Carte>
  );
}

/** Un formulaire par nature de demande : les champs n'ont rien en commun. */
function FormulaireDemande({
  nature,
  categories,
  fournisseurs,
  onFermer,
  onEnregistre,
}: {
  nature: "depenses" | "requisitions" | "missions";
  categories: CategorieDepense[];
  fournisseurs: Fournisseur[];
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const { requete } = useSession();
  const action = useAction();
  const [valeurs, setValeurs] = useState<Record<string, string>>({
    libelle: "",
    objet: "",
    description: "",
    montant: "",
    date_depense: aujourdhui(),
    categorie: categories[0] ? String(categories[0].id) : "",
    fournisseur: "",
    mode_paiement: "VIREMENT",
    justification: "",
    priorite: "NORMALE",
    destination: "",
    zone: "NATIONALE",
    date_depart: aujourdhui(),
    date_retour: aujourdhui(),
  });

  const modifier = (champ: string, valeur: string) =>
    setValeurs((precedent) => ({ ...precedent, [champ]: valeur }));

  const chemin = ressourceDe(nature);

  const corpsDe = () => {
    if (nature === "requisitions") {
      return {
        objet: valeurs.objet,
        justification: valeurs.justification,
        priorite: valeurs.priorite,
      };
    }
    if (nature === "missions") {
      return {
        objet: valeurs.objet,
        destination: valeurs.destination,
        zone: valeurs.zone,
        date_depart: valeurs.date_depart,
        date_retour: valeurs.date_retour,
      };
    }
    return {
      libelle: valeurs.libelle,
      description: valeurs.description,
      montant: valeurs.montant || "0",
      date_depense: valeurs.date_depense,
      categorie: Number(valeurs.categorie),
      fournisseur: valeurs.fournisseur ? Number(valeurs.fournisseur) : null,
      mode_paiement: valeurs.mode_paiement,
    };
  };

  const envoyer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const succes = await action.executer(async () => {
      const creee = await requete<{ id: number }>(chemin, {
        methode: "POST",
        corps: corpsDe(),
      });
      // Une réquisition part vide : ses lignes se saisissent avant l'envoi,
      // et son montant en dépend. On la laisse donc en brouillon.
      if (nature !== "requisitions") {
        await requete(`${chemin}/${creee.id}/soumettre`, {
          methode: "POST",
          corps: {},
        });
      }
    });
    if (succes) onEnregistre();
  };

  const titres: Record<string, string> = {
    depenses: "Engager une dépense",
    requisitions: "Exprimer un besoin",
    missions: "Demander un ordre de mission",
  };

  return (
    <Modale
      ouverte
      titre={titres[nature]}
      description={
        nature === "requisitions"
          ? "La réquisition est créée en brouillon : ajoutez ses lignes, puis envoyez-la."
          : "Votre responsable, puis le service financier, se prononceront."
      }
      large
      onFermer={onFermer}
    >
      <form onSubmit={envoyer} className="space-y-4">
        {action.erreur ? <Alerte>{action.erreur}</Alerte> : null}

        {nature === "depenses" ? (
          <>
            <Champ
              libelle="Libellé"
              value={valeurs.libelle}
              onChange={(evenement) => modifier("libelle", evenement.target.value)}
              required
              erreurs={action.champs.libelle}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ
                libelle="Montant"
                type="number"
                min="0"
                step="1"
                value={valeurs.montant}
                onChange={(evenement) => modifier("montant", evenement.target.value)}
                required
                erreurs={action.champs.montant}
              />
              <Champ
                libelle="Date"
                type="date"
                value={valeurs.date_depense}
                onChange={(evenement) => modifier("date_depense", evenement.target.value)}
                required
                erreurs={action.champs.date_depense}
              />
              <Selection
                libelle="Catégorie"
                value={valeurs.categorie}
                onChange={(evenement) => modifier("categorie", evenement.target.value)}
                options={categories.map((categorie) => ({
                  valeur: categorie.id,
                  libelle: categorie.libelle,
                }))}
                erreurs={action.champs.categorie}
              />
              <Selection
                libelle="Fournisseur"
                value={valeurs.fournisseur}
                onChange={(evenement) => modifier("fournisseur", evenement.target.value)}
                options={[
                  { valeur: "", libelle: "Aucun" },
                  ...fournisseurs.map((fournisseur) => ({
                    valeur: fournisseur.id,
                    libelle: fournisseur.raison_sociale,
                  })),
                ]}
              />
            </div>
            <ZoneTexte
              libelle="Description"
              value={valeurs.description}
              onChange={(evenement) => modifier("description", evenement.target.value)}
              erreurs={action.champs.description}
            />
          </>
        ) : null}

        {nature === "requisitions" ? (
          <>
            <Champ
              libelle="Objet"
              value={valeurs.objet}
              onChange={(evenement) => modifier("objet", evenement.target.value)}
              required
              erreurs={action.champs.objet}
            />
            <Selection
              libelle="Priorité"
              value={valeurs.priorite}
              onChange={(evenement) => modifier("priorite", evenement.target.value)}
              options={[
                { valeur: "BASSE", libelle: "Basse" },
                { valeur: "NORMALE", libelle: "Normale" },
                { valeur: "HAUTE", libelle: "Haute" },
                { valeur: "URGENTE", libelle: "Urgente" },
              ]}
            />
            <ZoneTexte
              libelle="Justification"
              value={valeurs.justification}
              onChange={(evenement) => modifier("justification", evenement.target.value)}
              erreurs={action.champs.justification}
            />
          </>
        ) : null}

        {nature === "missions" ? (
          <>
            <Champ
              libelle="Objet"
              value={valeurs.objet}
              onChange={(evenement) => modifier("objet", evenement.target.value)}
              required
              erreurs={action.champs.objet}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ
                libelle="Destination"
                value={valeurs.destination}
                onChange={(evenement) => modifier("destination", evenement.target.value)}
                required
                erreurs={action.champs.destination}
              />
              <Selection
                libelle="Zone"
                value={valeurs.zone}
                onChange={(evenement) => modifier("zone", evenement.target.value)}
                options={[
                  { valeur: "LOCALE", libelle: "Locale (même ville)" },
                  { valeur: "NATIONALE", libelle: "Nationale" },
                  { valeur: "SOUS_REGION", libelle: "Sous-région" },
                  { valeur: "INTERNATIONALE", libelle: "Internationale" },
                ]}
              />
              <Champ
                libelle="Départ"
                type="date"
                value={valeurs.date_depart}
                onChange={(evenement) => {
                  modifier("date_depart", evenement.target.value);
                  if (valeurs.date_retour < evenement.target.value) {
                    modifier("date_retour", evenement.target.value);
                  }
                }}
                required
                erreurs={action.champs.date_depart}
              />
              <Champ
                libelle="Retour"
                type="date"
                value={valeurs.date_retour}
                min={valeurs.date_depart}
                onChange={(evenement) => modifier("date_retour", evenement.target.value)}
                required
                erreurs={action.champs.date_retour}
              />
            </div>
            <p className="text-xs text-ardoise-500">
              Le perdiem se calcule à partir du barème et de la durée : il n&apos;y
              a pas de montant à saisir.
            </p>
          </>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-ardoise-200 pt-4 dark:border-ardoise-700">
          <Bouton type="button" variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" chargement={action.enCours}>
            {nature === "requisitions" ? "Créer le brouillon" : "Envoyer"}
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}

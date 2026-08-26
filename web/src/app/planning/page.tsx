"use client";

/**
 * Module Planning.
 *
 * Le calendrier du mois est l'écran principal : un planning éditorial se lit
 * en grille, pas en liste. Les deux onglets qui suivent — retards et clients —
 * répondent aux deux questions qu'on pose ensuite : qu'est-ce qui traîne, et
 * pour qui.
 */

import { useState } from "react";

import { Coquille } from "@/composants/Coquille";
import { Information } from "@/composants/metier";
import {
  Alerte,
  Badge,
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
import { aujourdhui, date } from "@/lib/format";
import { useAction, useListe, useRessource } from "@/lib/ressources";
import { useSession } from "@/lib/session";

import * as sections from "./sections";

type Client = {
  id: number;
  nom_entreprise: string;
  contact: string;
  actif: boolean;
  regles: { id: number; jour: string; jour_libelle: string }[];
};

type Echeance = {
  id: number;
  client: number;
  client_nom: string;
  date: string;
  statut: string;
  statut_libelle: string;
  description: string;
  motif_statut: string;
  en_retard: boolean;
  imminente: boolean;
  demande_une_action: boolean;
  jour_deconseille?: boolean;
  avertissement?: string;
  idee_titre?: string;
};

type Calendrier = {
  mois: number;
  annee: number;
  mois_libelle: string;
  jours: Record<
    string,
    {
      tournages: { id: number; client: string; statut: string; en_retard: boolean }[];
      publications: {
        id: number;
        client: string;
        statut: string;
        en_retard: boolean;
        jour_deconseille: boolean;
        idee: string;
      }[];
    }
  >;
};

type TableauPlanning = {
  clients: number;
  tournages_en_retard: number;
  publications_en_retard: number;
  a_venir: number;
};

const STATUTS = [
  { valeur: "EN_ATTENTE", libelle: "En attente" },
  { valeur: "REALISE", libelle: "Réalisé" },
  { valeur: "ANNULE", libelle: "Annulé" },
  { valeur: "NON_REALISE", libelle: "Non réalisé" },
  { valeur: "REPROGRAMME", libelle: "Reprogrammé" },
];

export default function PagePlanning() {
  return (
    <Coquille>
      <Contenu />
    </Coquille>
  );
}

function Contenu() {
  const { profil } = useSession();
  const [onglet, setOnglet] = useState<
    "calendrier" | "retards" | "echeances" | "idees" | "clients" | "bilans"
  >("calendrier");
  const maintenant = new Date();
  const [mois, setMois] = useState(maintenant.getMonth() + 1);
  const [annee, setAnnee] = useState(maintenant.getFullYear());
  const [selection, setSelection] = useState<Echeance | null>(null);
  const [nouvelle, setNouvelle] = useState<"tournage" | "publication" | null>(null);
  // Un bilan construit n'apparait pas tout seul dans la liste : on la remonte.
  const [bilans, setBilans] = useState(0);

  const roles = profil?.habilitations.planning ?? [];
  const estEquipe = roles.includes("admin") || roles.includes("team");

  const tableau = useRessource<TableauPlanning>("/planning/tableau-de-bord");
  const calendrier = useRessource<Calendrier>(
    onglet === "calendrier" ? `/planning/calendrier?mois=${mois}&annee=${annee}` : null,
  );
  const tournagesEnRetard = useListe<Echeance>(
    onglet === "retards" ? "/planning/tournages/en-retard" : null,
  );
  const publicationsEnRetard = useListe<Echeance>(
    onglet === "retards" ? "/planning/publications/en-retard" : null,
  );
  const clients = useListe<Client>("/planning/clients?taille=100");

  const rafraichir = () => {
    void calendrier.recharger();
    void tournagesEnRetard.recharger();
    void publicationsEnRetard.recharger();
    void tableau.recharger();
    setSelection(null);
  };

  return (
    <>
      <EnTetePage
        titre="Planning"
        description="Tournages, publications et bilans clients."
        actions={
          estEquipe ? (
            <>
              <Bouton variante="secondaire" onClick={() => setNouvelle("tournage")}>
                Tournage
              </Bouton>
              <Bouton onClick={() => setNouvelle("publication")}>Publication</Bouton>
            </>
          ) : null
        }
      />

      <div className="mb-6">
        <Grille colonnes={4}>
          <Statistique libelle="Clients suivis" valeur={tableau.donnees?.clients ?? 0} />
          <Statistique
            libelle="Tournages en retard"
            valeur={tableau.donnees?.tournages_en_retard ?? 0}
            ton={tableau.donnees?.tournages_en_retard ? "alerte" : "succes"}
          />
          <Statistique
            libelle="Publications en retard"
            valeur={tableau.donnees?.publications_en_retard ?? 0}
            ton={tableau.donnees?.publications_en_retard ? "alerte" : "succes"}
          />
          <Statistique libelle="À venir" valeur={tableau.donnees?.a_venir ?? 0} />
        </Grille>
      </div>

      <Onglets
        onglets={[
          { cle: "calendrier" as const, libelle: "Calendrier" },
          {
            cle: "retards" as const,
            libelle: "En retard",
            compteur:
              (tableau.donnees?.tournages_en_retard ?? 0) +
              (tableau.donnees?.publications_en_retard ?? 0),
          },
          { cle: "echeances" as const, libelle: "Échéances" },
          { cle: "idees" as const, libelle: "Idées" },
          { cle: "clients" as const, libelle: "Clients" },
          { cle: "bilans" as const, libelle: "Bilans" },
        ]}
        actif={onglet}
        onChange={setOnglet}
      />

      {onglet === "calendrier" ? (
        <Carte
          titre={calendrier.donnees ? `${calendrier.donnees.mois_libelle} ${annee}` : "Calendrier"}
          actions={
            <div className="flex gap-2">
              <Bouton
                taille="petite"
                variante="secondaire"
                onClick={() => {
                  const precedent = mois === 1 ? 12 : mois - 1;
                  setAnnee(mois === 1 ? annee - 1 : annee);
                  setMois(precedent);
                }}
              >
                ←
              </Bouton>
              <Bouton
                taille="petite"
                variante="secondaire"
                onClick={() => {
                  const suivant = mois === 12 ? 1 : mois + 1;
                  setAnnee(mois === 12 ? annee + 1 : annee);
                  setMois(suivant);
                }}
              >
                →
              </Bouton>
            </div>
          }
        >
          {calendrier.chargement ? (
            <Chargement />
          ) : calendrier.erreur ? (
            <Alerte>{calendrier.erreur}</Alerte>
          ) : !Object.keys(calendrier.donnees?.jours ?? {}).length ? (
            <EtatVide
              titre="Mois vide"
              description="Aucun tournage ni publication n'est prévu ce mois-ci."
            />
          ) : (
            <div className="space-y-4">
              {Object.entries(calendrier.donnees!.jours)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([jour, contenu]) => (
                  <div key={jour}>
                    <p className="mb-1 text-sm font-medium">{date(jour)}</p>
                    <ul className="space-y-1">
                      {contenu.tournages.map((tournage) => (
                        <li
                          key={`t${tournage.id}`}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Badge ton="info">Tournage</Badge>
                          <span className="flex-1">{tournage.client}</span>
                          {tournage.en_retard ? (
                            <Badge ton="danger">En retard</Badge>
                          ) : null}
                        </li>
                      ))}
                      {contenu.publications.map((publication) => (
                        <li
                          key={`p${publication.id}`}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Badge>Publication</Badge>
                          <span className="flex-1">
                            {publication.client}
                            {publication.idee ? ` — ${publication.idee}` : ""}
                          </span>
                          {publication.jour_deconseille ? (
                            <Badge ton="alerte">Jour peu porteur</Badge>
                          ) : null}
                          {publication.en_retard ? (
                            <Badge ton="danger">En retard</Badge>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </Carte>
      ) : null}

      {onglet === "retards" ? (
        <div className="space-y-6">
          <ListeEcheances
            titre="Tournages en retard"
            etat={tournagesEnRetard}
            onSelection={setSelection}
          />
          <ListeEcheances
            titre="Publications en retard"
            etat={publicationsEnRetard}
            onSelection={setSelection}
          />
        </div>
      ) : null}

      {onglet === "echeances" ? (
        <div className="space-y-6">
          <GestionRessource spec={sections.tournages(estEquipe)} />
          <GestionRessource spec={sections.publications(estEquipe)} />
        </div>
      ) : null}

      {onglet === "idees" ? <GestionRessource spec={sections.idees(estEquipe)} /> : null}

      {onglet === "clients" ? (
        <div className="space-y-6">
          <GestionRessource spec={sections.clients(estEquipe)} />
          <GestionRessource spec={sections.regles(estEquipe)} />
        </div>
      ) : null}

      {onglet === "bilans" ? (
        <div className="space-y-6">
          {estEquipe ? (
            <ConstruireBilan
              clients={clients.donnees ?? []}
              onConstruit={() => setBilans((tour) => tour + 1)}
            />
          ) : null}
          <GestionRessource key={bilans} spec={sections.rapports()} />
        </div>
      ) : null}

      <Modale
        ouverte={selection !== null}
        titre={selection?.client_nom ?? ""}
        description={selection ? date(selection.date) : ""}
        onFermer={() => setSelection(null)}
      >
        {selection ? (
          <div className="space-y-4">
            <Grille colonnes={2}>
              <Information libelle="Statut" valeur={selection.statut_libelle} />
              <Information libelle="Date" valeur={date(selection.date)} />
            </Grille>
            {selection.description ? (
              <Information libelle="Description" valeur={selection.description} />
            ) : null}
            {selection.motif_statut ? (
              <Alerte ton="avertissement" titre="Motif">
                {selection.motif_statut}
              </Alerte>
            ) : null}
            {selection.avertissement ? (
              <Alerte ton="avertissement">{selection.avertissement}</Alerte>
            ) : null}
          </div>
        ) : null}
      </Modale>

      {nouvelle ? (
        <FormulaireEcheance
          nature={nouvelle}
          clients={clients.donnees ?? []}
          onFermer={() => setNouvelle(null)}
          onEnregistre={() => {
            setNouvelle(null);
            rafraichir();
          }}
        />
      ) : null}
    </>
  );
}

function ListeEcheances({
  titre,
  etat,
  onSelection,
}: {
  titre: string;
  etat: { donnees: Echeance[] | null; chargement: boolean; erreur: string };
  onSelection: (echeance: Echeance) => void;
}) {
  return (
    <Carte titre={titre} sansPadding>
      <div className="px-4 sm:px-5">
        {etat.chargement ? (
          <Chargement />
        ) : etat.erreur ? (
          <div className="py-5">
            <Alerte>{etat.erreur}</Alerte>
          </div>
        ) : !etat.donnees?.length ? (
          <EtatVide titre="Rien en retard" description="Tout est à jour." />
        ) : (
          <ListeLignes>
            {etat.donnees.map((echeance) => (
              <LigneListe
                key={echeance.id}
                titre={echeance.client_nom}
                detail={echeance.description || "Sans description"}
                valeur={date(echeance.date)}
                statut={<Badge ton="danger">{echeance.statut_libelle}</Badge>}
                onClick={() => onSelection(echeance)}
              />
            ))}
          </ListeLignes>
        )}
      </div>
    </Carte>
  );
}

function FormulaireEcheance({
  nature,
  clients,
  onFermer,
  onEnregistre,
}: {
  nature: "tournage" | "publication";
  clients: Client[];
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const { requete } = useSession();
  const action = useAction();
  const [client, setClient] = useState(clients[0] ? String(clients[0].id) : "");
  const [jour, setJour] = useState(aujourdhui());
  const [statut, setStatut] = useState("EN_ATTENTE");
  const [description, setDescription] = useState("");
  const [motif, setMotif] = useState("");

  const motifRequis = ["ANNULE", "NON_REALISE", "REPROGRAMME"].includes(statut);

  const envoyer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const succes = await action.executer(() =>
      requete(`/planning/${nature}s`, {
        methode: "POST",
        corps: {
          client: Number(client),
          date: jour,
          statut,
          description,
          motif_statut: motif,
        },
      }),
    );
    if (succes) onEnregistre();
  };

  return (
    <Modale
      ouverte
      titre={nature === "tournage" ? "Planifier un tournage" : "Planifier une publication"}
      onFermer={onFermer}
    >
      <form onSubmit={envoyer} className="space-y-4">
        {action.erreur ? <Alerte>{action.erreur}</Alerte> : null}

        <Selection
          libelle="Client"
          value={client}
          onChange={(evenement) => setClient(evenement.target.value)}
          options={clients.map((candidat) => ({
            valeur: candidat.id,
            libelle: candidat.nom_entreprise,
          }))}
          erreurs={action.champs.client}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle="Date"
            type="date"
            value={jour}
            onChange={(evenement) => setJour(evenement.target.value)}
            required
            erreurs={action.champs.date}
          />
          <Selection
            libelle="Statut"
            value={statut}
            onChange={(evenement) => setStatut(evenement.target.value)}
            options={STATUTS}
          />
        </div>

        <ZoneTexte
          libelle="Description"
          value={description}
          onChange={(evenement) => setDescription(evenement.target.value)}
          erreurs={action.champs.description}
        />

        {motifRequis ? (
          <ZoneTexte
            libelle="Motif"
            value={motif}
            onChange={(evenement) => setMotif(evenement.target.value)}
            required
            aide="Un statut non tenu doit s'expliquer : sans motif, personne ne saura pourquoi dans trois mois."
            erreurs={action.champs.motif_statut}
          />
        ) : null}

        <div className="flex justify-end gap-2 border-t border-ardoise-200 pt-4 dark:border-ardoise-700">
          <Bouton type="button" variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" chargement={action.enCours} disabled={!client}>
            Planifier
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}

/**
 * La construction d'un bilan mensuel.
 *
 * Écrite à la main parce que ce n'est pas une création d'enregistrement : le
 * serveur relit le mois et fige les chiffres. Reconstruire plus tard donnerait
 * d'autres nombres, d'où le choix explicite du mois et de l'année.
 */
function ConstruireBilan({
  clients,
  onConstruit,
}: {
  clients: Client[];
  onConstruit: () => void;
}) {
  const { requete } = useSession();
  const action = useAction();
  const maintenant = new Date();
  const [client, setClient] = useState(clients[0] ? String(clients[0].id) : "");
  const [mois, setMois] = useState(String(maintenant.getMonth() + 1));
  const [annee, setAnnee] = useState(String(maintenant.getFullYear()));
  const [fait, setFait] = useState(false);

  const envoyer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    setFait(false);
    const succes = await action.executer(() =>
      requete("/planning/rapports/construire", {
        methode: "POST",
        corps: { client: Number(client), mois: Number(mois), annee: Number(annee) },
      }),
    );
    if (succes) {
      setFait(true);
      onConstruit();
    }
  };

  return (
    <Carte titre="Construire un bilan">
      <form onSubmit={envoyer} className="space-y-4">
        {action.erreur ? <Alerte>{action.erreur}</Alerte> : null}
        {fait ? <Alerte ton="info">Le bilan a été figé.</Alerte> : null}

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Selection
              libelle="Client"
              value={client}
              onChange={(evenement) => setClient(evenement.target.value)}
              options={clients.map((candidat) => ({
                valeur: candidat.id,
                libelle: candidat.nom_entreprise,
              }))}
              erreurs={action.champs.client}
            />
          </div>
          <Champ
            libelle="Mois"
            type="number"
            min="1"
            max="12"
            value={mois}
            onChange={(evenement) => setMois(evenement.target.value)}
            required
          />
          <Champ
            libelle="Année"
            type="number"
            min="2020"
            max="2100"
            value={annee}
            onChange={(evenement) => setAnnee(evenement.target.value)}
            required
          />
        </div>

        <div className="flex justify-end">
          <Bouton type="submit" chargement={action.enCours} disabled={!client}>
            Construire
          </Bouton>
        </div>
      </form>
    </Carte>
  );
}

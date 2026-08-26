"use client";

/**
 * Module Organisation : l'annuaire et l'organigramme du groupe.
 *
 * L'annuaire est ouvert à tout compte habilité — le rendre confidentiel
 * pousserait chacun à s'en refaire un dans un tableur, et c'est justement ce
 * doublon qu'on supprime. L'écriture, elle, est réservée : modifier un
 * rattachement, c'est déplacer le valideur des demandes de quelqu'un.
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
} from "@/composants/ui";
import { date, nombre } from "@/lib/format";
import { GestionRessource } from "@/composants/ressource";
import { useAction, useListe, useRessource } from "@/lib/ressources";
import { useSession } from "@/lib/session";
import type { Agent, Departement, NoeudOrganigramme } from "@/lib/types";

import * as sections from "./sections";

type Onglet = "annuaire" | "organigramme" | "departements";

export default function PageOrganisation() {
  return (
    <Coquille>
      <Contenu />
    </Coquille>
  );
}

function Contenu() {
  const { profil } = useSession();
  const [onglet, setOnglet] = useState<Onglet>("annuaire");
  const [recherche, setRecherche] = useState("");
  const [departement, setDepartement] = useState("");
  const [selection, setSelection] = useState<Agent | null>(null);
  const [edition, setEdition] = useState<Agent | null>(null);

  const roles = profil?.habilitations.organisation ?? [];
  const peutEcrire = roles.includes("admin") || roles.includes("gestionnaire");

  const parametres = new URLSearchParams({ actif: "true", taille: "200" });
  if (recherche.trim()) parametres.set("search", recherche.trim());
  if (departement) parametres.set("departement", departement);

  const agents = useListe<Agent>(`/organisation/agents?${parametres}`);
  const departements = useListe<Departement>("/organisation/departements?taille=100");
  const arbre = useRessource<{ racines: NoeudOrganigramme[] }>(
    onglet === "organigramme" ? "/organisation/organigramme" : null,
  );

  return (
    <>
      <EnTetePage
        titre="Organisation"
        description="Qui travaille ici, dans quel département, sous quelle autorité."
        actions={
          peutEcrire && onglet === "annuaire" ? (
            <Bouton onClick={() => setEdition({} as Agent)}>Ajouter un agent</Bouton>
          ) : null
        }
      />

      <div className="mb-6">
        <Grille colonnes={3}>
          <Statistique
            libelle="Effectif"
            valeur={agents.total || (agents.donnees?.length ?? 0)}
            detail="Agents en poste"
          />
          <Statistique
            libelle="Départements"
            valeur={departements.donnees?.length ?? 0}
          />
          <Statistique
            libelle="Encadrants"
            valeur={
              (agents.donnees ?? []).filter((agent) => agent.est_encadrant).length
            }
            detail="Des agents leur sont rattachés"
          />
        </Grille>
      </div>

      <Onglets
        onglets={[
          { cle: "annuaire" as Onglet, libelle: "Annuaire" },
          { cle: "organigramme" as Onglet, libelle: "Organigramme" },
          { cle: "departements" as Onglet, libelle: "Départements" },
        ]}
        actif={onglet}
        onChange={setOnglet}
      />

      {onglet === "annuaire" ? (
        <Carte sansPadding>
          <div className="flex flex-wrap gap-3 border-b border-ardoise-200 p-4 dark:border-ardoise-700">
            <div className="min-w-56 flex-1">
              <Champ
                libelle="Rechercher"
                value={recherche}
                onChange={(evenement) => setRecherche(evenement.target.value)}
                placeholder="Nom, matricule, poste..."
              />
            </div>
            <div className="min-w-48">
              <Selection
                libelle="Département"
                value={departement}
                onChange={(evenement) => setDepartement(evenement.target.value)}
                options={[
                  { valeur: "", libelle: "Tous" },
                  ...(departements.donnees ?? []).map((unite) => ({
                    valeur: unite.id,
                    libelle: unite.nom,
                  })),
                ]}
              />
            </div>
          </div>

          <div className="px-4 sm:px-5">
            {agents.chargement ? (
              <Chargement />
            ) : agents.erreur ? (
              <div className="py-5">
                <Alerte>{agents.erreur}</Alerte>
              </div>
            ) : !agents.donnees?.length ? (
              <EtatVide
                titre="Aucun agent"
                description="Aucun agent ne correspond à cette recherche."
              />
            ) : (
              <ListeLignes>
                {agents.donnees.map((agent) => (
                  <LigneListe
                    key={agent.id}
                    titre={agent.nom_complet}
                    detail={
                      <>
                        {agent.poste || "Poste non renseigné"}
                        {agent.departement_nom ? ` · ${agent.departement_nom}` : ""}
                      </>
                    }
                    valeur={agent.matricule}
                    statut={
                      agent.est_encadrant ? <Badge ton="info">Encadrant</Badge> : null
                    }
                    onClick={() => setSelection(agent)}
                  />
                ))}
              </ListeLignes>
            )}
          </div>
        </Carte>
      ) : null}

      {onglet === "organigramme" ? (
        <Carte titre="Organigramme" sousTitre="Du sommet aux équipes">
          {arbre.chargement ? (
            <Chargement />
          ) : arbre.erreur ? (
            <Alerte>{arbre.erreur}</Alerte>
          ) : !arbre.donnees?.racines.length ? (
            <EtatVide
              titre="Organigramme vide"
              description="Aucun agent n'est encore enregistré."
            />
          ) : (
            <Arbre noeuds={arbre.donnees.racines} />
          )}
        </Carte>
      ) : null}

      {onglet === "departements" ? (
        <GestionRessource spec={sections.departements(peutEcrire)} />
      ) : null}

      <Modale
        ouverte={selection !== null}
        titre={selection?.nom_complet ?? ""}
        description={selection?.matricule}
        large
        onFermer={() => setSelection(null)}
      >
        {selection ? (
          <div className="space-y-5">
            <Grille colonnes={2}>
              <Information libelle="Poste" valeur={selection.poste || "—"} />
              <Information
                libelle="Département"
                valeur={selection.departement_nom || "—"}
              />
              <Information
                libelle="Responsable"
                valeur={selection.responsable_nom || "Aucun"}
              />
              <Information
                libelle="Contrat"
                valeur={selection.type_contrat_libelle}
              />
              <Information
                libelle="Embauche"
                valeur={date(selection.date_embauche)}
              />
              <Information
                libelle="Ancienneté"
                valeur={`${nombre(selection.anciennete_mois)} mois`}
              />
              <Information libelle="Adresse" valeur={selection.email || "—"} />
              <Information libelle="Téléphone" valeur={selection.telephone || "—"} />
            </Grille>

            {!selection.a_un_compte ? (
              <Alerte ton="avertissement" titre="Aucun compte rattaché">
                Cet agent figure à l&apos;organigramme mais ne s&apos;est jamais
                connecté. Le rattachement se fait tout seul à sa première
                connexion.
              </Alerte>
            ) : null}

            {peutEcrire ? (
              <div className="border-t border-ardoise-200 pt-4 dark:border-ardoise-700">
                <Bouton
                  variante="secondaire"
                  onClick={() => {
                    setEdition(selection);
                    setSelection(null);
                  }}
                >
                  Modifier la fiche
                </Bouton>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modale>

      {edition ? (
        <FormulaireAgent
          agent={edition.id ? edition : undefined}
          departements={departements.donnees ?? []}
          agents={agents.donnees ?? []}
          onFermer={() => setEdition(null)}
          onEnregistre={() => {
            setEdition(null);
            void agents.recharger();
            void departements.recharger();
          }}
        />
      ) : null}
    </>
  );
}

/** L'arbre des rattachements, replié niveau par niveau. */
function Arbre({ noeuds, niveau = 0 }: { noeuds: NoeudOrganigramme[]; niveau?: number }) {
  return (
    <ul className={niveau > 0 ? "ml-5 border-l border-ardoise-200 pl-4 dark:border-ardoise-700" : ""}>
      {noeuds.map((noeud) => (
        <li key={noeud.agent_id} className="py-1.5">
          <p className="text-sm font-medium">{noeud.nom_complet}</p>
          <p className="text-xs text-ardoise-500">
            {noeud.poste || "Poste non renseigné"}
            {noeud.departement_nom ? ` · ${noeud.departement_nom}` : ""}
            {noeud.equipe.length ? ` · ${noeud.equipe.length} rattaché(s)` : ""}
          </p>
          {noeud.equipe.length ? (
            <Arbre noeuds={noeud.equipe} niveau={niveau + 1} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function FormulaireAgent({
  agent,
  departements,
  agents,
  onFermer,
  onEnregistre,
}: {
  agent?: Agent;
  departements: Departement[];
  agents: Agent[];
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const { requete } = useSession();
  const action = useAction();
  const [valeurs, setValeurs] = useState({
    identifiant: agent?.identifiant ?? "",
    prenom: agent?.prenom ?? "",
    nom: agent?.nom ?? "",
    email: agent?.email ?? "",
    telephone: agent?.telephone ?? "",
    poste: agent?.poste ?? "",
    departement: agent?.departement ? String(agent.departement) : "",
    responsable: agent?.responsable ? String(agent.responsable) : "",
    date_embauche: agent?.date_embauche ?? "",
  });

  const modifier = (champ: string, valeur: string) =>
    setValeurs((precedent) => ({ ...precedent, [champ]: valeur }));

  const envoyer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const succes = await action.executer(async () => {
      const corps = {
        ...valeurs,
        departement: valeurs.departement ? Number(valeurs.departement) : null,
        responsable: valeurs.responsable ? Number(valeurs.responsable) : null,
        date_embauche: valeurs.date_embauche || null,
      };
      if (agent) {
        await requete(`/organisation/agents/${agent.id}`, {
          methode: "PATCH",
          corps,
        });
        return;
      }
      await requete("/organisation/agents", { methode: "POST", corps });
    });
    if (succes) onEnregistre();
  };

  return (
    <Modale
      ouverte
      titre={agent ? "Modifier la fiche" : "Nouvel agent"}
      description="Le matricule est attribué automatiquement, à la suite des existants."
      large
      onFermer={onFermer}
    >
      <form onSubmit={envoyer} className="space-y-4">
        {action.erreur ? <Alerte>{action.erreur}</Alerte> : null}

        <Champ
          libelle="Identifiant de connexion"
          value={valeurs.identifiant}
          onChange={(evenement) => modifier("identifiant", evenement.target.value)}
          placeholder="prenom.nom@gdamali.net"
          required
          aide="La même valeur que dans GDA Hub : c'est elle qui rattachera le compte."
          erreurs={action.champs.identifiant}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle="Prénom"
            value={valeurs.prenom}
            onChange={(evenement) => modifier("prenom", evenement.target.value)}
            erreurs={action.champs.prenom}
          />
          <Champ
            libelle="Nom"
            value={valeurs.nom}
            onChange={(evenement) => modifier("nom", evenement.target.value)}
            required
            erreurs={action.champs.nom}
          />
          <Champ
            libelle="Adresse professionnelle"
            type="email"
            value={valeurs.email}
            onChange={(evenement) => modifier("email", evenement.target.value)}
            erreurs={action.champs.email}
          />
          <Champ
            libelle="Téléphone"
            value={valeurs.telephone}
            onChange={(evenement) => modifier("telephone", evenement.target.value)}
            erreurs={action.champs.telephone}
          />
          <Champ
            libelle="Poste"
            value={valeurs.poste}
            onChange={(evenement) => modifier("poste", evenement.target.value)}
            erreurs={action.champs.poste}
          />
          <Champ
            libelle="Date d'embauche"
            type="date"
            value={valeurs.date_embauche}
            onChange={(evenement) => modifier("date_embauche", evenement.target.value)}
            erreurs={action.champs.date_embauche}
          />
          <Selection
            libelle="Département"
            value={valeurs.departement}
            onChange={(evenement) => modifier("departement", evenement.target.value)}
            options={[
              { valeur: "", libelle: "Aucun" },
              ...departements.map((unite) => ({
                valeur: unite.id,
                libelle: unite.nom,
              })),
            ]}
            erreurs={action.champs.departement}
          />
          <Selection
            libelle="Responsable direct"
            value={valeurs.responsable}
            onChange={(evenement) => modifier("responsable", evenement.target.value)}
            options={[
              { valeur: "", libelle: "Aucun" },
              ...agents
                .filter((candidat) => candidat.id !== agent?.id)
                .map((candidat) => ({
                  valeur: candidat.id,
                  libelle: candidat.nom_complet,
                })),
            ]}
            erreurs={action.champs.responsable}
          />
        </div>

        <p className="text-xs text-ardoise-500">
          Le responsable désigne le premier valideur des demandes de cet agent.
          Ce n&apos;est pas un libellé d&apos;annuaire.
        </p>

        <div className="flex justify-end gap-2 border-t border-ardoise-200 pt-4 dark:border-ardoise-700">
          <Bouton type="button" variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" chargement={action.enCours} disabled={!valeurs.nom.trim()}>
            Enregistrer
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}

"use client";

import { useMemo, useState } from "react";

import {
  Alerte,
  Bouton,
  Carte,
  Champ,
  Chargement,
  EnTetePage,
  Modale,
  Selection,
  TuileStat,
} from "@/rh/composants/ui";
import { appelApi } from "@/rh/lib/api";
import { useAuth } from "@/rh/lib/auth";
import { useAction, useListe } from "@/rh/lib/hooks";
import type { Departement, Utilisateur } from "@/rh/lib/types";

const SANS_DEPARTEMENT = "sans";

/**
 * Organisation : qui appartient a quel departement.
 *
 * Le rattachement n'est pas cosmetique — c'est lui qui designe le premier
 * valideur de chaque demande. Deplacer un agent d'un departement a l'autre
 * change la personne qui verra passer ses conges des la demande suivante.
 */
export default function PageOrganisation() {
  const { utilisateur } = useAuth();
  const departements = useListe<Departement>("/departements/");
  const agents = useListe<Utilisateur>("/utilisateurs/?is_active=true");
  const [enEdition, setEnEdition] = useState<Utilisateur | null>(null);
  const [nouveauDepartement, setNouveauDepartement] = useState(false);
  const [departementEdite, setDepartementEdite] = useState<Departement | null>(null);

  const chargement = departements.chargement || agents.chargement;
  const erreur = departements.erreur ?? agents.erreur;

  const rafraichir = () => {
    void departements.recharger();
    void agents.recharger();
    setEnEdition(null);
    setNouveauDepartement(false);
    setDepartementEdite(null);
  };

  const groupes = useMemo(() => {
    const liste = agents.donnees ?? [];
    const parDepartement = (departements.donnees ?? []).map((departement) => ({
      departement,
      membres: liste.filter((agent) => agent.departement === departement.id),
    }));
    const orphelins = liste.filter((agent) => agent.departement === null);
    return { parDepartement, orphelins };
  }, [agents.donnees, departements.donnees]);

  const autorise =
    !utilisateur || utilisateur.role === "DIRECTION" || utilisateur.role === "RH";
  if (!autorise) {
    return (
      <Alerte titre="Acces reserve">
        Seules la Direction et les Ressources Humaines classent les agents.
      </Alerte>
    );
  }

  return (
    <>
      <EnTetePage
        titre="Organisation"
        description="Repartissez les agents par departement. Le responsable du departement se prononce le premier sur leurs demandes."
        actions={
          <Bouton onClick={() => setNouveauDepartement(true)}>
            Nouveau departement
          </Bouton>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 max-sm:[&>*:last-child]:col-span-2">
        <TuileStat
          libelle="Departements"
          valeur={departements.donnees?.length ?? 0}
          detail="Unites de l'organigramme"
          ton="marque"
        />
        <TuileStat
          libelle="Agents actifs"
          valeur={agents.donnees?.length ?? 0}
          detail="Comptes ouverts"
        />
        <TuileStat
          libelle="Sans departement"
          valeur={groupes.orphelins.length}
          detail="Leurs demandes remontent au manager"
          ton={groupes.orphelins.length ? "alerte" : "succes"}
        />
      </div>

      {chargement ? (
        <Chargement libelle="Lecture de l'organigramme..." />
      ) : erreur ? (
        <Alerte>{erreur}</Alerte>
      ) : (
        <div className="space-y-5">
          {groupes.orphelins.length > 0 && (
            <BlocDepartement
              titre="Sans departement"
              sousTitre="A rattacher : faute de departement, leur premier valideur est leur manager"
              membres={groupes.orphelins}
              onModifier={setEnEdition}
            />
          )}

          {groupes.parDepartement.map(({ departement, membres }) => (
            <BlocDepartement
              key={departement.id}
              titre={departement.nom}
              sousTitre={
                departement.responsable_nom
                  ? `Responsable : ${departement.responsable_nom} · ${membres.length} agent(s)`
                  : `Aucun responsable · ${membres.length} agent(s)`
              }
              membres={membres}
              onModifier={setEnEdition}
              onEditerDepartement={() => setDepartementEdite(departement)}
              alerte={!departement.responsable_nom}
            />
          ))}
        </div>
      )}

      {enEdition && (
        <FicheAgent
          agent={enEdition}
          departements={departements.donnees ?? []}
          agents={agents.donnees ?? []}
          onFermer={() => setEnEdition(null)}
          onEnregistre={rafraichir}
        />
      )}

      <FormulaireDepartement
        ouvert={nouveauDepartement}
        agents={agents.donnees ?? []}
        onFermer={() => setNouveauDepartement(false)}
        onEnregistre={rafraichir}
      />

      {departementEdite && (
        <FormulaireDepartement
          ouvert
          departement={departementEdite}
          effectif={
            (agents.donnees ?? []).filter(
              (agent) => agent.departement === departementEdite.id,
            ).length
          }
          agents={agents.donnees ?? []}
          onFermer={() => setDepartementEdite(null)}
          onEnregistre={rafraichir}
        />
      )}
    </>
  );
}

function BlocDepartement({
  titre,
  sousTitre,
  membres,
  onModifier,
  onEditerDepartement,
  alerte,
}: {
  titre: string;
  sousTitre: string;
  membres: Utilisateur[];
  onModifier: (agent: Utilisateur) => void;
  onEditerDepartement?: () => void;
  alerte?: boolean;
}) {
  return (
    <Carte
      titre={titre}
      sousTitre={sousTitre}
      actions={
        onEditerDepartement && (
          <Bouton taille="petite" variante="secondaire" onClick={onEditerDepartement}>
            Modifier
          </Bouton>
        )
      }
      sansPadding
    >
      <div className="px-4 pb-4 sm:px-5">
        {alerte && (
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Sans responsable, les demandes de ce departement remontent
            directement au niveau superieur.
          </p>
        )}
        {membres.length === 0 ? (
          <p className="py-3 text-sm text-slate-400">Aucun agent rattache.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {membres.map((agent) => (
              <li
                key={agent.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {agent.nom_complet}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {agent.poste || "Poste non renseigne"}
                  </p>
                </div>
                <Bouton
                  taille="petite"
                  variante="secondaire"
                  onClick={() => onModifier(agent)}
                >
                  Classer
                </Bouton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Carte>
  );
}

function FicheAgent({
  agent,
  departements,
  agents,
  onFermer,
  onEnregistre,
}: {
  agent: Utilisateur;
  departements: Departement[];
  agents: Utilisateur[];
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const action = useAction();
  const [departement, setDepartement] = useState(
    agent.departement ? String(agent.departement) : SANS_DEPARTEMENT,
  );
  const [manager, setManager] = useState(agent.manager ? String(agent.manager) : "");
  const [poste, setPoste] = useState(agent.poste);

  const enregistrer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const succes = await action.executer(() =>
      appelApi(`/utilisateurs/${agent.id}/`, {
        methode: "PATCH",
        corps: {
          departement: departement === SANS_DEPARTEMENT ? null : Number(departement),
          manager: manager ? Number(manager) : null,
          poste,
        },
      }),
    );
    if (succes) onEnregistre();
  };

  return (
    <Modale
      ouverte
      titre={agent.nom_complet}
      description={agent.poste || "Poste non renseigne"}
      onFermer={onFermer}
    >
      <form onSubmit={enregistrer} className="space-y-4">
        {action.erreur && <Alerte>{action.erreur}</Alerte>}

        <Selection
          libelle="Departement"
          value={departement}
          onChange={(evenement) => setDepartement(evenement.target.value)}
          erreurs={action.champs.departement}
          options={[
            { valeur: SANS_DEPARTEMENT, libelle: "Sans departement" },
            ...departements.map((element) => ({
              valeur: String(element.id),
              libelle: `${element.nom} (${element.code})`,
            })),
          ]}
        />

        <Selection
          libelle="Responsable hierarchique"
          value={manager}
          onChange={(evenement) => setManager(evenement.target.value)}
          placeholder="Aucun"
          erreurs={action.champs.manager}
          options={agents
            .filter((element) => element.id !== agent.id)
            .map((element) => ({
              valeur: String(element.id),
              libelle: element.nom_complet,
            }))}
        />

        <Champ
          libelle="Poste"
          value={poste}
          onChange={(evenement) => setPoste(evenement.target.value)}
          erreurs={action.champs.poste}
        />

        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Le premier valideur des demandes de cet agent sera le responsable du
          departement choisi — a defaut de responsable, son responsable
          hierarchique.
        </p>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Bouton type="button" variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" chargement={action.enCours}>
            Enregistrer
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}

function FormulaireDepartement({
  ouvert,
  departement,
  effectif = 0,
  agents,
  onFermer,
  onEnregistre,
}: {
  ouvert: boolean;
  departement?: Departement;
  effectif?: number;
  agents: Utilisateur[];
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const action = useAction();
  const suppression = useAction();
  const [code, setCode] = useState(departement?.code ?? "");
  const [nom, setNom] = useState(departement?.nom ?? "");
  const [responsable, setResponsable] = useState(
    departement?.responsable ? String(departement.responsable) : "",
  );
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);

  const envoyer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const corps = {
      code: code.trim().toUpperCase(),
      nom: nom.trim(),
      responsable: responsable ? Number(responsable) : null,
    };
    const succes = await action.executer(() =>
      departement
        ? appelApi(`/departements/${departement.id}/`, { methode: "PATCH", corps })
        : appelApi("/departements/", { methode: "POST", corps }),
    );
    if (succes) {
      if (!departement) {
        setCode("");
        setNom("");
        setResponsable("");
      }
      onEnregistre();
    }
  };

  const supprimer = async () => {
    if (!departement) return;
    const succes = await suppression.executer(() =>
      appelApi(`/departements/${departement.id}/`, { methode: "DELETE" }),
    );
    if (succes) onEnregistre();
  };

  return (
    <Modale
      ouverte={ouvert}
      titre={departement ? departement.nom : "Nouveau departement"}
      description={
        departement
          ? "Le responsable designe ici se prononce le premier sur les demandes de ses agents."
          : "Le responsable designe ici se prononcera le premier sur les demandes de ses agents."
      }
      onFermer={onFermer}
    >
      <form onSubmit={envoyer} className="space-y-4">
        {action.erreur && <Alerte>{action.erreur}</Alerte>}
        {suppression.erreur && <Alerte>{suppression.erreur}</Alerte>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle="Code"
            value={code}
            onChange={(evenement) => setCode(evenement.target.value)}
            placeholder="CIAL"
            required
            erreurs={action.champs.code}
          />
          <Champ
            libelle="Nom"
            value={nom}
            onChange={(evenement) => setNom(evenement.target.value)}
            placeholder="Commerciaux"
            required
            erreurs={action.champs.nom}
          />
        </div>

        <Selection
          libelle="Responsable"
          value={responsable}
          onChange={(evenement) => setResponsable(evenement.target.value)}
          placeholder="A designer plus tard"
          erreurs={action.champs.responsable}
          options={agents.map((agent) => ({
            valeur: String(agent.id),
            libelle: agent.nom_complet,
          }))}
        />

        {departement && (
          <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
            {confirmeSuppression ? (
              <>
                <p className="text-sm font-medium text-rose-800">
                  Supprimer « {departement.nom} » ?
                </p>
                <p className="mt-1 text-xs text-rose-700">
                  {effectif > 0
                    ? `${effectif} agent(s) s'y trouvent : ils resteront dans l'application mais sans departement, et leurs demandes remonteront a leur responsable hierarchique.`
                    : "Aucun agent n'y est rattache."}{" "}
                  Les dossiers deja circulants gardent leur circuit.
                </p>
                <div className="mt-3 flex gap-2">
                  <Bouton
                    type="button"
                    variante="danger"
                    taille="petite"
                    chargement={suppression.enCours}
                    onClick={supprimer}
                  >
                    Confirmer la suppression
                  </Bouton>
                  <Bouton
                    type="button"
                    variante="secondaire"
                    taille="petite"
                    onClick={() => setConfirmeSuppression(false)}
                  >
                    Annuler
                  </Bouton>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmeSuppression(true)}
                className="text-sm font-medium text-rose-700 hover:text-rose-800"
              >
                Supprimer ce departement
              </button>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Bouton type="button" variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" chargement={action.enCours} disabled={!code || !nom}>
            {departement ? "Enregistrer" : "Creer"}
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}

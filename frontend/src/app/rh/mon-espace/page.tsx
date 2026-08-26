"use client";

import { useState } from "react";

import {
  Alerte,
  Bouton,
  Carte,
  Champ,
  EnTetePage,
  TuileStat,
} from "@/rh/composants/ui";
import { appelApi } from "@/rh/lib/api";
import { useAuth } from "@/rh/lib/auth";
import { date, initiales, nombre } from "@/rh/lib/format";
import { useAction, useRessource } from "@/rh/lib/hooks";
import type { SoldeConge, Utilisateur } from "@/rh/lib/types";

export default function PageMonEspace() {
  const { utilisateur, rafraichirProfil } = useAuth();
  const solde = useRessource<SoldeConge>("/rh/soldes-conges/mon-solde/");

  if (!utilisateur) return null;

  return (
    <>
      <EnTetePage
        titre="Mon espace"
        description="Vos informations professionnelles, votre solde de conges et la gestion de votre mot de passe."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 max-sm:[&>*:last-child]:col-span-2">
        <TuileStat
          libelle="Solde de conges"
          valeur={`${nombre(solde.donnees?.jours_restants, 1)} j`}
          detail={`${nombre(solde.donnees?.jours_pris, 1)} j deja pris`}
          ton="marque"
        />
        <TuileStat
          libelle="Anciennete"
          valeur={`${Math.floor(utilisateur.anciennete_mois / 12)} an(s)`}
          detail={
            utilisateur.date_embauche
              ? `Depuis le ${date(utilisateur.date_embauche)}`
              : "Date d'embauche non renseignee"
          }
        />
        <TuileStat
          libelle="Type de contrat"
          valeur={utilisateur.type_contrat}
          detail={utilisateur.departement_nom || "Departement non affecte"}
          ton="info"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FicheProfil utilisateur={utilisateur} onEnregistre={rafraichirProfil} />
        </div>

        <div className="space-y-6">
          <Carte titre="Identite">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-full bg-marque-100 text-base font-semibold text-marque-700">
                {initiales(utilisateur.nom_complet)}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {utilisateur.nom_complet}
                </p>
              </div>
            </div>
            <dl className="mt-4 space-y-2.5 text-sm">
              <Ligne libelle="Poste" valeur={utilisateur.poste || "—"} />
              <Ligne libelle="Departement" valeur={utilisateur.departement_nom || "—"} />
              <Ligne libelle="Responsable" valeur={utilisateur.manager_nom || "—"} />
            </dl>
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Le poste, le rattachement hierarchique et le contrat sont geres par les
              Ressources Humaines.
            </p>
          </Carte>

          <ChangementMotDePasse />
        </div>
      </div>
    </>
  );
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{libelle}</dt>
      <dd className="text-right text-slate-800">{valeur}</dd>
    </div>
  );
}

function FicheProfil({
  utilisateur,
  onEnregistre,
}: {
  utilisateur: Utilisateur;
  onEnregistre: () => Promise<void>;
}) {
  const action = useAction();
  const [email, setEmail] = useState(utilisateur.email);
  const [telephone, setTelephone] = useState(utilisateur.telephone);
  const [succes, setSucces] = useState(false);

  const enregistrer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    setSucces(false);
    const ok = await action.executer(async () => {
      await appelApi("/auth/profil/", {
        methode: "PATCH",
        corps: { email, telephone },
      });
      await onEnregistre();
    });
    setSucces(ok);
  };

  return (
    <Carte
      titre="Coordonnees professionnelles"
      sousTitre="Ces informations alimentent l'annuaire interne"
    >
      <form onSubmit={enregistrer} className="space-y-4">
        {action.erreur && <Alerte>{action.erreur}</Alerte>}
        {succes && <Alerte ton="succes">Coordonnees mises a jour.</Alerte>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle="Prenom"
            value={utilisateur.first_name}
            disabled
            onChange={() => undefined}
          />
          <Champ
            libelle="Nom"
            value={utilisateur.last_name}
            disabled
            onChange={() => undefined}
          />
          <Champ
            libelle="Courriel"
            type="email"
            value={email}
            onChange={(evenement) => setEmail(evenement.target.value)}
            erreurs={action.champs.email}
          />
          <Champ
            libelle="Telephone"
            value={telephone}
            onChange={(evenement) => setTelephone(evenement.target.value)}
            erreurs={action.champs.telephone}
          />
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <Bouton type="submit" chargement={action.enCours}>
            Enregistrer
          </Bouton>
        </div>
      </form>
    </Carte>
  );
}

function ChangementMotDePasse() {
  const action = useAction();
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [succes, setSucces] = useState(false);

  const envoyer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    setSucces(false);
    if (nouveau !== confirmation) {
      action.reinitialiser();
      return;
    }
    const ok = await action.executer(() =>
      appelApi("/auth/mot-de-passe/", {
        methode: "POST",
        corps: { ancien_mot_de_passe: ancien, nouveau_mot_de_passe: nouveau },
      }),
    );
    if (ok) {
      setAncien("");
      setNouveau("");
      setConfirmation("");
      setSucces(true);
    }
  };

  const discordance = Boolean(confirmation) && nouveau !== confirmation;

  return (
    <Carte titre="Securite">
      <form onSubmit={envoyer} className="space-y-3">
        {action.erreur && <Alerte>{action.erreur}</Alerte>}
        {succes && <Alerte ton="succes">Mot de passe modifie.</Alerte>}

        <Champ
          libelle="Mot de passe actuel"
          type="password"
          value={ancien}
          onChange={(evenement) => setAncien(evenement.target.value)}
          autoComplete="current-password"
          erreurs={action.champs.ancien_mot_de_passe}
        />
        <Champ
          libelle="Nouveau mot de passe"
          type="password"
          value={nouveau}
          onChange={(evenement) => setNouveau(evenement.target.value)}
          autoComplete="new-password"
          erreurs={action.champs.nouveau_mot_de_passe}
        />
        <Champ
          libelle="Confirmation"
          type="password"
          value={confirmation}
          onChange={(evenement) => setConfirmation(evenement.target.value)}
          autoComplete="new-password"
          erreurs={discordance ? ["Les deux saisies different."] : undefined}
        />

        <Bouton
          type="submit"
          className="w-full"
          chargement={action.enCours}
          disabled={!ancien || !nouveau || discordance}
        >
          Modifier le mot de passe
        </Bouton>
      </form>
    </Carte>
  );
}

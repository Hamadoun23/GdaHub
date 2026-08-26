"use client";

/**
 * Mon compte.
 *
 * Un seul geste vraiment important : changer son mot de passe. Il existait
 * dans l'API sans exister à l'écran, ce qui revenait à demander aux gens de
 * garder celui qu'on leur avait attribué.
 *
 * Le changement ferme les autres sessions — c'est le serveur qui s'en charge.
 * Quelqu'un qui change son mot de passe le fait souvent parce qu'il craint
 * qu'on le connaisse ; laisser ouverte une session ailleurs viderait le geste
 * de son sens.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Coquille } from "@/composants/Coquille";
import { Information } from "@/composants/metier";
import {
  Alerte,
  Badge,
  Bouton,
  Carte,
  Champ,
  Grille,
} from "@/composants/ui";
import { useAction } from "@/lib/ressources";
import { useSession } from "@/lib/session";

export default function PageMonCompte() {
  return (
    <Coquille>
      <Contenu />
    </Coquille>
  );
}

function Contenu() {
  const { profil, deconnecter } = useSession();
  if (!profil) return null;

  const { utilisateur, applications } = profil;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Mon compte</h1>
        <p className="mt-1 text-sm text-ardoise-500">
          Vos coordonnées, vos habilitations et votre mot de passe.
        </p>
      </div>

      <div className="space-y-6">
        <Carte titre="Identité">
          <Grille colonnes={2}>
            <Information libelle="Nom" valeur={utilisateur.nom_complet} />
            <Information libelle="Identifiant" valeur={utilisateur.identifiant} />
            <Information libelle="Fonction" valeur={utilisateur.fonction || "—"} />
            <Information
              libelle="Profil"
              valeur={
                utilisateur.est_superadmin ? (
                  <Badge ton="info">Super administrateur</Badge>
                ) : (
                  "Compte standard"
                )
              }
            />
          </Grille>
        </Carte>

        <Carte
          titre="Mes habilitations"
          sousTitre="Ce à quoi votre compte donne accès, application par application."
        >
          <ul className="space-y-2 text-sm">
            {applications.map((application) => (
              <li
                key={application.code}
                className="flex flex-wrap items-center gap-2"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: application.couleur || "#0f766e" }}
                />
                <span className="min-w-44 font-medium">{application.nom}</span>
                <span className="text-ardoise-500">
                  {application.roles.length
                    ? application.roles.join(", ")
                    : "consultation"}
                </span>
              </li>
            ))}
          </ul>
        </Carte>

        <FormulaireMotDePasse onChange={deconnecter} />
      </div>
    </>
  );
}

function FormulaireMotDePasse({ onChange }: { onChange: () => Promise<void> }) {
  const { requete } = useSession();
  const routeur = useRouter();
  const action = useAction();
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ecart, setEcart] = useState("");

  const envoyer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    setEcart("");
    if (nouveau !== confirmation) {
      // Vérifié ici parce que le serveur ne reçoit qu'une seule valeur : il ne
      // peut pas savoir que la confirmation ne correspondait pas.
      setEcart("Les deux saisies ne correspondent pas.");
      return;
    }
    const succes = await action.executer(() =>
      requete("/identity/auth/mot-de-passe", {
        methode: "POST",
        corps: { ancien, nouveau },
      }),
    );
    if (succes) {
      // Le serveur a fermé toutes les sessions, la nôtre comprise : on
      // renvoie à la connexion plutôt que de laisser l'écran se vider tout
      // seul au prochain appel.
      await onChange();
      routeur.replace("/connexion");
    }
  };

  return (
    <Carte
      titre="Changer mon mot de passe"
      sousTitre="Le changement ferme toutes vos sessions, y compris celle-ci."
    >
      <form onSubmit={envoyer} className="max-w-md space-y-4">
        {action.erreur ? <Alerte>{action.erreur}</Alerte> : null}
        {ecart ? <Alerte>{ecart}</Alerte> : null}

        <Champ
          libelle="Mot de passe actuel"
          type="password"
          value={ancien}
          onChange={(evenement) => setAncien(evenement.target.value)}
          autoComplete="current-password"
          required
          erreurs={action.champs.ancien}
        />
        <Champ
          libelle="Nouveau mot de passe"
          type="password"
          value={nouveau}
          onChange={(evenement) => setNouveau(evenement.target.value)}
          autoComplete="new-password"
          required
          erreurs={action.champs.nouveau}
        />
        <Champ
          libelle="Confirmer le nouveau mot de passe"
          type="password"
          value={confirmation}
          onChange={(evenement) => setConfirmation(evenement.target.value)}
          autoComplete="new-password"
          required
        />

        <Bouton
          type="submit"
          chargement={action.enCours}
          disabled={!ancien || !nouveau || !confirmation}
        >
          Changer le mot de passe
        </Bouton>
      </form>
    </Carte>
  );
}

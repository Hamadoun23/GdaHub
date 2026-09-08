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

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Coquille } from "@/composants/Coquille";
import { Information } from "@/composants/metier";
import { initialesDepuis } from "@/composants/coquille-app/initiales";
import {
  Alerte,
  Badge,
  Bouton,
  Carte,
  Champ,
  Grille,
} from "@/composants/ui";
import type { Profil } from "@/lib/api";
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
        <p className="mt-1 text-sm text-muted-foreground">
          Vos coordonnées, vos habilitations et votre mot de passe.
        </p>
      </div>

      <div className="space-y-6">
        <CartePhoto />

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
                  style={{ backgroundColor: application.couleur || "var(--color-marque)" }}
                />
                <span className="min-w-44 font-medium">{application.nom}</span>
                <span className="text-muted-foreground">
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

function CartePhoto() {
  const { profil, requete, actualiserProfil } = useSession();
  const action = useAction();
  const [previsualisation, setPrevisualisation] = useState<string | null>(null);
  const entreeFichier = useRef<HTMLInputElement>(null);

  if (!profil) return null;
  const { utilisateur } = profil;

  const deposer = async (evenement: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = evenement.target.files?.[0];
    evenement.target.value = "";
    if (!fichier) return;

    // Aperçu immédiat pendant l'envoi, plutôt que de laisser l'ancienne photo
    // (ou les initiales) le temps que le service réponde.
    const objetUrl = URL.createObjectURL(fichier);
    setPrevisualisation(objetUrl);

    const corps = new FormData();
    corps.append("photo", fichier);
    const succes = await action.executer(async () => {
      const nouveauProfil = await requete<Profil>("/identity/auth/moi/photo", {
        methode: "POST",
        corps,
      });
      actualiserProfil(nouveauProfil);
    });
    URL.revokeObjectURL(objetUrl);
    setPrevisualisation(null);
    if (!succes) return;
  };

  const retirer = async () => {
    await action.executer(async () => {
      const nouveauProfil = await requete<Profil>("/identity/auth/moi/photo", {
        methode: "DELETE",
      });
      actualiserProfil(nouveauProfil);
    });
  };

  const src = previsualisation || utilisateur.photo;

  return (
    <Carte
      titre="Photo de profil"
      sousTitre="Affichée dans l'en-tête et le menu de compte, sur toutes les applications du hub."
    >
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ardoise-100 text-lg font-semibold text-ardoise-600 dark:bg-ardoise-700 dark:text-ardoise-200">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- taille fixe, un simple aperçu.
            <img src={src} alt="" className="size-full object-cover" />
          ) : (
            initialesDepuis(utilisateur.nom_complet || utilisateur.identifiant)
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          {action.erreur ? <Alerte>{action.erreur}</Alerte> : null}
          <div className="flex gap-2">
            <Bouton
              type="button"
              variante="secondaire"
              taille="petite"
              onClick={() => entreeFichier.current?.click()}
              disabled={action.enCours}
            >
              {action.enCours ? "Envoi..." : utilisateur.photo ? "Changer la photo" : "Ajouter une photo"}
            </Bouton>
            {utilisateur.photo ? (
              <Bouton
                type="button"
                variante="discret"
                taille="petite"
                onClick={retirer}
                disabled={action.enCours}
              >
                Retirer
              </Bouton>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">JPG ou PNG, 5 Mo maximum.</p>
        </div>
      </div>
      <input
        ref={entreeFichier}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={deposer}
      />
    </Carte>
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

"use client";

/**
 * Page generique d'une application.
 *
 * Elle sert de preuve de bout en bout tant que les domaines ne sont pas
 * portes : le shell appelle le service correspondant a travers la passerelle,
 * le service verifie le jeton signe par identity, et renvoie les roles qu'il y
 * lit. Si cette page affiche vos roles, c'est que la chaine complete — compte
 * unique, signature, verification, cloisonnement par application — fonctionne.
 *
 * Chaque module remplacera ce contenu par son interface reelle.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Coquille } from "@/composants/Coquille";
import { ErreurApi } from "@/lib/api";
import { useSession } from "@/lib/session";

type Apercu = {
  service: string;
  libelle: string;
  utilisateur: { id: number; identifiant: string; nom_complet: string };
  roles: string[];
  est_superadmin: boolean;
};

export default function PageApplication() {
  return (
    <Coquille>
      <Contenu />
    </Coquille>
  );
}

function Contenu() {
  const parametres = useParams<{ chemin: string }>();
  const { profil, requete } = useSession();
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [erreur, setErreur] = useState("");

  const chemin = `/${parametres.chemin}`;
  const application = profil?.applications.find((item) => item.chemin === chemin);

  useEffect(() => {
    if (!application || application.code === "hub") return;
    let annule = false;
    setApercu(null);
    setErreur("");
    requete<Apercu>(`/${application.code}/apercu`)
      .then((reponse) => {
        if (!annule) setApercu(reponse);
      })
      .catch((probleme) => {
        if (annule) return;
        setErreur(
          probleme instanceof ErreurApi
            ? probleme.message
            : "Ce service ne repond pas.",
        );
      });
    return () => {
      annule = true;
    };
  }, [application, requete]);

  if (!profil) return null;

  // Le chemin ne correspond a aucune application ouverte a ce compte : on ne
  // distingue pas « n'existe pas » de « pas pour vous », il n'y a rien a
  // apprendre de cette difference.
  if (!application) {
    return (
      <div className="rounded-xl border border-dashed border-ardoise-200 p-8 text-center dark:border-ardoise-700">
        <h1 className="font-medium">Application indisponible</h1>
        <p className="mt-2 text-sm text-ardoise-500">
          Cette adresse ne correspond a aucune application ouverte a votre
          compte.
        </p>
        <Link
          href="/tableau-de-bord"
          className="mt-4 inline-block text-sm text-marque hover:underline"
        >
          Retour au tableau de bord
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-baseline gap-3">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: application.couleur || "#0f766e" }}
        />
        <h1 className="text-xl font-semibold tracking-tight">{application.nom}</h1>
      </div>
      <p className="mt-1 text-sm text-ardoise-500">{application.description}</p>

      {application.code === "hub" ? (
        <Encadre titre="Administration">
          La gestion des comptes, des habilitations et du journal des connexions
          se fait pour l&apos;instant par l&apos;API{" "}
          <code className="rounded bg-ardoise-100 px-1 dark:bg-ardoise-700">
            /api/identity/
          </code>{" "}
          et par l&apos;administration Django, sur{" "}
          <a href="/admin/" className="text-marque hover:underline">
            /admin/
          </a>
          .
        </Encadre>
      ) : erreur ? (
        <Encadre titre="Service injoignable" alerte>
          {erreur}
        </Encadre>
      ) : !apercu ? (
        <p className="mt-8 text-sm text-ardoise-500">Interrogation du service...</p>
      ) : (
        <Encadre titre="Liaison etablie">
          Le service <strong>{apercu.service}</strong> a verifie votre jeton et
          vous reconnait comme <strong>{apercu.utilisateur.nom_complet}</strong>.
          {apercu.roles.length > 0 ? (
            <>
              {" "}
              Vos roles sur cette application :{" "}
              <strong>{apercu.roles.join(", ")}</strong>.
            </>
          ) : apercu.est_superadmin ? (
            <> Vous y accedez comme administrateur general.</>
          ) : null}
          <span className="mt-3 block text-ardoise-500">
            Le module metier prendra la place de ce message.
          </span>
        </Encadre>
      )}
    </>
  );
}

function Encadre({
  titre,
  children,
  alerte = false,
}: {
  titre: string;
  children: React.ReactNode;
  alerte?: boolean;
}) {
  return (
    <div
      className={`mt-8 rounded-xl border p-6 text-sm ${
        alerte
          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          : "border-ardoise-200 bg-white dark:border-ardoise-700 dark:bg-ardoise-900"
      }`}
    >
      <h2 className="mb-2 font-medium">{titre}</h2>
      {children}
    </div>
  );
}

"use client";

/**
 * Le point d'entree apres la connexion : les applications auxquelles ce compte
 * a droit, et rien d'autre.
 *
 * La liste vient d'identity. Un compte sans habilitation voit une page vide et
 * un message explicite, plutot que des cartes grisees qui laisseraient croire
 * a une panne.
 */

import Link from "next/link";

import { Coquille } from "@/composants/Coquille";
import { useSession } from "@/lib/session";

export default function PageTableauDeBord() {
  return (
    <Coquille>
      <Contenu />
    </Coquille>
  );
}

function Contenu() {
  const { profil } = useSession();
  if (!profil) return null;

  const { utilisateur, applications } = profil;

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">
        Bonjour {utilisateur.nom_complet || utilisateur.identifiant}
      </h1>
      <p className="mt-1 text-sm text-ardoise-500">
        {applications.length === 0
          ? "Aucune application ne vous est encore ouverte."
          : `${applications.length} application${applications.length > 1 ? "s" : ""} a votre disposition.`}
      </p>

      {applications.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-ardoise-200 p-8 text-center text-sm text-ardoise-500 dark:border-ardoise-700">
          Votre compte est bien actif, mais aucune habilitation ne lui a encore
          ete accordee. Un administrateur de GDA Hub doit vous ouvrir les
          applications dont vous avez besoin.
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {applications.map((application) => (
            <Link
              key={application.code}
              href={application.chemin || "/tableau-de-bord"}
              className="group rounded-xl border border-ardoise-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md dark:border-ardoise-700 dark:bg-ardoise-900"
            >
              <span
                className="block h-1 w-10 rounded-full"
                style={{ backgroundColor: application.couleur || "#0f766e" }}
              />
              <h2 className="mt-4 font-medium">{application.nom}</h2>
              <p className="mt-1 text-sm text-ardoise-500">
                {application.description}
              </p>
              <p className="mt-4 text-xs text-ardoise-500">
                {application.roles.length > 0
                  ? `Votre role : ${application.roles.join(", ")}`
                  : "Acces en consultation"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

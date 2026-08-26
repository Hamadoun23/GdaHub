"use client";

/**
 * L'ossature commune a toutes les pages authentifiees.
 *
 * Elle porte deux responsabilites : rediriger vers la connexion quand la
 * session est absente, et afficher la barre de navigation. Le menu est
 * construit a partir des applications renvoyees par identity, jamais d'une
 * liste ecrite en dur : ajouter une application au groupe ne doit rien
 * demander au front.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { grouper } from "@/lib/groupes";
import { useSession } from "@/lib/session";

export function Coquille({ children }: { children: React.ReactNode }) {
  const { profil, chargement, deconnecter } = useSession();
  const routeur = useRouter();
  const chemin = usePathname();

  useEffect(() => {
    if (!chargement && !profil) routeur.replace("/connexion");
  }, [chargement, profil, routeur]);

  if (chargement) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ardoise-500">
        Chargement de votre espace...
      </div>
    );
  }

  if (!profil) return null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-ardoise-200 bg-white/80 backdrop-blur dark:border-ardoise-700 dark:bg-ardoise-900/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/tableau-de-bord" className="font-semibold tracking-tight">
            GDA <span className="text-marque">Hub</span>
          </Link>

          {/* Les sections sont separees par un filet plutot que par un titre :
              une barre horizontale n'a pas la place d'afficher « Board » et
              « Applications metier », mais la coupure suffit a faire lire les
              deux blocs comme distincts. */}
          <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
            {grouper(profil.applications).map((section, rang) => (
              <div key={section.titre} className="flex flex-wrap items-center gap-1">
                {rang > 0 ? (
                  <span
                    aria-hidden
                    className="mx-2 h-4 w-px bg-ardoise-200 dark:bg-ardoise-700"
                  />
                ) : null}
                {section.applications.map((application) => {
                  const cible = application.chemin || "/tableau-de-bord";
                  const actif = chemin === cible;
                  const classe = `rounded-md px-3 py-1.5 transition ${
                    actif
                      ? "bg-ardoise-100 font-medium dark:bg-ardoise-700"
                      : "text-ardoise-500 hover:bg-ardoise-100 dark:hover:bg-ardoise-700"
                  }`;

                  // Une application rassemblee n'appartient pas a cette
                  // coquille : c'est un autre serveur, derriere la passerelle.
                  // Un <Link> tenterait une navigation interne et tomberait
                  // sur une page inexistante ; il faut une vraie sortie.
                  return estExterieure(cible) ? (
                    <a
                      key={application.code}
                      href={cible}
                      title={section.titre || undefined}
                      className={classe}
                    >
                      {application.nom}
                    </a>
                  ) : (
                    <Link
                      key={application.code}
                      href={cible}
                      title={section.titre || undefined}
                      className={classe}
                    >
                      {application.nom}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            {/* Le nom mene au compte : c'est la ou l'on va pour changer son
                mot de passe, et c'est le premier endroit ou l'on clique. */}
            <Link
              href="/mon-compte"
              className={`rounded-md px-3 py-1.5 transition ${
                chemin === "/mon-compte"
                  ? "bg-ardoise-100 font-medium dark:bg-ardoise-700"
                  : "text-ardoise-500 hover:bg-ardoise-100 dark:hover:bg-ardoise-700"
              }`}
            >
              {profil.utilisateur.nom_complet}
            </Link>
            <button
              type="button"
              onClick={() => deconnecter().then(() => routeur.replace("/connexion"))}
              className="rounded-md border border-ardoise-200 px-3 py-1.5 transition hover:bg-ardoise-100 dark:border-ardoise-700 dark:hover:bg-ardoise-700"
            >
              Se deconnecter
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

/**
 * Les chemins qui ne sont pas servis par cette coquille.
 *
 * La passerelle monte chaque application rassemblee sous son prefixe. Ces
 * adresses existent bien sur la meme origine, mais elles sortent du routeur
 * de Next : elles se joignent par une navigation complete, pas par un lien
 * interne.
 */
const PREFIXES_EXTERIEURS = ["/rh/", "/jus/", "/bdm/"];

function estExterieure(chemin: string): boolean {
  return PREFIXES_EXTERIEURS.some(
    (prefixe) => chemin === prefixe.slice(0, -1) || chemin.startsWith(prefixe),
  );
}

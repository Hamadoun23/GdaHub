"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/rh/lib/auth";
import { initiales } from "@/rh/lib/format";
import { barreBassePour, menuPour } from "@/rh/lib/navigation";
import { Icone } from "./icones";
import { cx } from "./ui";

/** Un chemin designe cette entree, ou l'une de ses pages de detail. */
function estActif(chemin: string, href: string) {
  return chemin === href || chemin.startsWith(`${href}/`);
}

export function BarreLaterale({
  ouverte,
  onFermer,
}: {
  ouverte: boolean;
  onFermer: () => void;
}) {
  const { utilisateur } = useAuth();
  const chemin = usePathname();

  // Ouvert en tiroir sur telephone, le menu se referme a la touche d'echappement
  // et bloque le defilement de la page derriere lui — sinon le doigt fait
  // glisser le fond au lieu de la liste.
  useEffect(() => {
    if (!ouverte) return;
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") onFermer();
    };
    document.addEventListener("keydown", surTouche);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = "";
    };
  }, [ouverte, onFermer]);

  if (!utilisateur) return null;
  const groupes = menuPour(utilisateur);

  return (
    <>
      {ouverte && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={onFermer}
          aria-hidden="true"
        />
      )}
      <aside
        aria-label="Menu principal"
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-64 max-w-[86vw] flex-col border-r border-slate-200 bg-white transition-transform lg:max-w-none lg:translate-x-0",
          // Le tiroir touche les bords de l'ecran : il reprend les retraits
          // annonces par le systeme (encoche, barre de gestes).
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
          ouverte ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-4">
          <div>
            {/* Le logo seul ne dit pas ou l'on se trouve : la mention en
                dessous situe l'outil dans le systeme d'information. */}
            <Link
              href="/rh/tableau-de-bord"
              className="block"
              onClick={onFermer}
              aria-label="GD&A — accueil"
            >
              <Image
                src="/img/logo-gda.png"
                alt="GD&A"
                width={1340}
                height={510}
                priority
                className="h-8 w-auto"
              />
              <span className="mt-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                RH &amp; Finance
              </span>
            </Link>
          </div>
          {/* Refermer par le bord de l'ecran marche mal sur un grand
              telephone : une croix reste a portee du pouce. */}
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer le menu"
            className="-mr-1 rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groupes.map((groupe) => (
            <div key={groupe.titre}>
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {groupe.titre}
              </p>
              <div className="space-y-0.5">
                {groupe.entrees.map((entree) => {
                  const actif = estActif(chemin, entree.href);
                  return (
                    <Link
                      key={entree.href}
                      href={entree.href}
                      onClick={onFermer}
                      aria-current={actif ? "page" : undefined}
                      className={cx(
                        "flex items-center gap-2.5 rounded-lg border-l-[3px] px-2.5 py-2.5 text-sm transition lg:py-2",
                        actif
                          ? "border-marque-500 bg-marque-50 font-semibold text-marque-800"
                          : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      )}
                    >
                      <Icone nom={entree.icone} />
                      <span className="truncate">{entree.libelle}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export function BarreSuperieure({ titre }: { titre?: string }) {
  const { utilisateur, deconnecter } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6">
      {/* Sur telephone, la barre laterale est repliee : sans ce logo, aucun
          repere de marque ne subsiste a l'ecran. */}
      <Link href="/rh/tableau-de-bord" className="shrink-0 lg:hidden" aria-label="GD&A — accueil">
        <Image
          src="/img/logo-gda.png"
          alt="GD&A"
          width={1340}
          height={510}
          priority
          className="h-6 w-auto"
        />
      </Link>

      {titre && (
        <p className="truncate text-sm font-medium text-slate-700">{titre}</p>
      )}

      {/* Le retour au hub. Un lien complet et non un <Link> : l'accueil du hub
          est une page de la coquille, hors du perimetre de cette
          application. */}
      <a
        href="/"
        title="Revenir a GDA Hub"
        className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
      >
        <span aria-hidden>&larr;</span>
        GDA Hub
      </a>

      <div className="relative ml-auto sm:ml-0">
        <button
          type="button"
          onClick={() => setMenuOuvert((ouvert) => !ouvert)}
          aria-label="Compte et deconnexion"
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-slate-100"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-marque-100 text-xs font-semibold text-marque-700">
            {initiales(utilisateur?.nom_complet ?? "?")}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-medium text-slate-800">
              {utilisateur?.nom_complet}
            </span>
            <span className="block text-[11px] text-slate-500">
              {utilisateur?.poste}
            </span>
          </span>
        </button>

        {menuOuvert && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOuvert(false)}
              aria-hidden="true"
            />
            <div className="carte apparition absolute right-0 z-20 mt-1 w-60 p-1.5">
              <div className="px-2.5 py-2">
                <p className="text-sm font-medium text-slate-800">
                  {utilisateur?.nom_complet}
                </p>
                {utilisateur?.poste && (
                  <p className="text-xs text-slate-500">{utilisateur.poste}</p>
                )}
              </div>
              <Link
                href="/rh/mon-espace"
                onClick={() => setMenuOuvert(false)}
                className="block rounded-md px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Mon profil
              </Link>
              <button
                type="button"
                onClick={deconnecter}
                className="block w-full rounded-md px-2.5 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
              >
                Se deconnecter
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

/**
 * Barre d'onglets basse, sur telephone et tablette.
 *
 * Installee sur un ecran d'accueil, l'application est jugee a l'aune des
 * autres : on y attend une barre en bas, atteignable au pouce, et non un
 * menu cache derriere trois traits en haut a gauche. Les quatre destinations
 * du quotidien y figurent en clair ; « Plus » ouvre le menu complet.
 */
export function BarreBasse({ onOuvrirMenu }: { onOuvrirMenu: () => void }) {
  const { utilisateur } = useAuth();
  const chemin = usePathname();

  if (!utilisateur) return null;
  const entrees = barreBassePour(utilisateur);

  const styles = (actif: boolean) =>
    cx(
      "flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium transition",
      actif ? "text-marque-700" : "text-slate-500 hover:text-slate-800",
    );

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-0.5 border-t border-slate-200 bg-white/95 px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
    >
      {entrees.map((entree) => {
        const actif = estActif(chemin, entree.href);
        return (
          <Link
            key={entree.href}
            href={entree.href}
            aria-current={actif ? "page" : undefined}
            className={styles(actif)}
          >
            <Icone nom={entree.icone} className="size-5" />
            <span className="w-full truncate text-center leading-tight">
              {entree.libelle}
            </span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onOuvrirMenu}
        aria-label="Ouvrir le menu complet"
        className={styles(false)}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <span className="leading-tight">Plus</span>
      </button>
    </nav>
  );
}

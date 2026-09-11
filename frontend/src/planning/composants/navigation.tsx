"use client";

/**
 * L'identite visuelle propre de Planning : degrade orange en entete et
 * barre horizontale a onglets, reprises de la version d'origine construite
 * sur DocsERP/Planning-main (Laravel).
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Clapperboard, Menu, X } from "lucide-react";

import { cx } from "./ui";

export interface OngletPlanning {
  label: string;
  href: string;
  icon: LucideIcon;
}

function estActif(chemin: string, href: string) {
  return chemin === href || chemin.startsWith(`${href}/`);
}

export function EntetePlanning({
  onglets,
  nomAffiche,
  initiales,
  onDeconnexion,
}: {
  onglets: OngletPlanning[];
  nomAffiche: string;
  initiales: string;
  onDeconnexion: () => void;
}) {
  const chemin = usePathname();
  const routeur = useRouter();
  const [menuMobileOuvert, setMenuMobileOuvert] = useState(false);
  const [menuCompteOuvert, setMenuCompteOuvert] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 shadow-[0_2px_16px_rgba(0,0,0,0.12)]"
      style={{ background: "linear-gradient(135deg, #ff8a5c 0%, #ff6a3a 45%, #e8481b 100%)" }}
    >
      <div className="flex h-16 items-center gap-3 px-4 md:px-8">
        <button
          type="button"
          onClick={() => setMenuMobileOuvert((v) => !v)}
          className="rounded-md p-1.5 text-white/90 transition hover:bg-white/10 md:hidden"
          aria-label="Ouvrir le menu"
        >
          {menuMobileOuvert ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>

        <Link href="/planning" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 text-white">
            <Clapperboard className="size-5" />
          </span>
          <span className="hidden leading-tight text-white sm:block">
            <span className="block text-sm font-bold">GDA Media Planning</span>
            <span className="block text-[11px] font-medium text-white/80">Gestion des plannings</span>
          </span>
        </Link>

        <div className="flex-1" />

        <a
          href="/"
          title="Revenir a GDA Hub"
          className="hidden shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/75 transition hover:bg-white/10 hover:text-white sm:inline-flex"
        >
          <span aria-hidden>&larr;</span>
          GDA Hub
        </a>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuCompteOuvert((v) => !v)}
            className="flex items-center gap-2.5 rounded-full border border-white/25 bg-white/10 py-1 pl-1 pr-3.5 transition hover:border-white/35 hover:bg-white/20"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-white text-xs font-bold text-[#e8481b]">
              {initiales}
            </span>
            <span className="hidden text-sm font-medium text-white sm:block">{nomAffiche}</span>
          </button>

          {menuCompteOuvert && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuCompteOuvert(false)} aria-hidden="true" />
              <div className="absolute right-0 z-20 mt-2 min-w-[200px] rounded-[10px] border border-slate-200 bg-white p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
                <button
                  type="button"
                  onClick={onDeconnexion}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-[#e8481b] hover:bg-orange-50"
                >
                  Se deconnecter
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {onglets.length > 0 && (
        <nav
          className={cx(
            "flex-col gap-0.5 border-t border-white/15 px-2 pb-2 md:flex md:flex-row md:gap-1 md:px-6 md:pb-0",
            menuMobileOuvert ? "flex" : "hidden",
          )}
        >
          {onglets.map((onglet) => {
            const actif = estActif(chemin, onglet.href);
            const Icon = onglet.icon;
            return (
              <Link
                key={onglet.href}
                href={onglet.href}
                onClick={() => setMenuMobileOuvert(false)}
                className={cx(
                  "flex items-center gap-2 rounded-t-lg px-3.5 py-2.5 text-sm font-semibold transition md:py-3",
                  actif
                    ? "bg-white text-[#e8481b]"
                    : "text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {onglet.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}

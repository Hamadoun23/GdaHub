"use client";

/**
 * L'identite visuelle propre de Chantiers, reprise de daily.gdamali.net
 * (Laravel, DocsERP/dailygda/public/css/gda.css) : entete sombre avec
 * banniere de chantier en fond, barre laterale claire avec commutateur de
 * projet. Palette : creme #f4f1eb, terracotta #c8521a, titre marron #381419.
 */

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Menu, X } from "lucide-react";

import { cx } from "./ui";

export interface EntreeNavChantier {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface GroupeNavChantier {
  cle: string;
  label: string;
  items: EntreeNavChantier[];
}

function estActif(chemin: string, href: string) {
  return chemin === href || chemin.startsWith(`${href}/`);
}

const FOND_ENTETE = {
  backgroundColor: "#1a1814",
  backgroundImage: [
    "linear-gradient(90deg, rgba(22,18,16,.82) 0%, rgba(22,18,16,.42) 38%, rgba(22,18,16,.38) 62%, rgba(22,18,16,.8) 100%)",
    "linear-gradient(to bottom, transparent 55%, rgba(22,18,16,.75) 82%, #1a1814 100%)",
    "url(/img/chantiers/banniere.png)",
  ].join(", "),
  backgroundSize: "88% auto",
  backgroundPosition: "center 22%",
  backgroundRepeat: "no-repeat",
} as const;

export function EnteteChantiers({
  projetLabel,
  nomAffiche,
  initiales,
  onOuvrirMenu,
  onDeconnexion,
}: {
  projetLabel?: string;
  nomAffiche: string;
  initiales: string;
  onOuvrirMenu: () => void;
  onDeconnexion: () => void;
}) {
  const [menuCompteOuvert, setMenuCompteOuvert] = useState(false);

  return (
    <header
      className="fixed inset-x-0 top-0 z-40 flex h-20 items-center gap-4 px-4 shadow-[0_2px_16px_rgba(0,0,0,0.2)] md:h-24 md:px-8"
      style={FOND_ENTETE}
    >
      <button
        type="button"
        onClick={onOuvrirMenu}
        className="rounded-md p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white lg:hidden"
        aria-label="Ouvrir le menu"
      >
        <Menu className="size-5" />
      </button>

      <Link href="/chantiers" className="flex shrink-0 items-center gap-2.5">
        <Image
          src="/img/chantiers/logo.png"
          alt="GD&A Construction"
          width={160}
          height={60}
          priority
          className="h-8 w-auto md:h-9"
        />
      </Link>

      {projetLabel && (
        <>
          <span className="hidden h-11 w-px shrink-0 bg-white/10 sm:block" />
          <span
            className="hidden truncate text-xs font-medium uppercase tracking-wider text-white sm:block"
            style={{ maxWidth: "min(240px, 22vw)", textShadow: "0 1px 4px rgba(0,0,0,.55)" }}
          >
            {projetLabel}
          </span>
        </>
      )}

      <div className="flex-1" />

      <a
        href="/"
        title="Revenir a GDA Hub"
        className="hidden shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/55 transition hover:bg-white/10 hover:text-white sm:inline-flex"
      >
        <span aria-hidden>&larr;</span>
        GDA Hub
      </a>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuCompteOuvert((v) => !v)}
          className="flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 py-1 pl-1 pr-3.5 transition hover:border-white/30 hover:bg-white/20"
        >
          <span
            className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: "#c8521a" }}
          >
            {initiales}
          </span>
          <span className="hidden text-sm font-medium text-white sm:block">{nomAffiche}</span>
        </button>

        {menuCompteOuvert && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuCompteOuvert(false)} aria-hidden="true" />
            <div
              className="absolute right-0 z-20 mt-2 min-w-[200px] rounded-[10px] border p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
              style={{ background: "#ffffff", borderColor: "#d5cfc2" }}
            >
              <button
                type="button"
                onClick={onDeconnexion}
                className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-[#ede9e0]"
                style={{ color: "#c8521a" }}
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

export function BarreLateraleChantiers({
  groupes,
  ouverte,
  onFermer,
  commutateurProjet,
}: {
  groupes: GroupeNavChantier[];
  ouverte: boolean;
  onFermer: () => void;
  commutateurProjet?: React.ReactNode;
}) {
  const chemin = usePathname();

  useEffect(() => {
    if (!ouverte) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    document.addEventListener("keydown", surTouche);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = "";
    };
  }, [ouverte, onFermer]);

  return (
    <>
      {ouverte && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={onFermer} aria-hidden="true" />
      )}
      <aside
        className={cx(
          "fixed bottom-0 left-0 top-20 z-40 flex w-64 max-w-[86vw] flex-col overflow-y-auto border-r transition-transform md:top-24 lg:translate-x-0",
          ouverte ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ background: "#ffffff", borderColor: "#d5cfc2" }}
      >
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer le menu"
          className="absolute right-2 top-2 rounded-md p-2 text-[#8a8070] hover:bg-[#ede9e0] lg:hidden"
        >
          <X className="size-4" />
        </button>

        {commutateurProjet}

        <nav className="flex-1 space-y-1 px-3 py-2">
          {groupes.map((groupe) => (
            <div key={groupe.cle}>
              <p
                className="px-2.5 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[2px]"
                style={{ color: "#8a8070" }}
              >
                {groupe.label}
              </p>
              <div className="space-y-0.5">
                {groupe.items.map((item) => {
                  const actif = estActif(chemin, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onFermer}
                      className="flex items-center gap-2.5 rounded-lg border-l-[3px] px-2.5 py-2.5 text-sm transition lg:py-2"
                      style={
                        actif
                          ? { borderColor: "#c8521a", background: "#f9ece4", color: "#381419", fontWeight: 600 }
                          : { borderColor: "transparent", color: "#4a4438" }
                      }
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
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

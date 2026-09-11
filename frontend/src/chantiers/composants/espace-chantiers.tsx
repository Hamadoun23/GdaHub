"use client";

/**
 * L'espace Chantiers : identite visuelle propre (entete sombre + banniere,
 * barre laterale claire avec commutateur de projet), reprise de
 * daily.gdamali.net — voir navigation.tsx pour le detail de la palette.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  ClipboardList,
  Cloud,
  Compass,
  FileText,
  History,
  LayoutDashboard,
  ListTree,
  PencilLine,
} from "lucide-react";

import { useSession } from "@/lib/session";
import { EnteteChantiers, BarreLateraleChantiers, type GroupeNavChantier } from "./navigation";
import type { Projet } from "../lib/types";

/** Roles qui valent equipe interne — cf. hub.UtilisateurHub.ROLES_INTERNES cote Django. */
const ROLES_INTERNES = new Set(["admin", "chef_chantier", "ingenieur", "controle_qualite"]);

export function useEstPartenaire() {
  const { profil } = useSession();
  if (!profil) return false;
  if (profil.utilisateur.est_superadmin) return false;
  const roles = profil.applications.find((a) => a.code === "daily")?.roles ?? [];
  return roles.includes("partenaire") && !roles.some((r) => ROLES_INTERNES.has(r));
}

function initialesDepuis(nom: string) {
  return nom
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0])
    .join("")
    .toUpperCase();
}

export function EspaceChantiers({
  projet,
  projets,
  children,
}: {
  projet?: Projet;
  projets?: Projet[];
  children: React.ReactNode;
}) {
  const { profil, deconnecter } = useSession();
  const routeur = useRouter();
  const estPartenaire = useEstPartenaire();
  const [menuOuvert, setMenuOuvert] = useState(false);

  const racine = projet ? `/chantiers/${projet.id}` : undefined;

  const items = racine
    ? [
        { label: "Tableau de bord", href: racine, icon: LayoutDashboard },
        ...(!estPartenaire
          ? [{ label: "Saisie du jour", href: `${racine}/saisie`, icon: PencilLine }]
          : []),
        { label: "Toutes les taches", href: `${racine}/taches`, icon: ClipboardList },
        ...(!estPartenaire
          ? [{ label: "Galerie photos", href: `${racine}/photos`, icon: Camera }]
          : []),
        ...(!estPartenaire ? [{ label: "Structure", href: `${racine}/structure`, icon: ListTree }] : []),
        ...(!estPartenaire
          ? [{ label: "Journal d'activite", href: `${racine}/journal`, icon: History }]
          : []),
      ]
    : [];

  const previsions = racine
    ? [
        { label: "Previsions meteo", href: `${racine}/meteo`, icon: Cloud },
        { label: "Rapport PDF", href: `${racine}/rapport`, icon: FileText },
      ]
    : [];

  const groupes: GroupeNavChantier[] = [
    { cle: "navigation", label: estPartenaire ? "Espace partenaire" : "Navigation", items },
    { cle: "previsions", label: "Previsions", items: previsions },
    ...(!estPartenaire
      ? [
          {
            cle: "autre",
            label: "Autre",
            items: [{ label: "Tous les chantiers", href: "/chantiers", icon: Compass }],
          },
        ]
      : []),
  ].filter((g) => g.items.length > 0);

  const nomAffiche = profil?.utilisateur.nom_complet || profil?.utilisateur.identifiant || "—";

  const commutateurProjet =
    projet && projets && !estPartenaire ? (
      <div className="border-b px-4 pb-3.5 pt-4" style={{ borderColor: "#d5cfc2" }}>
        <label
          htmlFor="commutateur-projet"
          className="mb-1.5 block text-[10px] font-bold uppercase tracking-[2px]"
          style={{ color: "#8a8070" }}
        >
          Projet actif
        </label>
        <select
          id="commutateur-projet"
          value={projet.id}
          onChange={(e) => routeur.push(`/chantiers/${e.target.value}`)}
          className="w-full rounded-[10px] border px-3 py-2.5 text-sm font-semibold outline-none"
          style={{ borderColor: "#d5cfc2", background: "#ffffff", color: "#1a1814" }}
        >
          {projets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    ) : undefined;

  return (
    <div className="min-h-screen" style={{ background: "#f4f1eb" }}>
      <EnteteChantiers
        projetLabel={projet?.name}
        nomAffiche={nomAffiche}
        initiales={initialesDepuis(nomAffiche)}
        onOuvrirMenu={() => setMenuOuvert(true)}
        onDeconnexion={() => deconnecter().then(() => routeur.replace("/connexion"))}
      />
      <BarreLateraleChantiers
        groupes={groupes}
        ouverte={menuOuvert}
        onFermer={() => setMenuOuvert(false)}
        commutateurProjet={commutateurProjet}
      />
      <main className="pt-20 md:pt-24 lg:pl-64">
        <div className="px-4 py-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}

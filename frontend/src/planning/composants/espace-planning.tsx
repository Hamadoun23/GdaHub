"use client";

/**
 * L'espace Planning : degrade orange en entete + barre horizontale a
 * onglets, identite propre reprise de DocsERP/Planning-main.
 */

import { useRouter } from "next/navigation";
import { LayoutDashboard, Lightbulb, Megaphone, Users, Video } from "lucide-react";

import { useSession } from "@/lib/session";
import { EntetePlanning, type OngletPlanning } from "./navigation";

/** Un compte « client » (ni admin, ni team) — cf. `hub.UtilisateurHub.est_client` cote Django. */
export function useRolePlanning() {
  const { profil } = useSession();
  const roles = profil?.habilitations?.["planning"] ?? [];
  const estSuperadmin = Boolean(profil?.utilisateur.est_superadmin);
  const estClient = !estSuperadmin && roles.includes("client") && !roles.some((r) => r === "admin" || r === "team");
  const peutEcrire = estSuperadmin || roles.includes("admin");
  return { estClient, peutEcrire, roles };
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

export function EspacePlanning({ children }: { children: React.ReactNode }) {
  const { profil, deconnecter } = useSession();
  const routeur = useRouter();
  const { estClient } = useRolePlanning();

  const onglets: OngletPlanning[] = estClient
    ? []
    : [
        { label: "Tableau de bord", href: "/planning", icon: LayoutDashboard },
        { label: "Clients", href: "/planning/clients", icon: Users },
        { label: "Idées de contenu", href: "/planning/idees-contenu", icon: Lightbulb },
        { label: "Tournages", href: "/planning/tournages", icon: Video },
        { label: "Publications", href: "/planning/publications", icon: Megaphone },
      ];

  const nomAffiche = profil?.utilisateur.nom_complet || profil?.utilisateur.identifiant || "—";

  return (
    <div className="min-h-screen bg-[#f4f1eb]">
      <EntetePlanning
        onglets={onglets}
        nomAffiche={nomAffiche}
        initiales={initialesDepuis(nomAffiche)}
        onDeconnexion={() => deconnecter().then(() => routeur.replace("/connexion"))}
      />
      <main className="px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}

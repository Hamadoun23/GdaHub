"use client";

/**
 * L'espace Planning, compose sur la coquille d'application partagee.
 *
 * Remplace l'ancien degrade orange + onglets horizontaux (navigation.tsx) :
 * Planning adopte desormais le meme habillage que les autres applications
 * du hub.
 */

import { useRouter } from "next/navigation";
import { Clapperboard, LayoutDashboard, Lightbulb, Megaphone, Users, Video } from "lucide-react";

import { useSession } from "@/lib/session";
import { EspaceApplication } from "@/composants/coquille-app/espace-application";
import { initialesDepuis } from "@/composants/coquille-app/initiales";
import type { GroupeNav } from "@/composants/coquille-app/types";

/** Un compte « client » (ni admin, ni team) — cf. `hub.UtilisateurHub.est_client` cote Django. */
export function useRolePlanning() {
  const { profil } = useSession();
  const roles = profil?.habilitations?.["planning"] ?? [];
  const estSuperadmin = Boolean(profil?.utilisateur.est_superadmin);
  const estClient = !estSuperadmin && roles.includes("client") && !roles.some((r) => r === "admin" || r === "team");
  const peutEcrire = estSuperadmin || roles.includes("admin");
  return { estClient, peutEcrire, roles };
}

export function EspacePlanning({ children }: { children: React.ReactNode }) {
  const { profil, deconnecter } = useSession();
  const routeur = useRouter();
  const { estClient } = useRolePlanning();

  const groupes: GroupeNav[] = estClient
    ? []
    : [
        {
          cle: "navigation",
          label: "Navigation",
          couleur: "bg-primary",
          items: [
            { label: "Tableau de bord", href: "/planning", icon: LayoutDashboard },
            { label: "Clients", href: "/planning/clients", icon: Users },
            { label: "Idées de contenu", href: "/planning/idees-contenu", icon: Lightbulb },
            { label: "Tournages", href: "/planning/tournages", icon: Video },
            { label: "Publications", href: "/planning/publications", icon: Megaphone },
          ],
        },
      ];

  const nomAffiche = profil?.utilisateur.nom_complet || profil?.utilisateur.identifiant || "—";

  return (
    <EspaceApplication
      nomApp="GDA Media Planning"
      sousTitre="Gestion des plannings"
      icone={Clapperboard}
      groupes={groupes}
      pied="Planification de contenu"
      utilisateur={{
        nomAffiche,
        initiales: initialesDepuis(nomAffiche),
        estAdmin: profil?.utilisateur.est_superadmin,
        photoUrl: profil?.utilisateur.photo,
      }}
      onDeconnexion={() => deconnecter().then(() => routeur.replace("/connexion"))}
      rechercheVisible={false}
    >
      {children}
    </EspaceApplication>
  );
}

"use client";

/**
 * L'espace Jus d'orange, compose sur la coquille d'application partagee.
 *
 * Remplace les anciens `app-sidebar.tsx`/`app-header.tsx` : la mise en page
 * elle-meme vient de `composants/coquille-app`, ce module n'apporte que ce
 * qui est propre a Jus d'orange (sa navigation, ses roles, sa session).
 */

import { useRouter, usePathname } from "next/navigation";
import { Citrus } from "lucide-react";
import { toast } from "sonner";
import { EspaceApplication } from "@/composants/coquille-app/espace-application";
import { initialesDepuis } from "@/composants/coquille-app/initiales";
import { useSession } from "@/lib/session";
import { useAuth } from "@/jus/lib/auth";
import { canAccess } from "@/jus/lib/access";
import { navigation, roleMeta, type Role } from "@/jus/lib/nav";

function currentRole(pathname: string): Role {
  // Servie dans GDA Hub, l'application vit sous « /jus » : le premier segment
  // est ce prefixe, et non la section. On cherche donc parmi tous les
  // segments celui qui designe un espace.
  const segments = pathname.split("/").filter(Boolean);
  const match = navigation.find((g) => segments.includes(g.role));
  return (match?.role ?? "direction") as Role;
}

export function EspaceJus({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  // Le nom et la photo affiches viennent du hub — « Mon compte » — plutot que
  // du compte propre a Jus d'orange : un seul endroit pour editer son
  // identite, pas deux susceptibles de diverger.
  const { profil } = useSession();
  const role = currentRole(pathname);
  const meta = roleMeta[role];

  const groupes = navigation
    .map((g) => ({
      cle: g.role,
      label: g.label,
      couleur: roleMeta[g.role].color,
      items: g.items.filter((item) => canAccess(item.href, user)),
    }))
    .filter((g) => g.items.length > 0);

  const nomAffiche = profil?.utilisateur.nom_complet || user?.username || "—";

  function onDeconnexion() {
    logout();
    toast.success("Déconnexion réussie");
    router.replace("/connexion");
  }

  return (
    <EspaceApplication
      nomApp="JusOrange"
      sousTitre="Pilotage production"
      icone={Citrus}
      groupes={groupes}
      pied="JusOrange · Campagne 2026"
      badgeLabel={`Espace ${meta.label}`}
      badgeCouleur={meta.color}
      utilisateur={{
        nomAffiche,
        sousLabel: (user?.roles ?? []).join(", "),
        initiales: initialesDepuis(nomAffiche),
        estAdmin: user?.is_superuser,
        photoUrl: profil?.utilisateur.photo,
      }}
      onDeconnexion={onDeconnexion}
    >
      {children}
    </EspaceApplication>
  );
}

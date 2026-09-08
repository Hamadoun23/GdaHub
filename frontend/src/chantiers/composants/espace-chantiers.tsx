"use client";

/**
 * L'espace Chantiers, compose sur la coquille d'application partagee.
 *
 * Remplace l'ancienne entete sombre + banniere de chantier (navigation.tsx) :
 * Chantiers adopte desormais le meme habillage que les autres applications
 * du hub — uniformiser, c'est renoncer a sa propre identite visuelle au
 * profit d'un seul systeme, partage par tous.
 */

import { useRouter } from "next/navigation";
import {
  Camera,
  ClipboardList,
  Cloud,
  Compass,
  FileText,
  HardHat,
  History,
  LayoutDashboard,
  ListTree,
  PencilLine,
} from "lucide-react";

import { useSession } from "@/lib/session";
import { EspaceApplication } from "@/composants/coquille-app/espace-application";
import { initialesDepuis } from "@/composants/coquille-app/initiales";
import type { GroupeNav } from "@/composants/coquille-app/types";
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

  const groupes: GroupeNav[] = [
    { cle: "navigation", label: estPartenaire ? "Espace partenaire" : "Navigation", couleur: "bg-primary", items },
    { cle: "previsions", label: "Previsions", couleur: "bg-blue-500", items: previsions },
    ...(!estPartenaire
      ? [
          {
            cle: "autre",
            label: "Autre",
            couleur: "bg-muted-foreground",
            items: [{ label: "Tous les chantiers", href: "/chantiers", icon: Compass }],
          },
        ]
      : []),
  ].filter((g) => g.items.length > 0);

  const nomAffiche = profil?.utilisateur.nom_complet || profil?.utilisateur.identifiant || "—";

  return (
    <EspaceApplication
      nomApp="Chantiers"
      sousTitre="Gestion des chantiers"
      icone={HardHat}
      groupes={groupes}
      pied={projet ? `${projet.name} · ${projet.tasks_count} tache${projet.tasks_count > 1 ? "s" : ""}` : undefined}
      badgeLabel={projet?.name}
      utilisateur={{
        nomAffiche,
        initiales: initialesDepuis(nomAffiche),
        estAdmin: profil?.utilisateur.est_superadmin,
        photoUrl: profil?.utilisateur.photo,
      }}
      onDeconnexion={() => deconnecter().then(() => routeur.replace("/connexion"))}
      rechercheVisible={false}
      avantGroupes={
        projet && projets && !estPartenaire ? (
          <div className="border-b border-sidebar-border px-4 py-3">
            <label htmlFor="commutateur-projet" className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
              Projet actif
            </label>
            <select
              id="commutateur-projet"
              value={projet.id}
              onChange={(e) => routeur.push(`/chantiers/${e.target.value}`)}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-medium outline-none focus:border-primary"
            >
              {projets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : undefined
      }
    >
      {children}
    </EspaceApplication>
  );
}

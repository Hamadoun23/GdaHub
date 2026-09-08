"use client";

/**
 * L'ossature commune a toutes les pages authentifiees.
 *
 * Elle porte deux responsabilites : rediriger vers la connexion quand la
 * session est absente, et afficher la navigation. Le menu est construit a
 * partir des applications renvoyees par identity, jamais d'une liste ecrite
 * en dur : ajouter une application au groupe ne doit rien demander au front.
 *
 * Le hub compose la meme coquille partagee (`composants/coquille-app`) que
 * Jus d'orange, RH, Chantiers et Planning — une sidebar, pas le bandeau
 * horizontal d'avant. Le "retour au hub" de l'entete est masque ici : on y
 * est deja.
 *
 * Identite sombre : reservee a la seule barre laterale (`coquille-app/
 * barre-laterale.tsx`), comme la maquette de reference "Virtus" — sidebar
 * sombre unie, entete et canevas clairs. Le hub ne porte donc plus aucun
 * habillage sombre a ce niveau, y compris pour l'ecran de chargement.
 */

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Home } from "lucide-react";

import { EspaceApplication } from "@/composants/coquille-app/espace-application";
import { initialesDepuis } from "@/composants/coquille-app/initiales";
import type { GroupeNav } from "@/composants/coquille-app/types";
import { grouper } from "@/lib/groupes";
import { iconePourApplication } from "@/lib/icones-applications";
import { useSession } from "@/lib/session";

const PALETTE_GROUPE = ["bg-primary", "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500"];

// `IconeComposant` accepte n'importe quel composant qui prend une `className`
// — une icone lucide ou, ici, le logo GDA. C'est ce badge en haut de la
// barre laterale (les « 4 carres ») que l'utilisateur a demande de
// remplacer par le vrai logo plutot qu'une icone generique.
function LogoGDA({ className }: { className?: string }) {
  // Le badge parent (`size-9`, 36px) ne laisse a l'icone que `size-5` (20px) :
  // trop petit pour que le trait fin du logo (aile + texte script) reste
  // lisible — a cette taille il devenait un pate uniforme. `-inset-2`
  // agrandit le badge blanc jusqu'aux 36px du parent (20 + 8 de chaque cote),
  // sans toucher au composant partage : seul ce badge-ci, pas les icones des
  // autres applications.
  return (
    <span className={`relative block ${className || ""}`}>
      <span className="absolute -inset-2 overflow-hidden rounded-lg bg-white">
        <Image src="/img/logo-gda-carre.png" alt="GDA" fill className="object-contain p-1" />
      </span>
    </span>
  );
}

export function Coquille({ children }: { children: React.ReactNode }) {
  const { profil, chargement, deconnecter } = useSession();
  const routeur = useRouter();
  const chemin = usePathname();

  useEffect(() => {
    if (!chargement && !profil) routeur.replace("/connexion");
  }, [chargement, profil, routeur]);

  const groupes: GroupeNav[] = useMemo(() => {
    if (!profil) return [];
    const dynamiques = grouper(profil.applications).map((section, rang) => ({
      cle: section.titre || `section-${rang}`,
      label: section.titre || "Applications",
      couleur: PALETTE_GROUPE[rang % PALETTE_GROUPE.length],
      items: section.applications.map((application) => ({
        label: application.nom,
        href: application.chemin || "/tableau-de-bord",
        icon: iconePourApplication(application.code),
        externe: (application.chemin || "").startsWith("/campagnes"),
      })),
    }));
    // Toujours en tete, avant les applications elles-memes : le seul moyen de
    // revenir au tableau de bord une fois parti dessus vers une application.
    const accueil: GroupeNav = {
      cle: "accueil",
      label: "Accueil",
      couleur: "bg-ardoise-400",
      items: [{ label: "Accueil", href: "/tableau-de-bord", icon: Home }],
    };
    return [accueil, ...dynamiques];
  }, [profil]);

  const badgeLabel = useMemo(() => {
    if (!profil) return undefined;
    return profil.applications.find((application) => application.chemin === chemin)?.nom;
  }, [profil, chemin]);

  if (chargement) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-muted-foreground">
        Chargement de votre espace...
      </div>
    );
  }

  if (!profil) return null;

  const { utilisateur } = profil;

  return (
    <EspaceApplication
      nomApp="GDA Hub"
      sousTitre="Espace connecte"
      icone={LogoGDA}
      groupes={groupes}
      badgeLabel={badgeLabel}
      retourHubVisible={false}
      utilisateur={{
        nomAffiche: utilisateur.nom_complet || utilisateur.identifiant,
        sousLabel: utilisateur.fonction,
        initiales: initialesDepuis(utilisateur.nom_complet || utilisateur.identifiant),
        estAdmin: utilisateur.est_superadmin,
        photoUrl: utilisateur.photo,
      }}
      onDeconnexion={() => deconnecter().then(() => routeur.replace("/connexion"))}
    >
      {children}
    </EspaceApplication>
  );
}

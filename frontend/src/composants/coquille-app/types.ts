import type { ComponentType } from "react";

/**
 * N'importe quel composant d'icone acceptant une classe — une icone
 * lucide-react (Jus d'orange, Chantiers, Planning) ou un composant maison
 * (le trace SVG dessine a la main de FinanceRH). Le rendu ne differencie pas
 * les deux : seule la classe passee compte.
 */
export type IconeComposant = ComponentType<{ className?: string }>;

/** Un lien de la barre laterale. */
export type ElementNav = {
  label: string;
  href: string;
  icon: IconeComposant;
  /** Vrai pour un lien hors du routeur Next (Campagnes, encore en Inertia/Vite) :
   * rend une ancre classique plutot qu'un <Link>, pour forcer une navigation
   * complete au lieu d'une navigation client qui n'a pas de page a afficher. */
  externe?: boolean;
};

/** Un groupe de liens, avec sa puce de couleur et son intitule. */
export type GroupeNav = {
  cle: string;
  label: string;
  couleur: string; // classe Tailwind de fond, ex. "bg-primary"
  items: ElementNav[];
};

export type InfosUtilisateur = {
  nomAffiche: string;
  sousLabel?: string;
  initiales: string;
  estAdmin?: boolean;
  photoUrl?: string | null;
};

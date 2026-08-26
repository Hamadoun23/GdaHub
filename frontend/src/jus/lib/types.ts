import type { ComponentType, ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
};

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "textarea"
  | "select"
  | "checkbox";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  /**
   * Clé du payload /api/options/ alimentant cette liste déroulante
   * (ex. "cueillettes_disponibles"). Évite de demander un identifiant
   * numérique à l'utilisateur, comme le faisaient les formulaires Django.
   */
  optionsFrom?: string;
  placeholder?: string;
  required?: boolean;
  colSpan?: 1 | 2;
  hint?: string;
  /** Masque le champ lors d'une modification (ex. le type d'un article). */
  hideOnEdit?: boolean;
};

// Action métier proposée sur une ligne, en plus de Modifier/Supprimer.
// Reproduit les workflows dédiés de Django : compléter une production,
// actualiser un stock, saisir une observation d'inventaire…
export type RowAction<T> = {
  key: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** Masque l'action quand elle n'a pas de sens sur cette ligne. */
  available?: (row: T) => boolean;
  /** Champs du formulaire ouvert par l'action. */
  fields: Field[];
  /** Valeurs pré-remplies à l'ouverture. */
  initial?: (row: T) => Record<string, string | boolean>;
  /** Segment d'URL appelé : `<endpoint>/<id>/<action>/`. */
  action: string;
  toApi?: (values: Record<string, string | boolean>) => Record<string, unknown>;
  title: (row: T) => string;
  description?: string;
  successMessage?: string;
};

// Une "ressource" CRUD : tout ce qu'il faut pour générer une vue liste + formulaire.
export type Resource<T extends { id: string | number }> = {
  key: string;
  title: string;
  singular: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  columns: Column<T>[];
  fields: Field[];
  searchable: (row: T) => string;
  newLabel?: string;
  // Endpoint API REST (ex: "producteurs"). Si absent, on utilise `rows` (démo).
  endpoint?: string;
  rows?: T[];
  // Actions métier propres à la ressource (compléter, actualiser…).
  actions?: RowAction<T>[];
  /** false quand les lignes naissent d'un autre process (ex. les bouteilles). */
  canCreate?: boolean;
  /** false quand la ressource ne se modifie que par des actions dédiées. */
  canEdit?: boolean;
  /** Champs affichés uniquement à la création (process « programmer » en 2 temps). */
  createFields?: Field[];
  /** Compteurs affichés au-dessus du tableau, comme les vues Django. */
  stats?: (rows: T[]) => { label: string; value: string | number }[];
  /** Lien vers la fiche détaillée : rend la première colonne cliquable. */
  rowHref?: (row: T) => string;
  // Transforme un objet JSON de l'API en ligne typée T.
  fromApi?: (o: Record<string, unknown>) => T;
  // Transforme les valeurs du formulaire avant envoi à l'API (ex: cast numérique).
  toApi?: (values: Record<string, string | boolean>) => Record<string, unknown>;
};

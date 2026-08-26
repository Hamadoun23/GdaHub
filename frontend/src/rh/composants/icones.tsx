/** Jeu d'icones au trait, resolues par cle depuis le manifeste de navigation. */

import { cx } from "./ui";

const TRACES: Record<string, string> = {
  accueil: "M4 11.5 12 4l8 7.5M6 10v9h12v-9",
  valider: "m5 13 4 4L19 7",
  conge: "M8 3v4m8-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  presence: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  // Une sortie autorisee : la permission n'est ni un conge (calendrier) ni un
  // retard (horloge), l'icone doit se distinguer des deux au premier coup d'oeil.
  permission: "M14 12H3m0 0 3.5-3.5M3 12l3.5 3.5M10 4h9a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-9",
  demande: "M9 4h6l1 3h3v13H5V7h3l1-3Zm-1 8h8m-8 4h5",
  formation: "M12 4 2 9l10 5 10-5-10-5Zm-6 8v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5",
  evaluation: "m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8L12 4Z",
  annuaire:
    "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8",
  indicateur: "M4 20h16M7 16V9m5 7V5m5 11v-4",
  requisition: "M9 4h6l1 3h3v13H5V7h3l1-3Zm-1 8h8m-8 4h5",
  achat: "M6 6h15l-1.5 9h-12L6 6Zm0 0-.7-3H2m7 18a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  caisse: "M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Zm0 0 2.5-4h13L21 8M16 14h2",
  depense: "M12 3v18m4-14H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H7",
  mission: "M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Zm9 9a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  prestation:
    "M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-11 0h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z",
  communication: "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm4 15h2",
  seuil: "M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4M11 16v4",
  profil: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  equipe:
    "M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm11 10v-2a4 4 0 0 0-3-3.9",
  alerte: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  fleche: "m9 6 6 6-6 6",
  plus: "M12 5v14M5 12h14",
};

export function Icone({
  nom,
  className,
}: {
  nom: string;
  className?: string;
}) {
  const trace = TRACES[nom] ?? TRACES.accueil;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("size-4 shrink-0", className)}
      aria-hidden="true"
    >
      <path d={trace} />
    </svg>
  );
}

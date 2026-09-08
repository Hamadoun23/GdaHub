"use client";

import * as React from "react";

/**
 * Anneau de progression SVG — sert a montrer un taux (connexions reussies,
 * part urgente...) sans dependre de recharts pour un simple pourcentage : un
 * cercle trace a la main suffit, colore avec une couleur CSS unie (hex ou
 * var()) ou un degrade a deux arrets (repris du composant `CircularProgress`
 * de la reference "Virtus" — `GdaHub/assets/dash/parClaudeCodeDesktop`).
 */
export function AnneauProgression({
  valeur,
  taille = 96,
  epaisseur = 8,
  couleur = "white",
  degrade,
  pisteCouleur = "rgba(255,255,255,0.12)",
  children,
}: {
  valeur: number;
  taille?: number;
  epaisseur?: number;
  couleur?: string;
  /** Deux couleurs pour un trait en degrade, en alternative a `couleur`. */
  degrade?: [string, string];
  pisteCouleur?: string;
  children?: React.ReactNode;
}) {
  const rayon = (taille - epaisseur) / 2;
  const circonference = 2 * Math.PI * rayon;
  const pourcentage = Math.min(Math.max(valeur, 0), 100);
  const decalage = circonference * (1 - pourcentage / 100);
  const idDegrade = React.useId();
  const trait = degrade ? `url(#${idDegrade})` : couleur;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: taille, height: taille }}>
      <svg width={taille} height={taille} className="-rotate-90">
        {degrade && (
          <defs>
            <linearGradient id={idDegrade} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={degrade[0]} />
              <stop offset="100%" stopColor={degrade[1]} />
            </linearGradient>
          </defs>
        )}
        <circle cx={taille / 2} cy={taille / 2} r={rayon} fill="none" stroke={pisteCouleur} strokeWidth={epaisseur} />
        <circle
          cx={taille / 2}
          cy={taille / 2}
          r={rayon}
          fill="none"
          stroke={trait}
          strokeWidth={epaisseur}
          strokeDasharray={circonference}
          strokeDashoffset={decalage}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

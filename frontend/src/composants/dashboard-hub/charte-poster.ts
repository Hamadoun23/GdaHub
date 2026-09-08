/**
 * Palette du poster de marque GDA — extraction des couleurs de
 * `assets/login/gda poster1.jpg` (voir `charte.md`).
 *
 * N'est plus utilisee comme fond de cartes ou de sidebar dans le tableau de
 * bord ni dans la coquille : apres comparaison directe cote a cote avec la
 * maquette de reference "Virtus", l'utilisateur a juge le rendu tout-orange/
 * brun qui en resultait « pas top » — la reference a un canevas et des
 * cartes clairs, le sombre reserve a la sidebar et a 1-2 cartes d'accent
 * (voir `composants/coquille-app/theme-sombre.tsx`, `app/tableau-de-bord/
 * page.tsx`). Conservee ici comme reference de la charte de marque, au cas
 * ou un futur habillage (poster, evenement, page de marque) en aurait besoin
 * a nouveau.
 */
export const CHARTE = {
  marronFonce: "#4A1F0A",
  orangeChaud: "#D76A0F",
  jauneLanterne: "#FEEF9C",
  doreLanterne: "#BFA054",
  ligneMosquee: "#5F2B10",
} as const;

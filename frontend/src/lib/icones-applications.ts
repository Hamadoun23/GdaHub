import {
  Briefcase,
  Building2,
  Citrus,
  Clapperboard,
  CreditCard,
  GraduationCap,
  HardHat,
  Landmark,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

/** Une icone par application — le meme repere visuel que sa barre laterale, une fois entre. */
const ICONES: Record<string, LucideIcon> = {
  hub: LayoutGrid,
  organisation: Building2,
  rh: GraduationCap,
  finance: Landmark,
  direction: Briefcase,
  campagnes: CreditCard,
  bdm: CreditCard,
  orange: Citrus,
  daily: HardHat,
  planning: Clapperboard,
};

export function iconePourApplication(code: string): LucideIcon {
  return ICONES[code] ?? LayoutGrid;
}

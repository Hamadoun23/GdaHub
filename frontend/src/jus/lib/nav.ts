import {
  LayoutDashboard,
  Users,
  Sprout,
  Citrus,
  Boxes,
  PackageOpen,
  FlaskConical,
  Package,
  Wine,
  ClipboardList,
  Map,
  UserRound,
  ShoppingCart,
  ReceiptText,
  FileText,
  Wallet,
  Landmark,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export type Role = "direction" | "production" | "commercial" | "finance" | "reporting";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  role: Role;
  label: string;
  items: NavItem[];
};

export const roleMeta: Record<
  Role,
  { label: string; short: string; color: string }
> = {
  direction: { label: "Direction", short: "DIR", color: "bg-violet-500" },
  production: { label: "Production", short: "PROD", color: "bg-primary" },
  commercial: { label: "Commercial", short: "COM", color: "bg-blue-500" },
  finance: { label: "Finance", short: "FIN", color: "bg-emerald-500" },
  reporting: { label: "Reporting", short: "REP", color: "bg-amber-500" },
};

export const navigation: NavGroup[] = [
  {
    role: "direction",
    label: "Direction",
    items: [
      { label: "Tableau de bord", href: "/jus/direction", icon: LayoutDashboard },
      { label: "Utilisateurs", href: "/jus/direction/utilisateurs", icon: Users },
    ],
  },
  {
    role: "production",
    label: "Production",
    items: [
      { label: "Tableau de bord", href: "/jus/production", icon: LayoutDashboard },
      { label: "Producteurs", href: "/jus/production/producteurs", icon: UserRound },
      { label: "Cueillettes", href: "/jus/production/cueillettes", icon: Sprout },
      { label: "Articles / Stock", href: "/jus/production/articles", icon: Boxes },
      { label: "Réceptions", href: "/jus/production/receptions", icon: PackageOpen },
      { label: "Productions", href: "/jus/production/productions", icon: FlaskConical },
      { label: "Conditionnements", href: "/jus/production/conditionnements", icon: Package },
      { label: "Bouteilles", href: "/jus/production/bouteilles", icon: Wine },
      { label: "Inventaires", href: "/jus/production/inventaires", icon: ClipboardList },
    ],
  },
  {
    role: "commercial",
    label: "Commercial",
    items: [
      { label: "Tableau de bord", href: "/jus/commercial", icon: LayoutDashboard },
      { label: "Prospection", href: "/jus/commercial/prospection", icon: Map },
      { label: "Clients", href: "/jus/commercial/clients", icon: UserRound },
      { label: "Ventes", href: "/jus/commercial/ventes", icon: Citrus },
      { label: "Commandes", href: "/jus/commercial/commandes", icon: ShoppingCart },
      { label: "Factures", href: "/jus/commercial/factures", icon: ReceiptText },
      { label: "Paiements", href: "/jus/commercial/paiements", icon: Wallet },
    ],
  },
  {
    role: "finance",
    label: "Finance",
    items: [
      { label: "Tableau de bord", href: "/jus/finance", icon: LayoutDashboard },
      { label: "Trésorerie", href: "/jus/finance/tresorerie", icon: Landmark },
    ],
  },
  {
    role: "reporting",
    label: "Reporting",
    items: [
      { label: "Vue d'ensemble", href: "/jus/reporting", icon: BarChart3 },
      { label: "Récolte", href: "/jus/reporting/recolte", icon: Sprout },
      { label: "Approvisionnement", href: "/jus/reporting/appro", icon: PackageOpen },
      { label: "Fabrication", href: "/jus/reporting/fabrication", icon: FlaskConical },
      { label: "Emballage", href: "/jus/reporting/emballage", icon: Package },
      { label: "Entrepôt", href: "/jus/reporting/entrepot", icon: Boxes },
      { label: "Distribution", href: "/jus/reporting/distribution", icon: FileText },
    ],
  },
];

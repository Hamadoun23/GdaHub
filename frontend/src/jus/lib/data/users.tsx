import { Users } from "lucide-react";
import { StatusBadge, type Tone } from "@/jus/composants/app/status-badge";
import { frDate } from "@/jus/lib/format";
import { buildToApi, str } from "@/jus/lib/data/helpers";
import type { Resource } from "@/jus/lib/types";

type Utilisateur = {
  id: number;
  username: string;
  email: string;
  role: string;
  actif: boolean;
  date_joined: string;
};

const roleTone = (r: string): Tone =>
  r === "Direction" ? "violet"
  : r === "ResProd" ? "orange"
  : r === "Commercial" ? "blue"
  : r === "Finance" ? "green"
  : "gray";

const roleLabel = (r: string): string =>
  r === "ResProd" ? "Resp. production" : r || "—";

// Les quatre rôles gérés par l'application (mêmes groupes que Django).
const ROLES = [
  { value: "Direction", label: "Direction" },
  { value: "ResProd", label: "Resp. production" },
  { value: "Commercial", label: "Commercial" },
  { value: "Finance", label: "Finance" },
];

export const utilisateurs: Resource<Utilisateur> = {
  key: "utilisateurs",
  title: "Utilisateurs",
  singular: "Utilisateur",
  newLabel: "Nouvel utilisateur",
  description: "Comptes et rôles d'accès (réservé à la Direction).",
  icon: Users,
  endpoint: "utilisateurs",
  fromApi: (o) => {
    const roles = (o.roles as string[]) ?? [];
    return {
      id: o.id as number,
      username: str(o, "username"),
      email: str(o, "email"),
      role: roles[0] ?? (o.is_superuser ? "Direction" : ""),
      actif: Boolean(o.is_active),
      date_joined: str(o, "date_joined"),
    };
  },
  toApi: buildToApi({ rename: { actif: "is_active" }, drop: ["date_joined"] }),
  searchable: (r) => `${r.username} ${r.email} ${r.role}`,
  columns: [
    { key: "user", header: "Identifiant", cell: (r) => <span className="font-medium">{r.username}</span> },
    { key: "email", header: "Email", cell: (r) => <span className="text-muted-foreground">{r.email || "—"}</span> },
    { key: "role", header: "Rôle", cell: (r) => r.role ? <StatusBadge label={roleLabel(r.role)} tone={roleTone(r.role)} /> : <span className="text-muted-foreground">—</span> },
    { key: "actif", header: "Statut", cell: (r) => <StatusBadge label={r.actif ? "Actif" : "Désactivé"} tone={r.actif ? "green" : "gray"} /> },
    { key: "date", header: "Inscrit le", cell: (r) => frDate(r.date_joined) },
  ],
  stats: (rows) => [
    { label: "Comptes", value: rows.length },
    { label: "Actifs", value: rows.filter((r) => r.actif).length },
    { label: "Sans rôle", value: rows.filter((r) => !r.role).length },
  ],
  // À la création, le mot de passe est obligatoire et doit satisfaire les
  // validateurs Django (longueur, mot de passe courant, tout-numérique).
  createFields: [
    { name: "username", label: "Identifiant", type: "text", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "password", label: "Mot de passe", type: "text", required: true, colSpan: 2, hint: "8 caractères minimum, ni trop courant ni uniquement numérique." },
    { name: "role", label: "Rôle", type: "select", required: true, colSpan: 2, options: ROLES },
    { name: "actif", label: "Compte actif", type: "checkbox" },
  ],
  fields: [
    { name: "username", label: "Identifiant", type: "text", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "password", label: "Nouveau mot de passe", type: "text", colSpan: 2, hint: "Laisser vide pour conserver le mot de passe actuel." },
    { name: "role", label: "Rôle", type: "select", colSpan: 2, options: ROLES },
    { name: "actif", label: "Compte actif", type: "checkbox" },
  ],
};

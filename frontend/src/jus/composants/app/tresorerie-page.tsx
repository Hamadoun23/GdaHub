"use client";

import { useMemo, useState } from "react";
import {
  Landmark,
  Loader2,
  MoreHorizontal,
  Pencil,
  ScrollText,
  Search,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/jus/composants/ui/input";
import { Card } from "@/jus/composants/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/jus/composants/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/jus/composants/ui/dropdown-menu";
import { PageHeader } from "@/jus/composants/app/page-header";
import { FormSheet } from "@/jus/composants/app/form-sheet";
import { StatusBadge, type Tone } from "@/jus/composants/app/status-badge";
import { frDate, xof } from "@/jus/lib/format";
import {
  ApiError,
  createItem,
  fetchOptions,
  fetchRapprochementTresorerie,
  postAction,
  updateItem,
  type FormOptions,
  type LigneRapprochement,
} from "@/jus/lib/api";
import type { Field } from "@/jus/lib/types";
import { useAuth } from "@/jus/lib/auth";
import { useDonnees, FRAICHEUR_OPTIONS_MS } from "@/jus/lib/cache";

/**
 * Rapprochement de trésorerie.
 *
 * Cet écran ne liste pas les réceptions : il liste les PAIEMENTS déclarés par
 * le commercial et les confronte aux encaisses saisies par le trésorier. Les
 * paiements sans réception (« en attente ») sont précisément ceux à traiter :
 * un simple tableau des réceptions les rendrait invisibles. C'est pourquoi il
 * ne passe pas par CrudPage, dont le modèle est une ressource = un endpoint.
 */

type Ligne = LigneRapprochement;

const statutTone = (statut: string): { label: string; tone: Tone } => {
  switch (statut) {
    case "CONFORME":
      return { label: "Conforme", tone: "green" };
    case "ECART_POSITIF":
      return { label: "Écart positif", tone: "blue" };
    case "ECART_NEGATIF":
      return { label: "Écart négatif", tone: "red" };
    default:
      return { label: "En attente", tone: "amber" };
  }
};

const CHAMPS_RECEPTION: Field[] = [
  { name: "montant_recu", label: "Montant reçu (XOF)", type: "number", required: true, colSpan: 2, hint: "Montant réellement encaissé par la trésorerie." },
  { name: "date_reception", label: "Date de réception", type: "date", required: true, colSpan: 2 },
];

const CHAMPS_ECART: Field[] = [
  { name: "observation", label: "Justification de l'écart", type: "textarea", required: true, colSpan: 2, hint: "Enregistrer la justification marque l'écart comme traité." },
];

type Panneau =
  | { type: "saisir"; ligne: Ligne }
  | { type: "modifier"; ligne: Ligne }
  | { type: "ecart"; ligne: Ligne }
  | null;

export function TresoreriePage() {
  // La Direction consulte le rapprochement, mais seule la Finance saisit les
  // réceptions et justifie les écarts (l'API l'impose déjà via CanFinance :
  // on masque les actions plutôt que de laisser l'utilisateur buter sur un 403).
  const { user } = useAuth();
  const peutSaisir = Boolean(
    user && (user.is_superuser || user.roles.includes("Finance"))
  );

  const [query, setQuery] = useState("");
  const [panneau, setPanneau] = useState<Panneau>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Passe par le cache partagé : réaffichage instantané au retour sur la page,
  // et revalidation automatique quand l'utilisateur revient sur l'onglet.
  const {
    donnees: rapprochement,
    chargement: loading,
    erreur: error,
    revalider: load,
  } = useDonnees("tresorerie:rapprochement", fetchRapprochementTresorerie);

  const { donnees: optionsEnCache } = useDonnees<FormOptions>(
    "options",
    fetchOptions
  );

  const totaux = rapprochement?.totaux ?? null;
  const options = optionsEnCache ?? {};

  // Mémoïsé : une expression `?? []` recréerait un tableau à chaque rendu et
  // invaliderait le filtre en permanence.
  const lignes = useMemo(() => rapprochement?.lignes ?? [], [rapprochement]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lignes;
    return lignes.filter((l) =>
      `${l.client_nom ?? ""} ${l.num_fact ?? ""} ${l.paiement_id}`
        .toLowerCase()
        .includes(q)
    );
  }, [lignes, query]);

  function ouvrir(p: Panneau) {
    setFieldErrors({});
    setPanneau(p);
  }

  async function soumettre(values: Record<string, string | boolean>) {
    if (!panneau) return;
    setSubmitting(true);
    setFieldErrors({});
    try {
      const { type, ligne } = panneau;
      if (type === "saisir") {
        await createItem("tresorerie", {
          paiement: ligne.paiement_id,
          montant_recu: Number(values.montant_recu),
          date_reception: values.date_reception,
        });
        toast.success("Réception enregistrée. Comparaison effectuée automatiquement.");
      } else if (type === "modifier" && ligne.reception_id) {
        await updateItem("tresorerie", ligne.reception_id, {
          montant_recu: Number(values.montant_recu),
          date_reception: values.date_reception,
        });
        toast.success("Réception modifiée");
      } else if (type === "ecart" && ligne.reception_id) {
        await postAction("tresorerie", ligne.reception_id, "gerer-ecart", {
          observation: values.observation,
        });
        toast.success("Justification enregistrée");
      }
      setPanneau(null);
      load();
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors(e.fieldErrors);
        toast.error(e.message);
      } else {
        toast.error("Opération impossible");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const cartes = totaux
    ? [
        { label: "Déclaré (commercial)", value: xof(totaux.total_commercial) },
        { label: "Reçu (trésorerie)", value: xof(totaux.total_recu) },
        { label: "Écart global", value: xof(totaux.ecart_global) },
        { label: "En attente de réception", value: totaux.nb_en_attente },
        { label: "Écarts à justifier", value: totaux.nb_ecarts_non_traites },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trésorerie"
        description={
          peutSaisir
            ? "Rapprochement entre les paiements déclarés par le commercial et les encaisses du trésorier."
            : "Rapprochement entre les paiements déclarés et les encaisses. Consultation seule : la saisie est réservée au rôle Finance."
        }
      />

      {cartes.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {cartes.map((c) => (
            <div key={c.label} className="rounded-xl border bg-card px-4 py-2.5 shadow-sm">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-lg font-semibold tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un client, une facture…"
          className="bg-background pl-9"
        />
      </div>

      <Card className="overflow-hidden rounded-2xl py-0 shadow-sm">
        <div className="max-h-[560px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="border-b bg-muted/60 backdrop-blur hover:bg-muted/60">
                {["Paiement", "Client", "Facture", "Mode", "Déclaré", "Reçu", "Écart", "Statut", "Justifié"].map(
                  (h, i) => (
                    <TableHead
                      key={h}
                      className={`h-11 whitespace-nowrap border-r border-border/40 px-4 font-medium text-foreground last:border-r-0 ${
                        i >= 4 && i <= 6 ? "text-right" : ""
                      }`}
                    >
                      {h}
                    </TableHead>
                  )
                )}
                <TableHead className="w-12 border-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={10} className="h-28 text-center text-muted-foreground">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </TableCell>
                </TableRow>
              )}

              {!loading && error && (
                <TableRow>
                  <TableCell colSpan={10} className="h-28 text-center text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                !error &&
                filtered.map((l) => {
                  const statut = statutTone(l.statut_reception);
                  const enAttente = l.reception_id === null;
                  const aUnEcart = (l.ecart ?? 0) !== 0;
                  return (
                    <TableRow key={l.paiement_id} className="group">
                      <TableCell className="border-r border-border/30 px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Wallet className="size-4" />
                          </span>
                          <span className="font-mono text-xs">#{l.paiement_id}</span>
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-border/30 px-4 py-3.5 font-medium">
                        {l.client_nom ?? "—"}
                      </TableCell>
                      <TableCell className="border-r border-border/30 px-4 py-3.5">
                        <span className="font-mono text-xs">{l.num_fact ?? "—"}</span>
                      </TableCell>
                      <TableCell className="border-r border-border/30 px-4 py-3.5 text-muted-foreground">
                        {l.mode_display}
                      </TableCell>
                      <TableCell className="border-r border-border/30 px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                        {xof(l.montant_commercial)}
                      </TableCell>
                      <TableCell className="border-r border-border/30 px-4 py-3.5 text-right tabular-nums font-medium">
                        {l.montant_recu === null ? "—" : xof(l.montant_recu)}
                      </TableCell>
                      <TableCell className="border-r border-border/30 px-4 py-3.5 text-right">
                        {l.ecart === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : l.ecart === 0 ? (
                          <span className="text-muted-foreground">0</span>
                        ) : (
                          <span
                            className={
                              l.ecart > 0
                                ? "font-medium text-blue-600 dark:text-blue-400"
                                : "font-medium text-red-600 dark:text-red-400"
                            }
                          >
                            {l.ecart > 0 ? "+" : ""}
                            {xof(l.ecart)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="border-r border-border/30 px-4 py-3.5">
                        <StatusBadge label={statut.label} tone={statut.tone} />
                      </TableCell>
                      <TableCell className="border-r border-border/30 px-4 py-3.5">
                        {!aUnEcart || enAttente ? (
                          <span className="text-muted-foreground">—</span>
                        ) : l.ecart_traite ? (
                          <StatusBadge label="Justifié" tone="green" />
                        ) : (
                          <StatusBadge label="À justifier" tone="amber" />
                        )}
                      </TableCell>
                      <TableCell className="px-2 text-right">
                        {!peutSaisir ? null : (
                        <DropdownMenu>
                          {/* Voir crud-page.tsx : masqué seulement là où le
                              survol existe, sinon inatteignable au doigt. */}
                          <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-muted [@media(hover:hover)]:opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100">
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {enAttente ? (
                              <DropdownMenuItem onClick={() => ouvrir({ type: "saisir", ligne: l })}>
                                <Landmark className="size-4" />
                                Saisir la réception
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem onClick={() => ouvrir({ type: "modifier", ligne: l })}>
                                  <Pencil className="size-4" />
                                  Corriger la réception
                                </DropdownMenuItem>
                                {aUnEcart && (
                                  <DropdownMenuItem onClick={() => ouvrir({ type: "ecart", ligne: l })}>
                                    <ScrollText className="size-4" />
                                    Justifier l&apos;écart
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}

              {!loading && !error && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="h-28 text-center text-muted-foreground">
                    Aucun paiement à rapprocher.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {panneau && (
        <FormSheet
          open
          onOpenChange={(v) => !v && setPanneau(null)}
          title={
            panneau.type === "saisir"
              ? `Réception — paiement #${panneau.ligne.paiement_id}`
              : panneau.type === "modifier"
                ? `Corriger la réception — paiement #${panneau.ligne.paiement_id}`
                : `Justifier l'écart — paiement #${panneau.ligne.paiement_id}`
          }
          description={
            panneau.type === "ecart"
              ? `Écart constaté : ${xof(panneau.ligne.ecart ?? 0)}`
              : `Montant déclaré par le commercial : ${xof(panneau.ligne.montant_commercial)} (${frDate(panneau.ligne.date_paie)})`
          }
          fields={panneau.type === "ecart" ? CHAMPS_ECART : CHAMPS_RECEPTION}
          initial={
            panneau.type === "ecart"
              ? { observation: panneau.ligne.observation }
              : {
                  montant_recu: String(panneau.ligne.montant_recu ?? ""),
                  date_reception: panneau.ligne.date_reception ?? "",
                }
          }
          errors={fieldErrors}
          options={options}
          submitting={submitting}
          submitLabel={panneau.type === "ecart" ? "Justifier" : "Enregistrer"}
          onSubmit={soumettre}
        />
      )}
    </div>
  );
}

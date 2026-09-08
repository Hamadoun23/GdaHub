"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Card } from "@/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { PageHeader } from "@/jus/composants/app/page-header";
import { FormSheet } from "@/jus/composants/app/form-sheet";
import { cn } from "@/lib/cn";
import {
  ApiError,
  createItem,
  deleteItem,
  fetchList,
  fetchOptions,
  postAction,
  updateItem,
  type FormOptions,
} from "@/jus/lib/api";
import type { Resource, RowAction } from "@/jus/lib/types";
import { useDonnees, invaliderPrefixe, FRAICHEUR_OPTIONS_MS } from "@/jus/lib/cache";
import { heureCourte } from "@/jus/lib/format";

type Row = { id: string | number };

export function CrudPage<T extends Row>({
  resource,
}: {
  resource: Resource<T>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  // Action métier en cours (compléter, actualiser…) et ligne concernée.
  const [running, setRunning] = useState<{
    action: RowAction<T>;
    row: T;
  } | null>(null);

  // Les lignes vivent dans le cache partagé : revenir sur la page les
  // réaffiche instantanément, sans rappeler le serveur.
  const cleListe = resource.endpoint ? `liste:${resource.endpoint}` : null;
  const {
    donnees: lignesEnCache,
    chargement,
    erreur,
    revalider,
    muter,
    majLe,
  } = useDonnees<T[]>(cleListe, async () => {
    const data = await fetchList<Record<string, unknown>>(resource.endpoint!);
    return resource.fromApi
      ? data.map(resource.fromApi)
      : (data as unknown as T[]);
  });

  // Les listes déroulantes sont communes à toutes les pages : une seule
  // requête, partagée, au lieu d'un appel par écran visité.
  const { donnees: optionsEnCache, revalider: revaliderOptions } =
    useDonnees<FormOptions>("options", fetchOptions, { fraicheurMs: FRAICHEUR_OPTIONS_MS });

  const rows = useMemo(
    () => lignesEnCache ?? resource.rows ?? [],
    [lignesEnCache, resource.rows]
  );
  const options = optionsEnCache ?? {};
  const loading = Boolean(resource.endpoint) && chargement;
  const error = erreur;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    // On compare aussi les chaînes sans espaces : saisir « 77123456 » doit
    // trouver un téléphone enregistré « 77 12 34 56 », comme le faisait la
    // recherche Django (qui normalisait les espaces en SQL).
    const qCompact = q.replace(/[\s ]/g, "");
    return rows.filter((r) => {
      const champ = resource.searchable(r).toLowerCase();
      if (champ.includes(q)) return true;
      return (
        qCompact.length > 0 &&
        champ.replace(/[\s ]/g, "").includes(qCompact)
      );
    });
  }, [rows, query, resource]);

  function openNew() {
    setEditing(null);
    setFieldErrors({});
    setOpen(true);
  }

  function openEdit(row: T) {
    setEditing(row);
    setFieldErrors({});
    setOpen(true);
  }

  function openAction(action: RowAction<T>, row: T) {
    setFieldErrors({});
    setRunning({ action, row });
  }

  /** Exécute une action métier (POST sur `<endpoint>/<id>/<action>/`). */
  async function submitAction(values: Record<string, string | boolean>) {
    if (!running || !resource.endpoint) return;
    const { action, row } = running;
    const body = action.toApi ? action.toApi(values) : values;
    setSubmitting(true);
    setFieldErrors({});
    try {
      await postAction(resource.endpoint, row.id, action.action, body);
      toast.success(action.successMessage ?? `${action.label} : opération réussie`);
      setRunning(null);
      // Une action métier peut modifier la ligne en profondeur (statut, stock,
      // objets créés ailleurs) : ici on redemande bien la liste.
      revalider();
      apresEcriture();
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

  async function remove(row: T) {
    if (!resource.endpoint) {
      muter(rows.filter((r) => r.id !== row.id));
      toast.success(`${resource.singular} supprimé(e)`);
      return;
    }
    try {
      await deleteItem(resource.endpoint, row.id);
      // On retire la ligne du cache : recharger toute la liste pour une
      // suppression que l'on vient d'effectuer serait un aller-retour inutile.
      muter(rows.filter((r) => r.id !== row.id));
      toast.success(`${resource.singular} supprimé(e)`);
      apresEcriture();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Suppression impossible");
    }
  }

  /**
   * Une écriture peut modifier d'autres ressources que celle qu'on édite :
   * un conditionnement crée des bouteilles et consomme du stock, compléter une
   * commande crée une vente et une facture. On invalide donc les listes
   * voisines — elles se rechargeront seulement si l'utilisateur les ouvre.
   */
  function apresEcriture() {
    invaliderPrefixe("liste:", [cleListe]);
    revaliderOptions();
  }

  async function submit(values: Record<string, string | boolean>) {
    const body = resource.toApi ? resource.toApi(values) : values;
    setSubmitting(true);
    setFieldErrors({});
    try {
      if (!resource.endpoint) {
        setOpen(false);
        return;
      }
      // Le serveur renvoie l'objet enregistré : on l'insère directement dans
      // le cache plutôt que de redemander la liste complète.
      if (editing) {
        const modifie = await updateItem<Record<string, unknown>>(
          resource.endpoint,
          editing.id,
          body
        );
        const ligne = resource.fromApi
          ? resource.fromApi(modifie)
          : (modifie as unknown as T);
        muter(rows.map((r) => (r.id === editing.id ? ligne : r)));
        toast.success(`${resource.singular} modifié(e)`);
      } else {
        const cree = await createItem<Record<string, unknown>>(
          resource.endpoint,
          body
        );
        const ligne = resource.fromApi
          ? resource.fromApi(cree)
          : (cree as unknown as T);
        muter([ligne, ...rows]);
        toast.success(`${resource.singular} créé(e)`);
      }
      setOpen(false);
      apresEcriture();
    } catch (e) {
      // Les erreurs de validation restent affichées sur les champs concernés :
      // le panneau ne se ferme pas, l'utilisateur corrige et resoumet.
      if (e instanceof ApiError) {
        setFieldErrors(e.fieldErrors);
        toast.error(e.message);
      } else {
        toast.error("Enregistrement impossible");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const Icon = resource.icon;
  const hasRows = !loading && !error && filtered.length > 0;
  const canCreate = resource.canCreate !== false;
  const canEdit = resource.canEdit !== false;
  const stats = resource.stats?.(rows) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={resource.title} description={resource.description}>
        {canCreate && (
          <Button onClick={openNew} className="gap-2">
            <Plus className="size-4" />
            {resource.newLabel ?? `Nouveau ${resource.singular.toLowerCase()}`}
          </Button>
        )}
      </PageHeader>

      {/* Compteurs repris des vues Django (total, en cours, terminées…). */}
      {stats.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border bg-card px-4 py-2.5 shadow-sm"
            >
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-semibold tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher…"
          className="pl-9 bg-background"
        />
      </div>

      <Card className="relative overflow-hidden rounded-2xl py-0 shadow-sm">
        <div className="max-h-[560px] overflow-auto pb-12">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="border-b bg-muted/60 backdrop-blur hover:bg-muted/60">
                {resource.columns.map((c) => (
                  <TableHead
                    key={c.key}
                    className={cn(
                      "h-11 whitespace-nowrap border-r border-border/40 px-4 font-medium text-foreground last:border-r-0",
                      c.align === "right" && "text-right"
                    )}
                  >
                    {c.header}
                  </TableHead>
                ))}
                <TableHead className="w-12 border-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell
                    colSpan={resource.columns.length + 1}
                    className="h-28 text-center text-muted-foreground"
                  >
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </TableCell>
                </TableRow>
              )}

              {!loading && error && (
                <TableRow>
                  <TableCell
                    colSpan={resource.columns.length + 1}
                    className="h-28 text-center text-destructive"
                  >
                    {error}
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                !error &&
                filtered.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "group",
                      resource.rowHref && "cursor-pointer hover:bg-muted/40"
                    )}
                    // Toute la ligne ouvre la fiche : cliquer sur le nom du
                    // client ou sur le montant doit fonctionner comme cliquer
                    // sur le numéro. Le menu d'actions arrête la propagation.
                    onClick={
                      resource.rowHref
                        ? () => router.push(resource.rowHref!(row))
                        : undefined
                    }
                  >
                    {resource.columns.map((c, ci) => (
                      <TableCell
                        key={c.key}
                        className={cn(
                          "border-r border-border/30 px-4 py-3.5 last:border-r-0",
                          c.align === "right" && "text-right",
                          c.className
                        )}
                      >
                        {ci === 0 ? (
                          // La première colonne devient un lien vers la fiche
                          // détaillée quand la ressource en propose une.
                          resource.rowHref ? (
                            <Link
                              href={resource.rowHref(row)}
                              className="flex items-center gap-2.5 hover:underline"
                            >
                              <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <Icon className="size-4" />
                              </span>
                              {c.cell(row)}
                            </Link>
                          ) : (
                            <div className="flex items-center gap-2.5">
                              <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <Icon className="size-4" />
                              </span>
                              {c.cell(row)}
                            </div>
                          )
                        ) : (
                          c.cell(row)
                        )}
                      </TableCell>
                    ))}
                    <TableCell
                      className="px-2 text-right"
                      // Sans cela, ouvrir le menu déclencherait aussi la
                      // navigation vers la fiche.
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        {/*
                          Sur écran tactile il n'y a pas de survol : le menu
                          resterait invisible et « Modifier »/« Supprimer »
                          inatteignables depuis un téléphone. On l'affiche donc
                          par défaut, et on ne le masque que là où le survol
                          existe — Tailwind v4 enferme déjà `group-hover`
                          dans la même condition, les deux règles s'accordent.
                        */}
                        <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-muted [@media(hover:hover)]:opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100">
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(resource.actions ?? [])
                            .filter((a) => a.available?.(row) ?? true)
                            .map((a) => {
                              const ActionIcon = a.icon;
                              return (
                                <DropdownMenuItem
                                  key={a.key}
                                  onClick={() => openAction(a, row)}
                                >
                                  {ActionIcon && <ActionIcon className="size-4" />}
                                  {a.label}
                                </DropdownMenuItem>
                              );
                            })}
                          {canEdit && (
                            <DropdownMenuItem onClick={() => openEdit(row)}>
                              <Pencil className="size-4" />
                              Modifier
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => remove(row)}
                          >
                            <Trash2 className="size-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}

              {!loading && !error && filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={resource.columns.length + 1}
                    className="h-28 text-center text-muted-foreground"
                  >
                    Aucun résultat.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Dégradé bas + pastille de résumé flottante (style Tailark) */}
        {hasRows && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card via-card/80 to-transparent" />
            {/* La carte est en `overflow-hidden` : sans limite de largeur, la
                pastille serait tronquée sur un téléphone au lieu de déborder. */}
            <div className="absolute bottom-3 left-1/2 z-20 max-w-[calc(100%-1.5rem)] -translate-x-1/2">
              <div className="flex items-center gap-2 whitespace-nowrap rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium shadow-md">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Icon className="size-3" />
                </span>
                <span className="truncate">
                  {filtered.length} {resource.title.toLowerCase()}
                </span>
                {/* L'heure de mise à jour est un confort : on la sacrifie en
                    premier quand la place manque. */}
                {majLe && (
                  <span className="hidden text-muted-foreground sm:inline">
                    · à jour à {heureCourte(majLe)}
                  </span>
                )}
                <ArrowUp className="size-3 shrink-0 text-muted-foreground" />
              </div>
            </div>
          </>
        )}
      </Card>

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        // On réutilise `newLabel` pour le titre : « Nouveau » ne s'accorde pas
        // avec les noms féminins (« Nouveau cueillette ») ni devant une voyelle.
        title={
          editing
            ? `Modifier ${resource.singular.toLowerCase()}`
            : (resource.newLabel ?? `Nouveau ${resource.singular.toLowerCase()}`)
        }
        description={resource.description}
        // `createFields` permet aux ressources en deux étapes (production) de
        // ne demander à la création que le strict nécessaire, comme en Django.
        fields={
          !editing && resource.createFields
            ? resource.createFields
            : resource.fields.filter((f) => !(editing && f.hideOnEdit))
        }
        initial={
          editing
            ? (editing as unknown as Record<string, string | boolean>)
            : undefined
        }
        errors={fieldErrors}
        options={options}
        submitting={submitting}
        onSubmit={submit}
      />

      {running && (
        <FormSheet
          open
          onOpenChange={(v) => !v && setRunning(null)}
          title={running.action.title(running.row)}
          description={running.action.description}
          fields={running.action.fields}
          initial={running.action.initial?.(running.row)}
          errors={fieldErrors}
          options={options}
          submitting={submitting}
          submitLabel={running.action.label}
          onSubmit={submitAction}
        />
      )}
    </div>
  );
}

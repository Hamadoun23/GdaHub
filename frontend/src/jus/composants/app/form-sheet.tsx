"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/ui/sheet";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Checkbox } from "@/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { cn } from "@/lib/cn";
import type { Field } from "@/jus/lib/types";
import type { FormOptions } from "@/jus/lib/api";

type Values = Record<string, string | boolean>;

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initial,
  onSubmit,
  errors = {},
  options = {},
  submitting = false,
  submitLabel = "Enregistrer",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  fields: Field[];
  initial?: Values;
  onSubmit: (values: Values) => void;
  /** Erreurs renvoyées par l'API, par nom de champ. */
  errors?: Record<string, string>;
  /** Options chargées depuis /api/options/, par clé. */
  options?: FormOptions;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<Values>({});

  useEffect(() => {
    if (!open) return;
    // Les valeurs venant de l'API sont typées (nombres, null). Les champs de
    // formulaire et les listes déroulantes raisonnent en chaînes : sans cette
    // normalisation, une liste ne se pré-sélectionnerait pas en modification.
    const normalized: Values = {};
    for (const [key, value] of Object.entries(initial ?? {})) {
      if (typeof value === "boolean") normalized[key] = value;
      else normalized[key] = value == null ? "" : String(value);
    }
    setValues(normalized);
  }, [open, initial]);

  const set = (name: string, v: string | boolean) =>
    setValues((prev) => ({ ...prev, [name]: v }));

  // Les options viennent soit du serveur (optionsFrom), soit du champ lui-même.
  const optionsFor = (f: Field) => {
    if (f.optionsFrom) {
      return (options[f.optionsFrom] ?? []).map((o) => ({
        value: String(o.value),
        label: o.label,
      }));
    }
    return f.options ?? [];
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/*
        `data-[side=right]` a une spécificité plus forte que `w-full` : sans le
        redéclarer ici, le panneau garderait la largeur 3/4 par défaut du Sheet
        et laisserait un quart d'écran perdu sur un téléphone.
      */}
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        {/* Une colonne sous 640px : à deux, chaque champ tombe sous 130px et
            les dates comme les listes déroulantes deviennent illisibles. */}
        <form
          className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(values);
          }}
          id="entity-form"
        >
          {fields.map((f) => {
            const val = values[f.name];
            // `col-span-2` sur une grille à une colonne ne se contente pas
            // d'être ignoré : CSS crée une deuxième colonne implicite, et le
            // formulaire déborde. Le span ne s'applique donc qu'à partir de sm.
            const span =
              f.colSpan === 2 || f.type === "textarea"
                ? "col-span-1 sm:col-span-2"
                : "col-span-1";

            if (f.type === "checkbox") {
              return (
                <label
                  key={f.name}
                  className={cn(
                    "col-span-1 flex items-center gap-3 rounded-lg border p-3 cursor-pointer sm:col-span-2",
                  )}
                >
                  <Checkbox
                    checked={Boolean(val)}
                    onCheckedChange={(c) => set(f.name, Boolean(c))}
                  />
                  <div>
                    <p className="text-sm font-medium">{f.label}</p>
                    {f.hint && (
                      <p className="text-xs text-muted-foreground">{f.hint}</p>
                    )}
                  </div>
                </label>
              );
            }

            const error = errors[f.name];

            return (
              <div key={f.name} className={cn("space-y-1.5", span)}>
                <Label htmlFor={f.name}>
                  {f.label}
                  {f.required && <span className="text-primary"> *</span>}
                </Label>

                {f.type === "textarea" ? (
                  <Textarea
                    id={f.name}
                    placeholder={f.placeholder}
                    aria-invalid={Boolean(error)}
                    value={(val as string) ?? ""}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                ) : f.type === "select" ? (
                  <Select
                    value={(val as string) ?? ""}
                    onValueChange={(v) => set(f.name, (v as string) ?? "")}
                  >
                    <SelectTrigger
                      id={f.name}
                      className="w-full"
                      aria-invalid={Boolean(error)}
                    >
                      {/*
                        Base UI affiche la VALEUR de l'option sélectionnée, pas
                        son libellé : le champ montrait « 5 » au lieu du nom du
                        producteur. La fonction ci-dessous retrouve le libellé.
                      */}
                      <SelectValue>
                        {(valeur) => {
                          if (valeur === null || valeur === undefined || valeur === "")
                            return (
                              <span className="text-muted-foreground">
                                Sélectionner…
                              </span>
                            );
                          const option = optionsFor(f).find(
                            (o) => o.value === String(valeur)
                          );
                          return option ? option.label : String(valeur);
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {optionsFor(f).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={f.name}
                    type={f.type}
                    placeholder={f.placeholder}
                    aria-invalid={Boolean(error)}
                    value={(val as string) ?? ""}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                )}

                {error ? (
                  <p className="text-xs font-medium text-destructive">{error}</p>
                ) : (
                  f.hint && (
                    <p className="text-xs text-muted-foreground">{f.hint}</p>
                  )
                )}
              </div>
            );
          })}
        </form>

        <SheetFooter className="flex-row justify-end gap-2">
          <SheetClose render={<Button variant="outline">Annuler</Button>} />
          <Button type="submit" form="entity-form" disabled={submitting}>
            {submitting ? "Enregistrement…" : submitLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

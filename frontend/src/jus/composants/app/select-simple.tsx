"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/jus/composants/ui/select";

export type OptionSimple = { value: string; label: string };

/**
 * Liste déroulante prête à l'emploi.
 *
 * Base UI affiche la *valeur* sélectionnée et non son libellé : sans la
 * fonction de rendu ci-dessous, le champ montrerait « SUPERMARCHE » au lieu de
 * « Supermarché ». Même correctif que dans `FormSheet`, isolé ici pour les
 * formulaires écrits à la main.
 */
export function SelectSimple({
  id,
  value,
  onChange,
  options,
  placeholder = "Sélectionner…",
  invalide,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: OptionSimple[];
  placeholder?: string;
  invalide?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange((v as string) ?? "")}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalide}>
        <SelectValue>
          {(valeur) => {
            if (valeur === null || valeur === undefined || valeur === "")
              return <span className="text-muted-foreground">{placeholder}</span>;
            const option = options.find((o) => o.value === String(valeur));
            return option ? option.label : String(valeur);
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

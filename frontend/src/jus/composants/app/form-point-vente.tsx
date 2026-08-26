"use client";

import { useEffect, useState } from "react";
import { Crosshair, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/jus/composants/ui/sheet";
import { Button } from "@/jus/composants/ui/button";
import { Input } from "@/jus/composants/ui/input";
import { Label } from "@/jus/composants/ui/label";
import { SelectSimple } from "@/jus/composants/app/select-simple";
import type { FormOptions, PointVente } from "@/jus/lib/api";
import { STATUTS, coords, releverPosition } from "@/jus/lib/prospection";

export type ValeursPoint = {
  nom: string;
  type_point: string;
  latitude: string;
  longitude: string;
  adresse: string;
  contact_nom: string;
  contact_tel: string;
  contact_email: string;
  statut: string;
  potentiel_ca: string;
  date_prochaine_relance: string;
  commercial: string;
};

const VIDE: ValeursPoint = {
  nom: "",
  type_point: "BOUTIQUE",
  latitude: "",
  longitude: "",
  adresse: "",
  contact_nom: "",
  contact_tel: "",
  contact_email: "",
  statut: "PROSPECTE",
  potentiel_ca: "",
  date_prochaine_relance: "",
  commercial: "",
};

export function depuisPoint(point: PointVente): ValeursPoint {
  return {
    nom: point.nom,
    type_point: point.type_point,
    latitude: String(point.latitude),
    longitude: String(point.longitude),
    adresse: point.adresse,
    contact_nom: point.contact_nom,
    contact_tel: point.contact_tel,
    contact_email: point.contact_email,
    statut: point.statut,
    potentiel_ca: point.potentiel_ca ? String(point.potentiel_ca) : "",
    date_prochaine_relance: point.date_prochaine_relance ?? "",
    commercial: point.commercial ? String(point.commercial) : "",
  };
}

/**
 * Création / modification d'un point de vente.
 *
 * Formulaire écrit à la main plutôt que `FormSheet` : la position est le cœur
 * de la fiche et se saisit au GPS ou au clic sur la carte, pas en tapant des
 * décimales dans deux champs.
 */
export function FormPointVente({
  ouvert,
  onOuvert,
  initial,
  /** Coordonnées choisies en cliquant sur la carte, injectées en direct. */
  positionCarte,
  options,
  erreurs = {},
  enCours = false,
  onSubmit,
}: {
  ouvert: boolean;
  onOuvert: (v: boolean) => void;
  initial?: ValeursPoint;
  positionCarte?: { latitude: number; longitude: number } | null;
  options: FormOptions;
  erreurs?: Record<string, string>;
  enCours?: boolean;
  onSubmit: (valeurs: ValeursPoint) => void;
}) {
  const [valeurs, setValeurs] = useState<ValeursPoint>(VIDE);
  const [localisation, setLocalisation] = useState(false);

  // Recharge le formulaire à chaque ouverture, comme le fait `FormSheet` :
  // sans cela, rouvrir le panneau afficherait la saisie précédente.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ouvert) setValeurs(initial ?? VIDE);
  }, [ouvert, initial]);

  // Un clic sur la carte pendant que le panneau est ouvert repositionne le
  // point : la carte est un système externe, l'effet est la seule façon d'en
  // recevoir la valeur.
  useEffect(() => {
    if (!positionCarte) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValeurs((v) => ({
      ...v,
      latitude: String(positionCarte.latitude),
      longitude: String(positionCarte.longitude),
    }));
  }, [positionCarte]);

  const set = (nom: keyof ValeursPoint, v: string) =>
    setValeurs((prev) => ({ ...prev, [nom]: v }));

  async function meLocaliser() {
    setLocalisation(true);
    try {
      const p = await releverPosition();
      setValeurs((v) => ({
        ...v,
        latitude: String(p.latitude),
        longitude: String(p.longitude),
      }));
      toast.success(`Position relevée (précision ${Math.round(p.precision)} m)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Localisation impossible");
    } finally {
      setLocalisation(false);
    }
  }

  const positionne = valeurs.latitude !== "" && valeurs.longitude !== "";
  const erreurPosition = erreurs.latitude || erreurs.longitude;

  return (
    <Sheet open={ouvert} onOpenChange={onOuvert}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {initial ? "Modifier le point de vente" : "Nouveau point de vente"}
          </SheetTitle>
          <SheetDescription>
            Boutique, supermarché, restaurant, entreprise… Les clients
            particuliers se saisissent dans « Clients », pas ici.
          </SheetDescription>
        </SheetHeader>

        <form
          id="form-point-vente"
          className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(valeurs);
          }}
        >
          <div className="col-span-1 sm:col-span-2 space-y-1.5">
            <Label htmlFor="pv-nom">
              Nom du point de vente<span className="text-primary"> *</span>
            </Label>
            <Input
              id="pv-nom"
              value={valeurs.nom}
              aria-invalid={Boolean(erreurs.nom)}
              onChange={(e) => set("nom", e.target.value)}
              placeholder="Supermarché Hamdallaye ACI"
            />
            {erreurs.nom && (
              <p className="text-xs font-medium text-destructive">{erreurs.nom}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pv-type">Type</Label>
            <SelectSimple
              id="pv-type"
              value={valeurs.type_point}
              onChange={(v) => set("type_point", v)}
              options={optionsDe(options, "types_point_vente")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pv-statut">Statut</Label>
            <SelectSimple
              id="pv-statut"
              value={valeurs.statut}
              onChange={(v) => set("statut", v)}
              options={STATUTS.map((s) => ({ value: s.valeur, label: s.label }))}
            />
          </div>

          {/* --- Position --- */}
          <div className="col-span-1 sm:col-span-2 space-y-2 rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm">
                Géolocalisation<span className="text-primary"> *</span>
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={localisation}
                onClick={meLocaliser}
              >
                {localisation ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Crosshair className="size-4" />
                )}
                Me localiser
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {positionne
                ? coords(Number(valeurs.latitude), Number(valeurs.longitude))
                : "Sur place, appuyez sur « Me localiser ». Sinon, cliquez directement sur la carte."}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                aria-label="Latitude"
                placeholder="Latitude"
                inputMode="decimal"
                value={valeurs.latitude}
                aria-invalid={Boolean(erreurs.latitude)}
                onChange={(e) => set("latitude", e.target.value)}
              />
              <Input
                aria-label="Longitude"
                placeholder="Longitude"
                inputMode="decimal"
                value={valeurs.longitude}
                aria-invalid={Boolean(erreurs.longitude)}
                onChange={(e) => set("longitude", e.target.value)}
              />
            </div>
            {erreurPosition && (
              <p className="text-xs font-medium text-destructive">{erreurPosition}</p>
            )}
          </div>

          <div className="col-span-1 sm:col-span-2 space-y-1.5">
            <Label htmlFor="pv-adresse">Adresse / repère</Label>
            <Input
              id="pv-adresse"
              value={valeurs.adresse}
              onChange={(e) => set("adresse", e.target.value)}
              placeholder="Quartier, rue, en face de la station…"
            />
          </div>

          <div className="col-span-1 sm:col-span-2 space-y-1.5">
            <Label htmlFor="pv-contact">Contact / responsable</Label>
            <Input
              id="pv-contact"
              value={valeurs.contact_nom}
              onChange={(e) => set("contact_nom", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pv-tel">Téléphone</Label>
            <Input
              id="pv-tel"
              type="tel"
              value={valeurs.contact_tel}
              aria-invalid={Boolean(erreurs.contact_tel)}
              onChange={(e) => set("contact_tel", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pv-email">Email</Label>
            <Input
              id="pv-email"
              type="email"
              value={valeurs.contact_email}
              aria-invalid={Boolean(erreurs.contact_email)}
              onChange={(e) => set("contact_email", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pv-potentiel">Potentiel (XOF / mois)</Label>
            <Input
              id="pv-potentiel"
              type="number"
              min={0}
              value={valeurs.potentiel_ca}
              aria-invalid={Boolean(erreurs.potentiel_ca)}
              onChange={(e) => set("potentiel_ca", e.target.value)}
            />
            {erreurs.potentiel_ca ? (
              <p className="text-xs font-medium text-destructive">
                {erreurs.potentiel_ca}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Chiffre d&apos;affaires mensuel estimé.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pv-relance">Prochaine relance</Label>
            <Input
              id="pv-relance"
              type="date"
              value={valeurs.date_prochaine_relance}
              aria-invalid={Boolean(erreurs.date_prochaine_relance)}
              onChange={(e) => set("date_prochaine_relance", e.target.value)}
            />
            {erreurs.date_prochaine_relance && (
              <p className="text-xs font-medium text-destructive">
                {erreurs.date_prochaine_relance}
              </p>
            )}
          </div>

          <div className="col-span-1 sm:col-span-2 space-y-1.5">
            <Label htmlFor="pv-commercial">Commercial en charge</Label>
            <SelectSimple
              id="pv-commercial"
              value={valeurs.commercial}
              onChange={(v) => set("commercial", v)}
              options={optionsDe(options, "commerciaux")}
              placeholder="Moi-même"
            />
            <p className="text-xs text-muted-foreground">
              Par défaut, le point revient à celui qui le crée.
            </p>
          </div>

          {/* Le serveur peut refuser pour une raison qui ne vise aucun champ. */}
          {erreurs.__global__ && (
            <p className="col-span-1 sm:col-span-2 text-xs font-medium text-destructive">
              {erreurs.__global__}
            </p>
          )}
        </form>

        <SheetFooter className="flex-row justify-end gap-2">
          <SheetClose render={<Button variant="outline">Annuler</Button>} />
          <Button type="submit" form="form-point-vente" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function optionsDe(options: FormOptions, cle: string) {
  return (options[cle] ?? []).map((o) => ({
    value: String(o.value),
    label: o.label,
  }));
}

// Réexporté pour la fiche détaillée, qui propose les mêmes listes.
export { optionsDe };
export const VALEURS_VIDES = VIDE;

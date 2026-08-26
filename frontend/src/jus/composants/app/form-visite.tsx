"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Crosshair, Loader2, X } from "lucide-react";
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
import { Textarea } from "@/jus/composants/ui/textarea";
import { SelectSimple } from "@/jus/composants/app/select-simple";
import type { PointVente } from "@/jus/lib/api";
import { STATUTS, coords, releverPosition } from "@/jus/lib/prospection";

export type ChargeVisite = {
  compte_rendu: string;
  statut_constate: string;
  date_visite: string;
  date_prochaine_relance: string;
  latitude: string;
  longitude: string;
  photo: File | null;
};

/** Date du jour au format attendu par `<input type="datetime-local">`. */
function maintenantLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/**
 * Saisie d'une visite terrain : compte rendu, photo, statut constaté et
 * prochaine relance. C'est l'écran utilisé au téléphone, devant la boutique.
 */
export function FormVisite({
  point,
  ouvert,
  onOuvert,
  erreurs = {},
  enCours = false,
  onSubmit,
}: {
  point: PointVente | null;
  ouvert: boolean;
  onOuvert: (v: boolean) => void;
  erreurs?: Record<string, string>;
  enCours?: boolean;
  onSubmit: (charge: ChargeVisite) => void;
}) {
  const [compteRendu, setCompteRendu] = useState("");
  const [statut, setStatut] = useState("");
  const [dateVisite, setDateVisite] = useState(maintenantLocal);
  const [relance, setRelance] = useState("");
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [localisation, setLocalisation] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const champFichier = useRef<HTMLInputElement>(null);

  // Réinitialisation à chaque ouverture : sans cela, le compte rendu du point
  // précédent réapparaîtrait sur la visite suivante.
  useEffect(() => {
    if (!ouvert) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompteRendu("");
    setStatut(point?.statut ?? "");
    setDateVisite(maintenantLocal());
    setRelance("");
    setPosition(null);
    setPhoto(null);
    setApercu(null);
    if (champFichier.current) champFichier.current.value = "";
  }, [ouvert, point]);

  // L'aperçu est une URL d'objet : la révoquer évite de garder la photo en
  // mémoire après la fermeture du panneau. `URL` est une API du navigateur,
  // donc bien un système externe à synchroniser depuis un effet.
  useEffect(() => {
    if (!photo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setApercu(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setApercu(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function meLocaliser() {
    setLocalisation(true);
    try {
      const p = await releverPosition();
      setPosition({ lat: p.latitude, lng: p.longitude });
      toast.success(`Position relevée (précision ${Math.round(p.precision)} m)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Localisation impossible");
    } finally {
      setLocalisation(false);
    }
  }

  function choisirPhoto(fichier: File | null) {
    if (!fichier) {
      setPhoto(null);
      return;
    }
    if (!fichier.type.startsWith("image/")) {
      toast.error("Choisissez une image (photo de la devanture, du rayon…).");
      return;
    }
    setPhoto(fichier);
  }

  return (
    <Sheet open={ouvert} onOpenChange={onOuvert}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Enregistrer une visite</SheetTitle>
          <SheetDescription>
            {point ? point.nom : "—"} — le statut choisi remplacera celui du
            point de vente sur la carte.
          </SheetDescription>
        </SheetHeader>

        <form
          id="form-visite"
          className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              compte_rendu: compteRendu,
              statut_constate: statut,
              date_visite: dateVisite,
              date_prochaine_relance: relance,
              latitude: position ? String(position.lat) : "",
              longitude: position ? String(position.lng) : "",
              photo,
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="v-date">Date et heure</Label>
            <Input
              id="v-date"
              type="datetime-local"
              value={dateVisite}
              aria-invalid={Boolean(erreurs.date_visite)}
              onChange={(e) => setDateVisite(e.target.value)}
            />
            {erreurs.date_visite && (
              <p className="text-xs font-medium text-destructive">
                {erreurs.date_visite}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="v-statut">Statut constaté</Label>
            <SelectSimple
              id="v-statut"
              value={statut}
              onChange={setStatut}
              options={STATUTS.map((s) => ({ value: s.valeur, label: s.label }))}
              placeholder="Inchangé"
            />
          </div>

          <div className="col-span-1 sm:col-span-2 space-y-1.5">
            <Label htmlFor="v-cr">Compte rendu</Label>
            <Textarea
              id="v-cr"
              rows={4}
              value={compteRendu}
              aria-invalid={Boolean(erreurs.compte_rendu)}
              onChange={(e) => setCompteRendu(e.target.value)}
              placeholder="Gérant absent, repasser jeudi. Concurrence : 2 marques en rayon."
            />
            {erreurs.compte_rendu && (
              <p className="text-xs font-medium text-destructive">
                {erreurs.compte_rendu}
              </p>
            )}
          </div>

          {/* --- Photo --- */}
          <div className="col-span-1 sm:col-span-2 space-y-2">
            <Label htmlFor="v-photo">Photo du point prospecté</Label>
            <input
              ref={champFichier}
              id="v-photo"
              type="file"
              accept="image/*"
              // `capture` ouvre directement l'appareil photo arrière sur mobile,
              // au lieu de la galerie : c'est le geste attendu sur le terrain.
              capture="environment"
              className="hidden"
              onChange={(e) => choisirPhoto(e.target.files?.[0] ?? null)}
            />
            {apercu ? (
              <div className="relative overflow-hidden rounded-xl border">
                {/* Aperçu local (blob:) : `next/image` ne peut pas l'optimiser,
                    d'où la balise native. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={apercu}
                  alt="Aperçu de la photo"
                  className="max-h-56 w-full object-cover"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-2 size-8"
                  onClick={() => {
                    setPhoto(null);
                    if (champFichier.current) champFichier.current.value = "";
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => champFichier.current?.click()}
              >
                <Camera className="size-4" />
                Prendre une photo
              </Button>
            )}
            {erreurs.photo && (
              <p className="text-xs font-medium text-destructive">{erreurs.photo}</p>
            )}
          </div>

          <div className="col-span-1 sm:col-span-2 space-y-1.5">
            <Label htmlFor="v-relance">Date de prochaine relance</Label>
            <Input
              id="v-relance"
              type="date"
              value={relance}
              aria-invalid={Boolean(erreurs.date_prochaine_relance)}
              onChange={(e) => setRelance(e.target.value)}
            />
            {erreurs.date_prochaine_relance ? (
              <p className="text-xs font-medium text-destructive">
                {erreurs.date_prochaine_relance}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Reportée sur la fiche du point de vente.
              </p>
            )}
          </div>

          {/* --- Position du relevé --- */}
          <div className="col-span-1 sm:col-span-2 flex items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Position du relevé</p>
              <p className="truncate text-xs text-muted-foreground">
                {position
                  ? coords(position.lat, position.lng)
                  : "Facultatif : atteste du passage sur place."}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 gap-2"
              disabled={localisation}
              onClick={meLocaliser}
            >
              {localisation ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Crosshair className="size-4" />
              )}
              Relever
            </Button>
          </div>

          {erreurs.__global__ && (
            <p className="col-span-1 sm:col-span-2 text-xs font-medium text-destructive">
              {erreurs.__global__}
            </p>
          )}
        </form>

        <SheetFooter className="flex-row justify-end gap-2">
          <SheetClose render={<Button variant="outline">Annuler</Button>} />
          <Button type="submit" form="form-visite" disabled={enCours}>
            {enCours ? "Envoi…" : "Enregistrer la visite"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

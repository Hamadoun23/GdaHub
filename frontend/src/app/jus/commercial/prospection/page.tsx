"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Loader2,
  MapPin,
  MapPinPlus,
  Phone,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/jus/composants/ui/button";
import { Input } from "@/jus/composants/ui/input";
import { Card } from "@/jus/composants/ui/card";
import { PageHeader } from "@/jus/composants/app/page-header";
import { StatusBadge } from "@/jus/composants/app/status-badge";
import { CarteProspection } from "@/jus/composants/app/carte-prospection";
import { LienItineraire } from "@/jus/composants/app/lien-itineraire";
import { SelectSimple } from "@/jus/composants/app/select-simple";
import {
  FormPointVente,
  optionsDe,
  type ValeursPoint,
} from "@/jus/composants/app/form-point-vente";
import { FormVisite, type ChargeVisite } from "@/jus/composants/app/form-visite";
import {
  ApiError,
  createItem,
  envoyerFormData,
  fetchList,
  fetchOptions,
  type FormOptions,
  type PointVente,
} from "@/jus/lib/api";
import { FRAICHEUR_OPTIONS_MS, invaliderPrefixe, useDonnees } from "@/jus/lib/cache";
import { frDate, xof } from "@/jus/lib/format";
import { STATUTS, metaStatut } from "@/jus/lib/prospection";
import { cn } from "@/jus/lib/utils";

const CLE_POINTS = "liste:points-vente";

export default function Page() {
  const {
    donnees: pointsEnCache,
    chargement,
    erreur,
    muter,
    revalider,
  } = useDonnees<PointVente[]>(CLE_POINTS, () =>
    fetchList<PointVente>("points-vente")
  );
  const { donnees: optionsEnCache } = useDonnees<FormOptions>(
    "options",
    fetchOptions,
    { fraicheurMs: FRAICHEUR_OPTIONS_MS }
  );

  const points = useMemo(() => pointsEnCache ?? [], [pointsEnCache]);
  const options = optionsEnCache ?? {};

  const [recherche, setRecherche] = useState("");
  const [statutsActifs, setStatutsActifs] = useState<string[]>([]);
  const [commercial, setCommercial] = useState("");
  const [selectionId, setSelectionId] = useState<number | null>(null);

  const [formPoint, setFormPoint] = useState(false);
  const [formVisite, setFormVisite] = useState(false);
  const [positionCarte, setPositionCarte] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [erreursChamps, setErreursChamps] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);

  const selection = points.find((p) => p.id === selectionId) ?? null;

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return points.filter((p) => {
      if (statutsActifs.length && !statutsActifs.includes(p.statut)) return false;
      if (commercial && String(p.commercial ?? "") !== commercial) return false;
      if (!q) return true;
      return `${p.nom} ${p.adresse} ${p.contact_nom} ${p.contact_tel} ${p.type_display}`
        .toLowerCase()
        .includes(q);
    });
  }, [points, recherche, statutsActifs, commercial]);

  const totaux = useMemo(
    () => ({
      points: points.length,
      clients: points.filter((p) => p.statut === "CLIENT").length,
      aRelancer: points.filter((p) => p.statut === "A_RELANCER").length,
      enRetard: points.filter((p) => p.relance_en_retard).length,
      // Le potentiel des refus ne se réalisera pas : l'inclure gonflerait
      // artificiellement l'objectif du portefeuille.
      potentiel: points
        .filter((p) => p.statut !== "REFUS")
        .reduce((s, p) => s + (p.potentiel_ca || 0), 0),
    }),
    [points]
  );

  function basculerStatut(valeur: string) {
    setStatutsActifs((actifs) =>
      actifs.includes(valeur)
        ? actifs.filter((s) => s !== valeur)
        : [...actifs, valeur]
    );
  }

  function gererErreur(e: unknown, repli: string) {
    if (e instanceof ApiError) {
      // DRF renvoie les refus transversaux dans `non_field_errors`, que le
      // client range dans le message : on le rattache à un pseudo-champ pour
      // qu'il reste visible dans le panneau.
      setErreursChamps(
        Object.keys(e.fieldErrors).length
          ? e.fieldErrors
          : { __global__: e.message }
      );
      toast.error(e.message);
    } else {
      toast.error(repli);
    }
  }

  async function enregistrerPoint(valeurs: ValeursPoint) {
    setEnvoi(true);
    setErreursChamps({});
    try {
      const cree = await createItem<PointVente>("points-vente", {
        nom: valeurs.nom,
        type_point: valeurs.type_point,
        latitude: valeurs.latitude === "" ? null : Number(valeurs.latitude),
        longitude: valeurs.longitude === "" ? null : Number(valeurs.longitude),
        adresse: valeurs.adresse,
        contact_nom: valeurs.contact_nom,
        contact_tel: valeurs.contact_tel,
        contact_email: valeurs.contact_email,
        statut: valeurs.statut,
        potentiel_ca: valeurs.potentiel_ca === "" ? 0 : Number(valeurs.potentiel_ca),
        date_prochaine_relance: valeurs.date_prochaine_relance || null,
        commercial: valeurs.commercial ? Number(valeurs.commercial) : null,
      });
      muter([cree, ...points]);
      setFormPoint(false);
      setPositionCarte(null);
      setSelectionId(cree.id);
      toast.success("Point de vente enregistré");
    } catch (e) {
      gererErreur(e, "Enregistrement impossible");
    } finally {
      setEnvoi(false);
    }
  }

  async function enregistrerVisite(charge: ChargeVisite) {
    if (!selection) return;
    setEnvoi(true);
    setErreursChamps({});
    try {
      const form = new FormData();
      form.append("point_vente", String(selection.id));
      form.append("compte_rendu", charge.compte_rendu);
      if (charge.statut_constate) form.append("statut_constate", charge.statut_constate);
      if (charge.date_visite) form.append("date_visite", charge.date_visite);
      if (charge.date_prochaine_relance)
        form.append("date_prochaine_relance", charge.date_prochaine_relance);
      if (charge.latitude) form.append("latitude", charge.latitude);
      if (charge.longitude) form.append("longitude", charge.longitude);
      if (charge.photo) form.append("photo", charge.photo);

      await envoyerFormData("visites", form);
      setFormVisite(false);
      toast.success("Visite enregistrée");
      // Une visite change le statut du point, sa relance et sa vignette : on
      // relit la liste plutôt que de recomposer ces champs côté client.
      await revalider();
      // La fiche détaillée du point garde son propre historique en cache.
      invaliderPrefixe(`point-vente:${selection.id}`);
    } catch (e) {
      gererErreur(e, "Enregistrement impossible");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cartographie commerciale"
        description="Points de vente prospectés, statut du démarchage et relances à venir."
      >
        <Button
          variant={positionCarte ? "default" : "outline"}
          className="gap-2"
          onClick={() => {
            setPositionCarte(null);
            setErreursChamps({});
            setFormPoint(true);
          }}
        >
          <MapPinPlus className="size-4" />
          Nouveau point
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-3">
        <Compteur label="Points de vente" valeur={totaux.points} />
        <Compteur label="Clients" valeur={totaux.clients} />
        <Compteur label="À relancer" valeur={totaux.aRelancer} />
        <Compteur
          label="Relances en retard"
          valeur={totaux.enRetard}
          alerte={totaux.enRetard > 0}
        />
        <Compteur label="Potentiel mensuel" valeur={xof(totaux.potentiel)} />
      </div>

      {/* --- Filtres --- */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom, quartier, contact…"
            className="bg-background pl-9"
          />
        </div>
        <div className="w-52">
          <SelectSimple
            value={commercial}
            onChange={setCommercial}
            options={[
              { value: "", label: "Tous les commerciaux" },
              ...optionsDe(options, "commerciaux"),
            ]}
            placeholder="Tous les commerciaux"
          />
        </div>
        {statutsActifs.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setStatutsActifs([])}
          >
            <X className="size-3.5" />
            Tout afficher
          </Button>
        )}
      </div>

      {/* Légende cliquable : elle sert à la fois de repère des couleurs et de
          filtre, ce que la liste seule ne permettait pas. */}
      <div className="flex flex-wrap gap-2">
        {STATUTS.map((s) => {
          const actif = statutsActifs.includes(s.valeur);
          const nb = points.filter((p) => p.statut === s.valeur).length;
          return (
            <button
              key={s.valeur}
              type="button"
              onClick={() => basculerStatut(s.valeur)}
              aria-pressed={actif}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                actif
                  ? "border-foreground/30 bg-foreground/5"
                  : "bg-card hover:bg-muted/60"
              )}
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: s.hex }}
              />
              {s.label}
              <span className="tabular-nums text-muted-foreground">{nb}</span>
            </button>
          );
        })}
      </div>

      {erreur && (
        <Card className="border-destructive/40 p-4 text-sm text-destructive">
          {erreur}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="relative h-[420px] overflow-hidden rounded-2xl p-0 shadow-sm lg:h-[600px]">
          {chargement ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <CarteProspection
              points={filtres}
              selectionId={selectionId}
              onSelection={(p) => setSelectionId(p.id)}
              // Le clic ne pose un point que si le panneau de création est
              // ouvert : autrement, chaque clic sur la carte en créerait un.
              onClicCarte={
                formPoint
                  ? (lat, lng) => setPositionCarte({ latitude: lat, longitude: lng })
                  : undefined
              }
              provisoire={formPoint ? positionCarte : null}
            />
          )}
          {formPoint && (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-[400] flex justify-center">
              <span className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg">
                Cliquez sur la carte pour poser le point
              </span>
            </div>
          )}
        </Card>

        {/* --- Liste latérale --- */}
        <Card className="flex max-h-[600px] flex-col overflow-hidden rounded-2xl p-0 shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-medium">
              {filtres.length} point{filtres.length > 1 ? "s" : ""}
            </p>
            {selection && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setErreursChamps({});
                  setFormVisite(true);
                }}
              >
                <Plus className="size-3.5" />
                Visite
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {chargement && (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!chargement && filtres.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {points.length === 0
                  ? "Aucun point prospecté pour le moment."
                  : "Aucun point ne correspond aux filtres."}
              </p>
            )}

            {filtres.map((p) => {
              const meta = metaStatut(p.statut);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectionId(p.id)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50",
                    p.id === selectionId && "bg-muted/70"
                  )}
                >
                  <span
                    className="mt-1 size-3 shrink-0 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: meta.hex }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{p.nom}</span>
                      {p.relance_en_retard && (
                        <StatusBadge label="En retard" tone="orange" />
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {p.type_display}
                      {p.adresse ? ` · ${p.adresse}` : ""}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{meta.label}</span>
                      {p.nb_visites > 0 && (
                        <span>
                          {p.nb_visites} visite{p.nb_visites > 1 ? "s" : ""}
                        </span>
                      )}
                      {p.potentiel_ca > 0 && <span>{xof(p.potentiel_ca)}</span>}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>

          {/* Aperçu du point sélectionné, sans quitter la carte. */}
          {selection && (
            <div className="space-y-2 border-t bg-muted/30 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{selection.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {selection.commercial_nom || "Non attribué"}
                  </p>
                </div>
                <StatusBadge
                  label={metaStatut(selection.statut).label}
                  tone={metaStatut(selection.statut).tone}
                />
              </div>
              {selection.contact_nom && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="size-3.5" />
                  {selection.contact_nom}
                  {selection.contact_tel ? ` · ${selection.contact_tel}` : ""}
                </p>
              )}
              {selection.date_prochaine_relance && (
                <p
                  className={cn(
                    "text-xs",
                    selection.relance_en_retard
                      ? "font-medium text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  )}
                >
                  Relance le {frDate(selection.date_prochaine_relance)}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {/* Un lien stylé en bouton, et non un `Button` déguisé : ces
                    éléments naviguent, ils doivent rester des <a> pour le
                    clavier, les lecteurs d'écran et l'ouverture en nouvel onglet. */}
                <Link
                  href={`/jus/commercial/prospection/${selection.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-2"
                  )}
                >
                  <MapPin className="size-4" />
                  Fiche
                </Link>
                <LienItineraire
                  latitude={selection.latitude}
                  longitude={selection.longitude}
                />
              </div>
            </div>
          )}
        </Card>
      </div>

      <FormPointVente
        ouvert={formPoint}
        onOuvert={(v) => {
          setFormPoint(v);
          if (!v) setPositionCarte(null);
        }}
        positionCarte={positionCarte}
        options={options}
        erreurs={erreursChamps}
        enCours={envoi}
        onSubmit={enregistrerPoint}
      />

      <FormVisite
        point={selection}
        ouvert={formVisite}
        onOuvert={setFormVisite}
        erreurs={erreursChamps}
        enCours={envoi}
        onSubmit={enregistrerVisite}
      />
    </div>
  );
}

function Compteur({
  label,
  valeur,
  alerte,
}: {
  label: string;
  valeur: string | number;
  alerte?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-2.5 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          alerte && "text-amber-600 dark:text-amber-400"
        )}
      >
        {valeur}
      </p>
    </div>
  );
}

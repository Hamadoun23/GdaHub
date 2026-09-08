"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Camera,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  UserPlus,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { PageHeader } from "@/jus/composants/app/page-header";
import { StatusBadge } from "@/jus/composants/app/status-badge";
import { FormSheet } from "@/jus/composants/app/form-sheet";
import { CarteProspection } from "@/jus/composants/app/carte-prospection";
import { LienItineraire } from "@/jus/composants/app/lien-itineraire";
import {
  FormPointVente,
  depuisPoint,
  type ValeursPoint,
} from "@/jus/composants/app/form-point-vente";
import { FormVisite, type ChargeVisite } from "@/jus/composants/app/form-visite";
import {
  ApiError,
  envoyerFormData,
  fetchOptions,
  fetchPointVente,
  postAction,
  updateItem,
  type FormOptions,
  type PointVenteDetail,
} from "@/jus/lib/api";
import { FRAICHEUR_OPTIONS_MS, invaliderPrefixe, useDonnees } from "@/jus/lib/cache";
import { frDate, xof } from "@/jus/lib/format";
import { coords, dateHeure, metaStatut } from "@/jus/lib/prospection";
import type { Field } from "@/jus/lib/types";
import { cn } from "@/lib/cn";

const CHAMPS_CONVERSION: Field[] = [
  { name: "nom_complet", label: "Nom du client", type: "text", colSpan: 2, hint: "Vide : le nom du point de vente est repris." },
  { name: "tel_client", label: "Téléphone", type: "tel" },
  { name: "email", label: "Email", type: "email" },
  { name: "adresse", label: "Adresse", type: "textarea" },
];

export default function FichePointVente() {
  const { id } = useParams<{ id: string }>();
  const [point, setPoint] = useState<PointVenteDetail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [formVisite, setFormVisite] = useState(false);
  const [formEdition, setFormEdition] = useState(false);
  const [formConversion, setFormConversion] = useState(false);
  const [erreursChamps, setErreursChamps] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);

  const { donnees: optionsEnCache } = useDonnees<FormOptions>(
    "options",
    fetchOptions,
    { fraicheurMs: FRAICHEUR_OPTIONS_MS }
  );

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setPoint(await fetchPointVente(id));
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "Point de vente introuvable");
    } finally {
      setChargement(false);
    }
  }, [id]);

  // `charger` est asynchrone : les setState n'ont lieu qu'après la réponse du
  // serveur, pas en cascade pendant le rendu (même schéma que la fiche facture).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  function gererErreur(e: unknown, repli: string) {
    if (e instanceof ApiError) {
      setErreursChamps(
        Object.keys(e.fieldErrors).length ? e.fieldErrors : { __global__: e.message }
      );
      toast.error(e.message);
    } else {
      toast.error(repli);
    }
  }

  /** La carte de la page précédente doit refléter le nouveau statut. */
  function invaliderListe() {
    invaliderPrefixe("liste:points-vente");
  }

  async function enregistrerVisite(charge: ChargeVisite) {
    if (!point) return;
    setEnvoi(true);
    setErreursChamps({});
    try {
      const form = new FormData();
      form.append("point_vente", String(point.id));
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
      invaliderListe();
      charger();
    } catch (e) {
      gererErreur(e, "Enregistrement impossible");
    } finally {
      setEnvoi(false);
    }
  }

  async function enregistrerModification(valeurs: ValeursPoint) {
    if (!point) return;
    setEnvoi(true);
    setErreursChamps({});
    try {
      const modifie = await updateItem<PointVenteDetail>("points-vente", point.id, {
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
      // PATCH renvoie la fiche sans son historique : on garde les visites déjà
      // affichées plutôt que de vider la page le temps d'un rechargement.
      setPoint({ ...modifie, visites: point.visites });
      setFormEdition(false);
      toast.success("Point de vente modifié");
      invaliderListe();
    } catch (e) {
      gererErreur(e, "Enregistrement impossible");
    } finally {
      setEnvoi(false);
    }
  }

  async function convertirEnClient(valeurs: Record<string, string | boolean>) {
    if (!point) return;
    setEnvoi(true);
    setErreursChamps({});
    try {
      const reponse = await postAction<{ detail: string }>(
        "points-vente",
        point.id,
        "convertir_client",
        valeurs
      );
      toast.success(reponse.detail ?? "Client créé");
      setFormConversion(false);
      invaliderListe();
      // Le fichier clients vient de changer : les écrans Ventes et Commandes
      // proposent ce nouveau client dans leurs listes déroulantes.
      invaliderPrefixe("liste:clients");
      invaliderPrefixe("options");
      charger();
    } catch (e) {
      gererErreur(e, "Conversion impossible");
    } finally {
      setEnvoi(false);
    }
  }

  if (chargement) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (erreur || !point) {
    return (
      <Card className="p-8 text-center">
        <p className="text-destructive">{erreur ?? "Point de vente introuvable"}</p>
        <Link
          href="/jus/commercial/prospection"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          ← Retour à la carte
        </Link>
      </Card>
    );
  }

  const meta = metaStatut(point.statut);
  const photos = point.visites.filter((v) => v.photo_url);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/jus/commercial/prospection"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour à la carte
        </Link>
      </div>

      <PageHeader
        title={point.nom}
        description={`${point.type_display}${point.adresse ? ` · ${point.adresse}` : ""}`}
      >
        <LienItineraire
          latitude={point.latitude}
          longitude={point.longitude}
          taille="default"
        />
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            setErreursChamps({});
            setFormEdition(true);
          }}
        >
          <Pencil className="size-4" />
          Modifier
        </Button>
        {/* Un point déjà rattaché n'a plus rien à convertir. */}
        {!point.client && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setErreursChamps({});
              setFormConversion(true);
            }}
          >
            <UserPlus className="size-4" />
            Convertir en client
          </Button>
        )}
        <Button
          className="gap-2"
          onClick={() => {
            setErreursChamps({});
            setFormVisite(true);
          }}
        >
          <Plus className="size-4" />
          Enregistrer une visite
        </Button>
      </PageHeader>

      {/* Bandeau statut + relance */}
      <Card
        className="border-l-4 p-5"
        style={{ borderLeftColor: meta.hex }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="size-3.5 rounded-full ring-2 ring-background"
              style={{ backgroundColor: meta.hex }}
            />
            <div>
              <p className="font-semibold">{point.statut_display}</p>
              <p className="text-sm text-muted-foreground">
                {point.nb_visites} visite{point.nb_visites > 1 ? "s" : ""}
                {point.derniere_visite
                  ? ` · dernière le ${frDate(point.derniere_visite)}`
                  : " · jamais visité"}
              </p>
            </div>
          </div>

          {point.date_prochaine_relance && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                point.relance_en_retard
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <CalendarClock className="size-4" />
              <span>
                Relance le {frDate(point.date_prochaine_relance)}
                {point.relance_en_retard ? " — en retard" : ""}
              </span>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* --- Colonne gauche : carte + historique --- */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="h-64 overflow-hidden rounded-2xl p-0 shadow-sm">
            <CarteProspection points={[point]} selectionId={point.id} />
          </Card>

          {photos.length > 0 && (
            <Card className="p-5">
              <h3 className="flex items-center gap-2 font-semibold">
                <Camera className="size-4" />
                Photos ({photos.length})
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((v) => (
                  <a
                    key={v.id}
                    href={v.photo_url!}
                    target="_blank"
                    rel="noreferrer"
                    className="group overflow-hidden rounded-xl border"
                    title={`Visite du ${dateHeure(v.date_visite)}`}
                  >
                    {/* Les photos sont servies par Django sur un autre domaine :
                        `next/image` exigerait de déclarer chaque hôte, alors que
                        l'API est déjà redimensionnée à 1280 px. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.photo_url!}
                      alt={`Point de vente le ${frDate(v.date_visite)}`}
                      loading="lazy"
                      className="h-32 w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </a>
                ))}
              </div>
            </Card>
          )}

          {/* Historique des visites */}
          <Card className="p-0">
            <div className="border-b px-5 py-4">
              <h3 className="font-semibold">
                Historique des visites ({point.visites.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                Du passage le plus récent au plus ancien.
              </p>
            </div>

            {point.visites.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Aucune visite enregistrée pour ce point.
              </p>
            ) : (
              <ol className="divide-y">
                {point.visites.map((v) => {
                  const metaVisite = v.statut_constate
                    ? metaStatut(v.statut_constate)
                    : null;
                  return (
                    <li key={v.id} className="flex gap-4 px-5 py-4">
                      <span
                        className="mt-1.5 size-3 shrink-0 rounded-full ring-2 ring-background"
                        style={{
                          backgroundColor: metaVisite?.hex ?? "var(--color-muted-foreground)",
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">
                            {dateHeure(v.date_visite)}
                          </p>
                          {metaVisite && (
                            <StatusBadge
                              label={metaVisite.label}
                              tone={metaVisite.tone}
                            />
                          )}
                        </div>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <UserRound className="size-3.5" />
                          {v.commercial_nom || "Commercial inconnu"}
                          {v.latitude != null && v.longitude != null && (
                            <span className="ml-1 inline-flex items-center gap-1">
                              <MapPin className="size-3.5" />
                              {coords(v.latitude, v.longitude)}
                            </span>
                          )}
                        </p>
                        {v.compte_rendu && (
                          <p className="mt-2 whitespace-pre-line text-sm">
                            {v.compte_rendu}
                          </p>
                        )}
                        {v.photo_url && (
                          <a
                            href={v.photo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block w-fit overflow-hidden rounded-lg border"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={v.photo_url}
                              alt={`Photo de la visite du ${frDate(v.date_visite)}`}
                              loading="lazy"
                              className="h-28 w-auto object-cover"
                            />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        {/* --- Colonne droite : identité --- */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold">Contact sur place</h3>
            <p className="mt-2 font-medium">{point.contact_nom || "—"}</p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              {point.contact_tel && (
                <p className="flex items-center gap-2">
                  <Phone className="size-4" />
                  <a href={`tel:${point.contact_tel}`} className="hover:text-foreground">
                    {point.contact_tel}
                  </a>
                </p>
              )}
              {point.contact_email && (
                <p className="flex items-center gap-2">
                  <Mail className="size-4" />
                  <a
                    href={`mailto:${point.contact_email}`}
                    className="hover:text-foreground"
                  >
                    {point.contact_email}
                  </a>
                </p>
              )}
              {!point.contact_tel && !point.contact_email && (
                <p>Aucun moyen de contact renseigné.</p>
              )}
            </div>
          </Card>

          <Card className="space-y-3 p-5 text-sm">
            <h3 className="font-semibold">Suivi commercial</h3>
            <Ligne label="Commercial" valeur={point.commercial_nom || "Non attribué"} />
            <Ligne
              label="Potentiel mensuel"
              valeur={point.potentiel_ca > 0 ? xof(point.potentiel_ca) : "Non estimé"}
            />
            <Ligne label="Type" valeur={point.type_display} />
            <Ligne
              label="Coordonnées"
              valeur={coords(point.latitude, point.longitude)}
            />
            <Ligne label="Créé le" valeur={frDate(point.cree_le)} />

            <div className="border-t pt-3">
              <p className="text-muted-foreground">Client rattaché</p>
              {point.client ? (
                <Link
                  href="/jus/commercial/clients"
                  className="mt-1 inline-block font-medium text-primary hover:underline"
                >
                  {point.client_nom}
                </Link>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  Aucun : ce point n&apos;a pas encore acheté.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <FormVisite
        point={point}
        ouvert={formVisite}
        onOuvert={setFormVisite}
        erreurs={erreursChamps}
        enCours={envoi}
        onSubmit={enregistrerVisite}
      />

      <FormPointVente
        ouvert={formEdition}
        onOuvert={setFormEdition}
        initial={depuisPoint(point)}
        options={optionsEnCache ?? {}}
        erreurs={erreursChamps}
        enCours={envoi}
        onSubmit={enregistrerModification}
      />

      <FormSheet
        open={formConversion}
        onOpenChange={setFormConversion}
        title={`Convertir « ${point.nom} » en client`}
        description="Crée la fiche client à partir des informations du point de vente. Les champs laissés vides reprennent celles-ci."
        fields={CHAMPS_CONVERSION}
        initial={{
          nom_complet: point.nom,
          tel_client: point.contact_tel,
          email: point.contact_email,
          adresse: point.adresse,
        }}
        errors={erreursChamps}
        submitting={envoi}
        submitLabel="Créer le client"
        onSubmit={convertirEnClient}
      />
    </div>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{valeur}</span>
    </div>
  );
}

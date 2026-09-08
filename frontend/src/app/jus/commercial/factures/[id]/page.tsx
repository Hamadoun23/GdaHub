"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  HandCoins,
  Loader2,
  Mail,
  Phone,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { PageHeader } from "@/jus/composants/app/page-header";
import { FormSheet } from "@/jus/composants/app/form-sheet";
import { StatusBadge, type Tone } from "@/jus/composants/app/status-badge";
import { frDate, xof } from "@/jus/lib/format";
import { buildToApi } from "@/jus/lib/data/helpers";
import {
  ApiError,
  fetchFacture,
  postAction,
  type FactureDetail,
} from "@/jus/lib/api";
import type { Field } from "@/jus/lib/types";

/**
 * Fiche de recouvrement d'une facture.
 *
 * Le modèle ne comporte pas d'échéancier : le seul engagement de paiement est
 * la date d'échéance de la facture. Le « prochain règlement » correspond donc
 * au reste dû, attendu pour cette date — et c'est cette date qui déclenche la
 * relance puis le recouvrement.
 */

const TON_RECOUVREMENT: Record<string, Tone> = {
  SOLDEE: "green",
  A_ECHOIR: "blue",
  RELANCE: "amber",
  RECOUVREMENT: "red",
  SANS_ECHEANCE: "gray",
};

const CHAMPS_PAIEMENT: Field[] = [
  { name: "date_paie", label: "Date de paiement", type: "date", required: true },
  { name: "montant", label: "Montant (XOF)", type: "number", required: true },
  { name: "mode_paie", label: "Mode de paiement", type: "select", required: true, options: [
    { value: "ESPECE", label: "Espèce" },
    { value: "CHEQUE", label: "Chèque" },
    { value: "VIREMENT", label: "Virement" },
    { value: "MOBILE", label: "Mobile" },
  ] },
  { name: "reference", label: "Référence", type: "text", colSpan: 2, hint: "N° de chèque, de virement… (optionnel)" },
];

export default function FactureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [facture, setFacture] = useState<FactureDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panneau, setPanneau] = useState(false);
  const [erreursChamp, setErreursChamp] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFacture(await fetchFacture(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Facture introuvable");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function enregistrerPaiement(values: Record<string, string | boolean>) {
    setEnvoi(true);
    setErreursChamp({});
    try {
      const corps = buildToApi({ numbers: ["montant"] })(values);
      const reponse = await postAction<{ detail: string }>(
        "factures",
        id,
        "paiement",
        corps
      );
      toast.success(reponse.detail ?? "Paiement enregistré");
      setPanneau(false);
      charger();
    } catch (e) {
      if (e instanceof ApiError) {
        setErreursChamp(e.fieldErrors);
        toast.error(e.message);
      } else {
        toast.error("Enregistrement impossible");
      }
    } finally {
      setEnvoi(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !facture) {
    return (
      <Card className="p-8 text-center">
        <p className="text-destructive">{error ?? "Facture introuvable"}</p>
        <Link href="/jus/commercial/factures" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Retour aux factures
        </Link>
      </Card>
    );
  }

  const r = facture.recouvrement;
  const solde = facture.reste_a_payer <= 0;
  const enRetard = r.statut === "RECOUVREMENT";
  const partPayee = facture.montant > 0 ? (facture.total_paye / facture.montant) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/jus/commercial/factures"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour aux factures
        </Link>
      </div>

      <PageHeader
        title={facture.num_fact}
        description={`${facture.client_nom} · émise le ${frDate(facture.date_fact)}`}
      >
        {!solde && (
          <Button onClick={() => setPanneau(true)} className="gap-2">
            <HandCoins className="size-4" />
            Enregistrer un paiement
          </Button>
        )}
      </PageHeader>

      {/* Bandeau de recouvrement : ce que le commercial doit faire, et quand. */}
      <Card
        className={`border-l-4 p-5 ${
          enRetard
            ? "border-l-red-500 bg-red-500/5"
            : r.statut === "RELANCE"
              ? "border-l-amber-500 bg-amber-500/5"
              : solde
                ? "border-l-emerald-500 bg-emerald-500/5"
                : "border-l-blue-500 bg-blue-500/5"
        }`}
      >
        <div className="flex flex-wrap items-start gap-4">
          <span className="mt-0.5">
            {solde ? (
              <CheckCircle2 className="size-6 text-emerald-600" />
            ) : enRetard ? (
              <AlertTriangle className="size-6 text-red-600" />
            ) : (
              <CalendarClock className="size-6 text-blue-600" />
            )}
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Recouvrement</h2>
              <StatusBadge label={r.libelle} tone={TON_RECOUVREMENT[r.statut] ?? "gray"} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{r.action}</p>
            {!solde && (
              <p className="mt-2 text-sm">
                Échéance :{" "}
                <span className="font-medium">{frDate(facture.date_echeance)}</span>
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Montants */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Montant de la facture</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{xof(facture.montant)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Déjà encaissé</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {xof(facture.total_paye)}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(100, partPayee)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {Math.round(partPayee)} % de la facture
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Reste à payer</p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${
              solde ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {xof(facture.reste_a_payer)}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Historique des paiements */}
        <Card className="p-0 lg:col-span-2">
          <div className="border-b px-5 py-4">
            <h3 className="font-semibold">
              Paiements reçus ({facture.paiements.length})
            </h3>
            <p className="text-sm text-muted-foreground">
              Historique des encaissements sur cette facture.
            </p>
          </div>

          {facture.paiements.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Aucun paiement enregistré à ce jour.
            </p>
          ) : (
            <ol className="divide-y">
              {facture.paiements.map((p) => (
                <li key={p.id} className="flex items-center gap-4 px-5 py-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Wallet className="size-4" />
                  </span>
                  <div className="flex-1">
                    <p className="font-medium tabular-nums">{xof(p.montant)}</p>
                    <p className="text-xs text-muted-foreground">
                      {frDate(p.date_paie)} · {p.mode_display}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {/* Le prochain règlement attendu : il n'existe pas d'échéancier, le
              solde est dû en une fois pour la date d'échéance. */}
          {!solde && (
            <div className="flex items-center gap-4 border-t border-dashed px-5 py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <CalendarClock className="size-4" />
              </span>
              <div className="flex-1">
                <p className="font-medium tabular-nums">
                  {xof(facture.reste_a_payer)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    — prochain règlement attendu
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Au plus tard le {frDate(facture.date_echeance)}
                  {enRetard ? " — échéance dépassée" : ""}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Client et vente */}
        <Card className="p-5">
          <h3 className="font-semibold">Client</h3>
          <p className="mt-2 font-medium">{facture.client_nom}</p>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            {facture.client_tel && (
              <p className="flex items-center gap-2">
                <Phone className="size-4" />
                <a href={`tel:${facture.client_tel}`} className="hover:text-foreground">
                  {facture.client_tel}
                </a>
              </p>
            )}
            {facture.client_email && (
              <p className="flex items-center gap-2">
                <Mail className="size-4" />
                <a href={`mailto:${facture.client_email}`} className="hover:text-foreground">
                  {facture.client_email}
                </a>
              </p>
            )}
            {!facture.client_tel && !facture.client_email && (
              <p>Aucun contact renseigné.</p>
            )}
          </div>

          <div className="mt-5 border-t pt-4 text-sm">
            <p className="text-muted-foreground">Statut de la facture</p>
            <p className="mt-1">
              <StatusBadge
                label={facture.statut_display}
                tone={solde ? "green" : "blue"}
              />
            </p>
            <p className="mt-3 text-muted-foreground">Vente rattachée</p>
            <p className="mt-1 font-mono text-xs">#{facture.vente_id}</p>
          </div>
        </Card>
      </div>

      <FormSheet
        open={panneau}
        onOpenChange={setPanneau}
        title={`Paiement — ${facture.num_fact}`}
        description={`Reste à payer : ${xof(facture.reste_a_payer)}. Le montant ne peut pas dépasser ce solde.`}
        fields={CHAMPS_PAIEMENT}
        initial={{ mode_paie: "ESPECE" }}
        errors={erreursChamp}
        submitting={envoi}
        submitLabel="Enregistrer le paiement"
        onSubmit={enregistrerPaiement}
      />
    </div>
  );
}

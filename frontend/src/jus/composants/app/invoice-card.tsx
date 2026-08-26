import { Citrus } from "lucide-react";
import { StatusBadge, type Tone } from "@/jus/composants/app/status-badge";
import { cn } from "@/jus/lib/utils";

// Carte facture stylisée (style Tailark) : en-tête dégradé + détail + statut.
export function InvoiceCard({
  numero,
  client,
  montant,
  echeance,
  statutLabel,
  statutTone = "blue",
  paidPct = 0,
  className,
}: {
  numero: string;
  client: string;
  montant: string;
  echeance: string;
  statutLabel: string;
  statutTone?: Tone;
  paidPct?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between bg-gradient-to-r from-primary to-amber-500 px-5 py-4 text-primary-foreground">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-white/20">
            <Citrus className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-xs opacity-80">Dernière facture</p>
            <p className="font-mono text-sm font-semibold">{numero}</p>
          </div>
        </div>
        <StatusBadge
          label={statutLabel}
          tone={statutTone}
          className="bg-white/20 text-primary-foreground"
        />
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Client</p>
            <p className="font-medium">{client}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Montant</p>
            <p className="text-xl font-bold tabular-nums">{montant}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Encaissé</span>
            <span>{Math.round(paidPct)} %</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.max(0, Math.min(100, paidPct))}%` }}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">Échéance : {echeance}</p>
      </div>
    </div>
  );
}

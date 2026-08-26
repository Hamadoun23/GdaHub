import { MapPin } from "lucide-react";

export type Zone = { zone: string; tonnage: number };

// Panneau "zones de récolte" avec fond en pointillés (style illustration Tailark).
export function ZonesPanel({ zones }: { zones: Zone[] }) {
  const max = Math.max(1, ...zones.map((z) => z.tonnage));

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
      {/* Fond pointillé décoratif */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          maskImage:
            "radial-gradient(ellipse at top right, black, transparent 70%)",
        }}
      />
      <div className="relative">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MapPin className="size-4" />
          </span>
          <div>
            <p className="font-semibold">Récolte par zone</p>
            <p className="text-xs text-muted-foreground">Tonnage cumulé</p>
          </div>
        </div>

        <ul className="space-y-3">
          {zones.map((z) => (
            <li key={z.zone} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{z.zone}</span>
                <span className="tabular-nums text-muted-foreground">
                  {new Intl.NumberFormat("fr-FR").format(z.tonnage)} t
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500"
                  style={{ width: `${(z.tonnage / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
          {zones.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              Aucune donnée de zone.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

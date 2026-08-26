import { cn } from "@/jus/lib/utils";

// Jauge radiale en SVG (style Tailark) : anneau de progression + valeur au centre.
export function RadialGauge({
  value,
  label,
  center,
  sub,
  size = 132,
  stroke = 12,
  className,
  tone = "primary",
}: {
  value: number; // 0-100
  label?: string;
  center?: string;
  sub?: string;
  size?: number;
  stroke?: number;
  className?: string;
  tone?: "primary" | "emerald" | "blue" | "amber";
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  const colors: Record<string, string> = {
    primary: "var(--primary)",
    emerald: "oklch(0.7 0.15 160)",
    blue: "oklch(0.62 0.18 250)",
    amber: "oklch(0.8 0.15 80)",
  };
  const color = colors[tone];

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums">
            {center ?? `${Math.round(clamped)}%`}
          </span>
          {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </div>
      </div>
      {label && (
        <p className="text-sm font-medium text-center text-muted-foreground">
          {label}
        </p>
      )}
    </div>
  );
}

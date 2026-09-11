"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Citrus } from "lucide-react";
import { navigation, roleMeta } from "@/jus/lib/nav";
import { useAuth } from "@/jus/lib/auth";
import { canAccess } from "@/jus/lib/access";
import { cn } from "@/lib/cn";

function isActive(pathname: string, href: string) {
  if (href === pathname) return true;
  // Sous-pages : /production/producteurs actif pour /production/producteurs/...
  // mais l'accueil (ex: /production) ne doit pas s'activer sur ses enfants.
  const segments = href.split("/").filter(Boolean);
  if (segments.length <= 1) return false;
  return pathname.startsWith(href + "/");
}

export function SidebarContent() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Filtre chaque item selon la carte d'accès, puis masque les groupes vides.
  const groups = navigation
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => canAccess(item.href, user)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center gap-2 px-5 border-b border-sidebar-border">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Citrus className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="font-semibold text-sidebar-foreground">JusOrange</p>
          <p className="text-xs text-muted-foreground">Pilotage production</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.role}>
            <div className="mb-1 flex items-center gap-2 px-3">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  roleMeta[group.role].color
                )}
              />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4 text-xs text-muted-foreground">
        JusOrange · Campagne 2026
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col border-r border-sidebar-border">
      <SidebarContent />
    </aside>
  );
}

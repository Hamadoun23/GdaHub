"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/jus/lib/auth";
import { Input } from "@/jus/composants/ui/input";
import { Button } from "@/jus/composants/ui/button";
import { Avatar, AvatarFallback } from "@/jus/composants/ui/avatar";
import { Sheet, SheetContent, SheetTitle } from "@/jus/composants/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/jus/composants/ui/dropdown-menu";
import { SidebarContent } from "@/jus/composants/app/app-sidebar";
import { navigation, roleMeta, type Role } from "@/jus/lib/nav";

function currentRole(pathname: string): Role {
  const seg = pathname.split("/").filter(Boolean)[0];
  const match = navigation.find((g) => g.role === seg);
  return (match?.role ?? "direction") as Role;
}

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = currentRole(pathname);
  const meta = roleMeta[role];

  const initials = (user?.username ?? "?")
    .slice(0, 2)
    .toUpperCase();

  function onLogout() {
    logout();
    toast.success("Déconnexion réussie");
    router.replace("/connexion");
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="size-5" />
      </Button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <div className="hidden items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium sm:flex">
        <span className={`size-2 rounded-full ${meta.color}`} />
        Espace {meta.label}
      </div>

      <div className="relative ml-auto w-full max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Rechercher…" className="pl-9 bg-muted/50" />
      </div>

      <Button
        variant="outline"
        size="icon"
        className="relative shrink-0"
        onClick={() =>
          toast("3 nouvelles alertes", {
            description: "1 stock sous le seuil, 2 factures en retard.",
          })
        }
      >
        <Bell className="size-4" />
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          3
        </span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary/15 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="px-2 py-1.5 leading-tight">
            <p className="text-sm font-medium">{user?.username ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {user?.is_superuser
                ? "Administrateur"
                : (user?.roles ?? []).join(", ") || "Utilisateur"}
            </p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Profil</DropdownMenuItem>
          <DropdownMenuItem>Paramètres</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onLogout}>
            Déconnexion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

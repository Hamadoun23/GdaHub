"use client";

/**
 * L'entete partagee par toutes les applications du hub.
 *
 * Reprise de Jus d'orange (jus/composants/app/app-header.tsx) : badge de
 * section, retour au hub, recherche, notifications, menu utilisateur — et
 * le tiroir mobile qui reprend la barre laterale sur petit ecran.
 */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Menu, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar";
import { Sheet, SheetContent, SheetTitle } from "@/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import type { InfosUtilisateur } from "./types";

export function Entete({
  badgeLabel,
  badgeCouleur = "bg-primary",
  utilisateur,
  onDeconnexion,
  contenuMobile,
  rechercheVisible = true,
  hubHref = "/tableau-de-bord",
  retourHubVisible = true,
  menuUtilisateur,
}: {
  badgeLabel?: string;
  badgeCouleur?: string;
  utilisateur: InfosUtilisateur;
  onDeconnexion: () => void;
  /** Le contenu de la barre laterale, repris tel quel dans le tiroir mobile. */
  contenuMobile: ReactNode;
  rechercheVisible?: boolean;
  hubHref?: string;
  /** Faux pour le hub lui-meme : revenir « au hub » depuis le hub n'a pas de sens. */
  retourHubVisible?: boolean;
  /** Elements additionnels dans le menu utilisateur, avant « Deconnexion ». */
  menuUtilisateur?: ReactNode;
}) {
  const [mobileOuvert, setMobileOuvert] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-black/5 bg-transparent px-4 backdrop-blur-md">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileOuvert(true)}
      >
        <Menu className="size-5" />
      </Button>

      <Sheet open={mobileOuvert} onOpenChange={setMobileOuvert}>
        <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {contenuMobile}
        </SheetContent>
      </Sheet>

      {badgeLabel ? (
        <div className="hidden items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium sm:flex">
          <span className={cn("size-2 rounded-full", badgeCouleur)} />
          {badgeLabel}
        </div>
      ) : null}

      {/* Le retour au hub. Une adresse absolue et non un lien Next : l'accueil
          du hub est une autre partie de l'application, mais conceptuellement
          hors du perimetre de celle-ci. */}
      {retourHubVisible ? (
        <a
          href={hubHref}
          title="Revenir a GDA Hub"
          className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:inline-flex"
        >
          <ArrowLeft className="size-4" />
          GDA Hub
        </a>
      ) : null}

      {rechercheVisible ? (
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher…" className="rounded-full border-border bg-secondary/60 pl-9" />
        </div>
      ) : (
        <div className="ml-auto" />
      )}

      <Button
        variant="outline"
        size="icon"
        className="relative shrink-0 rounded-full border-border bg-secondary/60"
      >
        <Bell className="size-4" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="size-9 border-2 border-border">
            {utilisateur.photoUrl ? <AvatarImage src={utilisateur.photoUrl} alt="" /> : null}
            <AvatarFallback name={utilisateur.nomAffiche} className="font-semibold">
              {utilisateur.initiales}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {/* Le bloc identite menait nulle part : un simple clic dessus va
              desormais a « Mon compte », sans passer par une entree de menu
              dediee — cf. DropdownMenuLinkItem plus bas, dont le padding par
              defaut est retouche pour garder les deux lignes (nom, role). */}
          <DropdownMenuLinkItem
            render={<Link href="/mon-compte" />}
            className="flex-col items-start gap-0 px-2 py-1.5 leading-tight"
          >
            <p className="text-sm font-medium">{utilisateur.nomAffiche}</p>
            <p className="text-xs text-muted-foreground">
              {utilisateur.estAdmin ? "Administrateur" : utilisateur.sousLabel || "Utilisateur"}
            </p>
          </DropdownMenuLinkItem>
          {menuUtilisateur ? (
            <>
              <DropdownMenuSeparator />
              {menuUtilisateur}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDeconnexion}>
            Déconnexion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

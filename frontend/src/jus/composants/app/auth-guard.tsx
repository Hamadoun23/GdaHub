"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/jus/composants/ui/button";
import { useAuth } from "@/jus/lib/auth";
import { canAccess, roleHome } from "@/jus/lib/access";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/connexion");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-svh flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  // Accès direct par URL à une section interdite : on bloque.
  if (!canAccess(pathname, user)) {
    return (
      <div className="flex min-h-svh flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="size-7" />
        </span>
        <div>
          <h1 className="text-xl font-bold">Accès refusé</h1>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Votre rôle ({user.is_superuser ? "Administrateur" : user.roles.join(", ")})
            ne permet pas d&apos;accéder à cette section.
          </p>
        </div>
        <Button onClick={() => router.replace(roleHome(user))}>
          Retour à mon espace
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

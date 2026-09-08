import { EspaceJus } from "@/jus/composants/app/espace-jus";
import { AuthGuard } from "@/jus/composants/app/auth-guard";
import { AuthProvider as FournisseurAuth } from "@/jus/lib/auth";
import { Toaster } from "@/ui/sonner";

/**
 * L'espace Jus d'orange.
 *
 * Son fournisseur de session et son afficheur de messages sont poses ici, et
 * non a la racine : ils n'ont de sens que dans cet espace.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FournisseurAuth>
      <AuthGuard>
        <EspaceJus>{children}</EspaceJus>
      </AuthGuard>
      <Toaster richColors position="top-right" />
    </FournisseurAuth>
  );
}

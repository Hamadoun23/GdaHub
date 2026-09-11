import { AppSidebar } from "@/jus/composants/app/app-sidebar";
import { AppHeader } from "@/jus/composants/app/app-header";
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
        <div className="flex min-h-svh flex-1">
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <AppHeader />
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
      </AuthGuard>
      <Toaster richColors position="top-right" />
    </FournisseurAuth>
  );
}

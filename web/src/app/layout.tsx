import type { Metadata } from "next";

import { FournisseurSession } from "@/lib/session";

import "./globals.css";

export const metadata: Metadata = {
  title: "GDA Hub",
  description: "Centralise tous les services et informations.",
};

export default function RacineLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <FournisseurSession>{children}</FournisseurSession>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import ConditionalAppShell from "@/components/ConditionalAppShell";
import { ProfileProvider } from "@/context/ProfileContext";

export const metadata: Metadata = {
  title: "BiteBox",
  description: "Ton Letterboxd des fast-foods",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BiteBox",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#6A24A4",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ConditionalAppShell bypass AppShell pour les pages d'authentification
  // Pour toutes les autres pages, AppShell est utilisé
  return (
    <html lang="fr">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <ProfileProvider>
          <ConditionalAppShell>{children}</ConditionalAppShell>
        </ProfileProvider>
      </body>
    </html>
  );
}


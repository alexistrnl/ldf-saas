import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FastFoodBox",
  description: "Ton Letterboxd des fast-foods",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        {children}
      </body>
    </html>
  );
}


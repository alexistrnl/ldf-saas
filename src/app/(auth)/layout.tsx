export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Layout minimal pour les pages d'authentification
  // Pas de AppShell, pas de menu, pas de navigation
  return <>{children}</>
}


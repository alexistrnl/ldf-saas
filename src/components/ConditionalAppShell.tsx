'use client'

import { usePathname } from 'next/navigation'
import AppShell from './AppShell'

export default function ConditionalAppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  
  // Routes d'authentification qui ne doivent pas passer par AppShell
  const isAuthRoute = 
    pathname === '/login' || 
    pathname === '/signup' || 
    pathname === '/forgot-password' || 
    pathname === '/reset-password'

  // Si c'est une route auth, retourner directement les children sans AppShell
  if (isAuthRoute) {
    return <div className="h-screen flex flex-col overflow-hidden"><main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">{children}</main></div>
  }

  // Sinon, utiliser AppShell normalement
  return <AppShell>{children}</AppShell>
}


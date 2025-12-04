'use client'

import { usePathname } from 'next/navigation'
import AppHeader from './AppHeader'
import BottomNav from './BottomNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isAuthPage = pathname === '/login' || pathname === '/signup'
  const isAdminPage = pathname?.startsWith('/admin')
  
  // Routes où la bottom nav ne doit pas apparaître (flow "Ajouter une note")
  // - /add-note : page générale d'ajout de note
  // - /restaurants/[slug]/add-note : page d'ajout de note avec restaurant pré-sélectionné
  const isAddNotePage = pathname === '/add-note' || (pathname.includes('/restaurants/') && pathname.includes('/add-note'))

  // Masquer header et bottom nav sur les pages d'auth
  // Masquer bottom nav sur admin (mais garder le header)
  // Masquer bottom nav sur le flow "Ajouter une note" (pour ne pas recouvrir le bouton de validation)
  const showHeader = !isAuthPage
  const showBottomNav = !isAuthPage && !isAdminPage && !isAddNotePage

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {showHeader && <AppHeader />}
      <main className={`${showBottomNav ? 'pb-24' : 'pb-2'} ${showHeader ? 'pt-2' : 'pt-0'}`}>
        {children}
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  )
}


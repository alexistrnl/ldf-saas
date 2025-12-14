'use client'

import { usePathname } from 'next/navigation'
import AppHeader from './AppHeader'
import BottomNav from './BottomNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isAuthPage = 
    pathname === '/login' || 
    pathname === '/signup' || 
    pathname === '/forgot-password' || 
    pathname === '/reset-password'
  const isAdminPage = pathname?.startsWith('/admin')
  const isDesktopInfoPage = pathname === '/desktop-info'
  const isConfirmationPage = pathname === '/confirmation'
  
  // Routes où la bottom nav ne doit pas apparaître (flow "Ajouter une note")
  // - /add-note : page générale d'ajout de note
  // - /restaurants/[slug]/add-note : page d'ajout de note avec restaurant pré-sélectionné
  const isAddNotePage = pathname === '/add-note' || (pathname.includes('/restaurants/') && pathname.includes('/add-note'))

  // Masquer header et bottom nav sur les pages d'auth et desktop-info
  // Masquer bottom nav sur admin (mais garder le header)
  // Masquer bottom nav sur le flow "Ajouter une note" (pour ne pas recouvrir le bouton de validation)
  // Masquer bottom nav sur la page de confirmation
  const showHeader = !isAuthPage && !isDesktopInfoPage
  const showBottomNav = !isAuthPage && !isAdminPage && !isAddNotePage && !isDesktopInfoPage && !isConfirmationPage

  return (
    <div className={`min-h-screen ${isDesktopInfoPage ? '' : 'bg-[#020617] text-white'}`}>
      {showHeader && <AppHeader />}
      <main className={`${showBottomNav ? 'pb-24' : 'pb-2'} ${showHeader ? 'pt-2' : 'pt-0'}`}>
        {children}
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  )
}


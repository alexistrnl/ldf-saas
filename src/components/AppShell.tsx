'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import AppHeader from './AppHeader'
import BottomNav from './BottomNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const isAuthPage = 
    pathname === '/login' || 
    pathname === '/signup' || 
    pathname === '/forgot-password' || 
    pathname === '/reset-password'
  const isAdminPage = pathname?.startsWith('/admin')
  const isDesktopInfoPage = pathname === '/desktop-info'
  const isConfirmationPage = pathname === '/confirmation'
  const isSettingsPage = pathname === '/settings' || pathname?.startsWith('/profile/settings')
  
  // Routes où la bottom nav ne doit pas apparaître (flow "Ajouter une note")
  // - /add-note : page générale d'ajout de note
  // - /restaurants/[slug]/add-note : page d'ajout de note avec restaurant pré-sélectionné
  const isAddNotePage = pathname === '/add-note' || (pathname.includes('/restaurants/') && pathname.includes('/add-note'))

  // Vérifier si un modal est ouvert (via attribut data sur body)
  useEffect(() => {
    const checkModal = () => {
      setIsModalOpen(document.body.hasAttribute("data-modal-open"))
    }
    
    // Vérifier au montage
    checkModal()
    
    // Observer les changements d'attribut
    const observer = new MutationObserver(checkModal)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-modal-open"]
    })
    
    return () => observer.disconnect()
  }, [])

  // Masquer header et bottom nav sur les pages d'auth et desktop-info
  // Masquer bottom nav sur admin (mais garder le header)
  // Masquer bottom nav sur le flow "Ajouter une note" (pour ne pas recouvrir le bouton de validation)
  // Masquer bottom nav sur la page de confirmation
  // Masquer bottom nav sur les pages de paramètres
  // Masquer bottom nav quand un modal est ouvert
  const showHeader = !isAuthPage && !isDesktopInfoPage
  const showBottomNav = !isAuthPage && !isAdminPage && !isAddNotePage && !isDesktopInfoPage && !isConfirmationPage && !isSettingsPage && !isModalOpen

  return (
    <div className={`h-screen flex flex-col ${isDesktopInfoPage ? '' : 'bg-[#020617] text-white'} overflow-hidden`}>
      {showHeader && <AppHeader />}
      <main className={`flex-1 overflow-y-auto overflow-x-hidden overscroll-contain ${showBottomNav ? 'pb-44' : 'pb-2'} ${showHeader ? 'pt-2' : 'pt-0'}`}>
        {children}
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  )
}


'use client'

import { usePathname } from 'next/navigation'
import AppHeader from './AppHeader'
import BottomNav from './BottomNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isAuthPage = pathname === '/login' || pathname === '/signup'
  const isAdminPage = pathname?.startsWith('/admin')

  // Masquer header et bottom nav sur les pages d'auth
  // Masquer bottom nav sur admin (mais garder le header)
  const showHeader = !isAuthPage
  const showBottomNav = !isAuthPage && !isAdminPage

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


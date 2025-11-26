'use client'

import { usePathname } from 'next/navigation'
import AppHeader from './AppHeader'
import MobileTabBar from './MobileTabBar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isAuthPage = pathname === '/login' || pathname === '/signup'
  const isAdminPage = pathname?.startsWith('/admin')

  // Masquer header et tab bar sur les pages d'auth
  // Masquer tab bar sur admin (mais garder le header)
  const showHeader = !isAuthPage
  const showTabBar = !isAuthPage && !isAdminPage

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {showHeader && <AppHeader />}
      <main className={`${showTabBar ? 'pb-20' : 'pb-2'} ${showHeader ? 'pt-2' : 'pt-0'}`}>
        {children}
      </main>
      {showTabBar && <MobileTabBar />}
    </div>
  )
}


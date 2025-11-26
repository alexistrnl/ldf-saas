'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function AppHeader() {
  const pathname = usePathname()

  const tabs = [
    { label: 'Enseignes', href: '/home' },
    { label: 'Mes notes', href: '/profile' },
  ]

  const isActive = (href: string) => {
    if (href === '/home') {
      return pathname === '/home' || pathname.startsWith('/restaurants/')
    }
    return pathname === href || pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-30 bg-[#020617]/95 backdrop-blur-md border-b border-white/5">
      <div className="mx-auto max-w-6xl px-4">
        {/* Ligne 1 : Titre centré */}
        <div className="flex items-center justify-center py-3">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            BiteBox
          </h1>
        </div>

        {/* Ligne 2 : Onglets */}
        <nav className="flex items-center justify-center gap-6 sm:gap-8 pb-2">
          {tabs.map((tab) => {
            const active = isActive(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`text-sm sm:text-base font-medium transition-colors pb-2 ${
                  active
                    ? 'text-white border-b-2 border-orange-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}


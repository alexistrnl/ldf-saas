'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AddExperienceModal from './AddExperienceModal'

export default function MobileTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAddExperienceOpen, setIsAddExperienceOpen] = useState(false)

  const isActive = (path: string) => {
    if (path === '/home') {
      return pathname === '/home' || pathname.startsWith('/restaurants/')
    }
    return pathname === path || pathname.startsWith(path)
  }

  const handleAddClick = () => {
    setIsAddExperienceOpen(true)
  }

  const handleSearchClick = () => {
    router.push('/home')
    // Optionnel : focus sur la barre de recherche après navigation
    setTimeout(() => {
      const searchInput = document.querySelector('input[type="text"][placeholder*="Rechercher"]') as HTMLInputElement
      if (searchInput) {
        searchInput.focus()
      }
    }, 100)
  }

  const handleProfileClick = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      router.push('/profile')
    } else {
      router.push('/login')
    }
  }

  const navItems = [
    {
      icon: '📚',
      label: 'Home',
      path: '/home',
      onClick: () => router.push('/home'),
    },
    {
      icon: '🔍',
      label: 'Recherche',
      path: '/home',
      onClick: handleSearchClick,
    },
    {
      icon: '＋',
      label: 'Ajouter',
      path: null,
      onClick: handleAddClick,
      isSpecial: true,
    },
    {
      icon: '👤',
      label: 'Profil',
      path: '/profile',
      onClick: handleProfileClick,
    },
  ]

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#020617] border-t border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.6)] md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-2">
          {navItems.map((item) => {
            const active = item.path ? isActive(item.path) : false

            if (item.isSpecial) {
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="flex flex-col items-center gap-0.5 -mt-4"
                  aria-label={item.label}
                >
                  <div className="bg-orange-500 text-black rounded-full w-12 h-12 flex items-center justify-center shadow-lg shadow-orange-500/40 text-xl font-bold">
                    {item.icon}
                  </div>
                  <span className="text-[10px] text-white font-medium">
                    {item.label}
                  </span>
                </button>
              )
            }

            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`flex flex-col items-center gap-0.5 text-xs transition-opacity ${
                  active
                    ? 'text-white opacity-100'
                    : 'text-slate-400 opacity-70'
                }`}
                aria-label={item.label}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-[11px]">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
      <AddExperienceModal
        isOpen={isAddExperienceOpen}
        onClose={() => setIsAddExperienceOpen(false)}
      />
    </>
  )
}


'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AddExperienceModal from './AddExperienceModal'

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAddExperienceOpen, setIsAddExperienceOpen] = useState(false)

  const isActive = (path: string) => {
    if (path === '/home') {
      return pathname === '/home' || pathname.startsWith('/restaurants/')
    }
    if (path === '/profile') {
      return pathname === '/profile' && !pathname.includes('/edit')
    }
    return pathname === path || pathname.startsWith(path)
  }

  const handleAddClick = () => {
    setIsAddExperienceOpen(true)
  }

  const handleProfileClick = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      router.push('/profile')
    } else {
      router.push('/login')
    }
  }

  const homeActive = isActive('/home')
  const profileActive = isActive('/profile')

  return (
    <>
      <nav className="fixed inset-x-0 bottom-4 z-40 flex justify-center md:hidden">
        <div className="mx-auto flex max-w-xs flex-1 items-center justify-between rounded-full bg-[#020617] px-6 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.8)] border border-white/10">
          {/* Home */}
          <button
            onClick={() => router.push('/home')}
            className={`flex flex-col items-center gap-0.5 text-[11px] transition-colors ${
              homeActive ? 'text-white' : 'text-slate-300'
            }`}
            aria-label="Home"
          >
            <svg 
              className={`w-6 h-6 ${homeActive ? 'text-white' : 'text-slate-300'}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Home</span>
          </button>

          {/* Bouton central + */}
          <button
            onClick={handleAddClick}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-500 text-black shadow-lg shadow-orange-500/40 translate-y-[-6px] transition-transform hover:scale-105"
            aria-label="Ajouter une note"
          >
            <span className="text-2xl leading-none font-bold">+</span>
          </button>

          {/* Profil */}
          <button
            onClick={handleProfileClick}
            className={`flex flex-col items-center gap-0.5 text-[11px] transition-colors ${
              profileActive ? 'text-white' : 'text-slate-300'
            }`}
            aria-label="Profil"
          >
            <svg 
              className={`w-6 h-6 ${profileActive ? 'text-white' : 'text-slate-300'}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Profil</span>
          </button>
        </div>
      </nav>
      <AddExperienceModal
        isOpen={isAddExperienceOpen}
        onClose={() => setIsAddExperienceOpen(false)}
      />
    </>
  )
}


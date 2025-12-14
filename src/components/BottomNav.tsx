'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AddExperienceModal from './AddExperienceModal'
import { useIsMobile } from '@/hooks/useIsMobile'

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()
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
    if (isMobile) {
      router.push('/add-note')
    } else {
      setIsAddExperienceOpen(true)
    }
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
  const socialActive = isActive('/social')
  const experienceActive = isActive('/experience')
  const profileActive = isActive('/profile')

  return (
    <>
      <nav className="fixed inset-x-0 bottom-4 z-40 flex justify-center md:hidden">
        <div className="mx-auto flex w-full max-w-sm items-center rounded-full bg-[#020617] px-1 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.8)] border border-white/10">
          {/* Home */}
          <button
            onClick={() => router.push('/home')}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 min-w-[48px] transition-colors ${
              homeActive ? 'text-bitebox' : 'text-slate-300'
            }`}
            aria-label="Home"
          >
            <svg 
              className={`w-6 h-6 ${homeActive ? 'text-bitebox' : 'text-slate-300'}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className={`text-[10px] ${homeActive ? 'text-bitebox' : 'text-slate-300'}`}>Home</span>
          </button>

          {/* Social */}
          <button
            onClick={() => router.push('/social')}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 min-w-[48px] transition-colors ${
              socialActive ? 'text-bitebox' : 'text-slate-300'
            }`}
            aria-label="Social"
          >
            <svg 
              className={`w-6 h-6 ${socialActive ? 'text-bitebox' : 'text-slate-300'}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className={`text-[10px] ${socialActive ? 'text-bitebox' : 'text-slate-300'}`}>Social</span>
          </button>

          {/* Bouton central + (plus gros et dominant) */}
          <div className="flex items-center justify-center px-2">
            <button
              onClick={handleAddClick}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-bitebox text-white shadow-xl shadow-bitebox/50 transition-transform hover:scale-110 hover:bg-bitebox-dark -mt-2"
              aria-label="Ajouter une note"
            >
              <span className="text-3xl leading-none font-bold">+</span>
            </button>
          </div>

          {/* Expérience */}
          <button
            onClick={() => router.push('/experience')}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 min-w-[48px] transition-colors ${
              experienceActive ? 'text-bitebox' : 'text-slate-300'
            }`}
            aria-label="Expérience"
          >
            <svg 
              className={`w-6 h-6 ${experienceActive ? 'text-bitebox' : 'text-slate-300'}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <span className={`text-[10px] ${experienceActive ? 'text-bitebox' : 'text-slate-300'}`}>Expérience</span>
          </button>

          {/* Profil */}
          <button
            onClick={handleProfileClick}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 min-w-[48px] transition-colors ${
              profileActive ? 'text-bitebox' : 'text-slate-300'
            }`}
            aria-label="Profil"
          >
            <svg 
              className={`w-6 h-6 ${profileActive ? 'text-bitebox' : 'text-slate-300'}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className={`text-[10px] ${profileActive ? 'text-bitebox' : 'text-slate-300'}`}>Profil</span>
          </button>
        </div>
      </nav>
      {/* Modal uniquement sur desktop */}
      {!isMobile && (
        <AddExperienceModal
          isOpen={isAddExperienceOpen}
          onClose={() => setIsAddExperienceOpen(false)}
        />
      )}
    </>
  )
}


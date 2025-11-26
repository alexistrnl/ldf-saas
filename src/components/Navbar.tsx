'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import AddExperienceModal from './AddExperienceModal'
import { useIsMobile } from '@/hooks/useIsMobile'

export default function Navbar() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [isAddExperienceOpen, setIsAddExperienceOpen] = useState(false)

  const handleAddNoteClick = () => {
    if (isMobile) {
      router.push('/add-note')
    } else {
      setIsAddExperienceOpen(true)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#020617]/80 backdrop-blur-md border-b border-white/5 shadow-lg shadow-black/30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          {/* Logo + Nom */}
          <Link 
            href="/home" 
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Image 
              src="/bitebox-logo.png" 
              alt="BiteBox logo" 
              width={32} 
              height={32} 
              className="rounded-xl w-6 h-6 sm:w-8 sm:h-8"
            />
            <span className="text-white font-semibold tracking-wide text-sm sm:text-base">
              BiteBox
            </span>
          </Link>

          {/* Boutons d'action */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleAddNoteClick}
              className="inline-flex items-center rounded-full bg-bitebox px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white shadow hover:bg-bitebox-dark transition"
            >
              Ajouter une note
            </button>
            <button
              onClick={async () => {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                  router.push('/profile')
                } else {
                  router.push('/login')
                }
              }}
              className="inline-flex items-center rounded-full bg-transparent border border-white/30 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white hover:border-white/50 hover:bg-white/5 transition"
            >
              Mon profil
            </button>
          </div>
        </div>
      </header>
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


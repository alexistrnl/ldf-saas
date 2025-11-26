'use client'

import { useRouter } from 'next/navigation'

type MobileHeaderProps = {
  title: string
}

export default function MobileHeader({ title }: MobileHeaderProps) {
  const router = useRouter()

  return (
    <header className="flex items-center gap-3 px-4 py-3 md:hidden bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50 border-b border-slate-800">
      <button
        onClick={() => router.back()}
        aria-label="Revenir en arrière"
        className="flex-shrink-0 text-white hover:opacity-70 transition-opacity"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 className="text-lg font-semibold text-white truncate flex-1">
        {title}
      </h1>
    </header>
  )
}


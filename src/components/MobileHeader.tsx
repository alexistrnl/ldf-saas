'use client'

import { usePathname, useRouter } from 'next/navigation'

type MobileHeaderProps = {
  title: string
}

export default function MobileHeader({ title }: MobileHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()

  const showBackButton =
    pathname.startsWith('/restaurants/') || pathname === '/profile'

  if (!showBackButton) {
    return null
  }

  return (
    <header className="flex items-center gap-3 px-4 py-3 md:hidden bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50 border-b border-slate-800">
      <button
        onClick={() => router.back()}
        aria-label="Revenir en arrière"
        className="flex-shrink-0 rounded-full bg-white/10 px-3 py-2 text-xl text-white hover:bg-white/20 transition-colors"
      >
        ←
      </button>
      <h1 className="text-lg font-semibold text-white truncate flex-1">
        {title}
      </h1>
    </header>
  )
}


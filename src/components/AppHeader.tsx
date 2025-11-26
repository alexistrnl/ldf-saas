'use client'

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-30 bg-[#020617]/95 backdrop-blur-md border-b border-white/5">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-center py-3">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            BiteBox
          </h1>
        </div>
      </div>
    </header>
  )
}


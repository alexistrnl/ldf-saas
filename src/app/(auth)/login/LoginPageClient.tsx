'use client'

import { useEffect, Suspense } from 'react'
import LoginForm from '@/components/LoginForm'

function LoginFormWrapper() {
  return <LoginForm />
}

export default function LoginPageClient() {
  // Désactiver le scroll vertical uniquement sur cette page
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  return (
    <main className="h-screen overflow-hidden flex items-center justify-center bg-gradient-to-b from-[#050816] via-[#050816] to-[#140421] px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <Suspense fallback={<div className="text-center py-8">Chargement...</div>}>
          <LoginFormWrapper />
        </Suspense>
      </div>
    </main>
  )
}


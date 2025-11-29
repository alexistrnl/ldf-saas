'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import Spinner from '@/components/Spinner'

export default function ConfirmationPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Vérification de votre compte...')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // Récupérer les paramètres de l'URL (token_hash, type, etc.)
        const tokenHash = searchParams.get('token_hash')
        const type = searchParams.get('type')

        if (tokenHash && type) {
          // Vérifier l'email avec Supabase
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          })

          if (error) {
            setStatus('error')
            setMessage('Le lien de vérification est invalide ou a expiré.')
            return
          }

          setStatus('success')
          setMessage('Ton compte a été validé avec succès !')

          // Rediriger vers la page de connexion après 3 secondes
          setTimeout(() => {
            router.push('/login')
          }, 3000)
        } else {
          // Si pas de paramètres, on considère que c'est juste une page de confirmation
          setStatus('success')
          setMessage('Ton compte a été validé avec succès !')

          // Rediriger vers la page de connexion après 3 secondes
          setTimeout(() => {
            router.push('/login')
          }, 3000)
        }
      } catch (err) {
        setStatus('error')
        setMessage('Une erreur est survenue lors de la vérification.')
      }
    }

    verifyEmail()
  }, [searchParams, router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#050816] via-[#050816] to-[#140421] px-4">
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-sm rounded-lg shadow-lg border border-white/10 p-8">
        <div className="flex flex-col items-center mb-6">
          <Image src="/bitebox-logo.png" alt="BiteBox logo" width={72} height={72} />
        </div>

        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="flex justify-center mb-4">
                <Spinner size="lg" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">
                Vérification en cours...
              </h1>
              <p className="text-slate-300">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mb-4">
                <svg
                  className="w-16 h-16 mx-auto text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">
                Compte validé !
              </h1>
              <p className="text-green-400 mb-6">{message}</p>
              <p className="text-slate-400 text-sm mb-6">
                Redirection vers la page de connexion dans quelques secondes...
              </p>
              <Link
                href="/login"
                className="inline-block px-8 py-3 bg-bitebox text-white font-semibold rounded-lg hover:bg-bitebox-dark transition-colors shadow-lg"
              >
                Se connecter maintenant
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mb-4">
                <svg
                  className="w-16 h-16 mx-auto text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">
                Erreur de vérification
              </h1>
              <p className="text-red-400 mb-6">{message}</p>
              <div className="space-y-3">
                <Link
                  href="/login"
                  className="block px-8 py-3 bg-bitebox text-white font-semibold rounded-lg hover:bg-bitebox-dark transition-colors shadow-lg text-center"
                >
                  Aller à la connexion
                </Link>
                <Link
                  href="/signup"
                  className="block px-8 py-3 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors text-center"
                >
                  Créer un nouveau compte
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}


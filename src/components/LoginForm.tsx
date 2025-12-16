'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { signIn } from '@/app/(auth)/login/actions'
import Spinner from '@/components/Spinner'

export default function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    if (next) {
      formData.set('next', next)
    }

    try {
      const result = await signIn(formData)
      if (result?.error) {
        setError(result.error)
        setLoading(false)
      }
      // Si pas d'erreur, signIn fait un redirect, donc on ne fait rien d'autre
    } catch (err) {
      // Si c'est une redirection, ne pas afficher d'erreur
      if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) {
        return
      }
      setError('Une erreur est survenue')
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex flex-col items-center mb-6">
        <Image src="/bitebox-logo.png" alt="BiteBox logo" width={72} height={72} />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
        Connexion
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-bitebox focus:border-transparent"
            placeholder="ton@email.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Mot de passe
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-bitebox hover:text-bitebox-dark font-medium"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-bitebox focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-6 px-8 py-3 bg-bitebox text-white font-semibold rounded-lg hover:bg-bitebox-dark transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Spinner size="sm" />
              <span>Connexion...</span>
            </>
          ) : (
            'Se connecter'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="text-bitebox hover:text-bitebox-dark font-medium">
          Créer un compte
        </Link>
      </p>
    </>
  )
}

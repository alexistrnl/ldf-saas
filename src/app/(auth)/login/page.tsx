'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      router.push('/home')
    } catch (err) {
      setError('Une erreur est survenue')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#050816] via-[#050816] to-[#140421] px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
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
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-bitebox focus:border-transparent"
              placeholder="ton@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            className="w-full mt-6 px-8 py-3 bg-bitebox text-white font-semibold rounded-lg hover:bg-bitebox-dark transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Pas encore de compte ?{' '}
          <Link href="/signup" className="text-bitebox hover:text-bitebox-dark font-medium">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  )
}


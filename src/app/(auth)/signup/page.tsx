'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase, getSiteUrl } from '@/lib/supabaseClient'
import Spinner from '@/components/Spinner'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Appel signUp avec configuration explicite pour forcer l'utilisation du template "Confirm sign up"
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: "https://www.bitebox.fr/confirmation",
        },
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      setSuccess(true)
      setLoading(false)
      
      // Rediriger vers login après 2 secondes
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err) {
      setError('Une erreur est survenue')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#050816] via-[#050816] to-[#140421] px-4">
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-sm rounded-lg shadow-lg border border-white/10 p-8">
        <div className="flex flex-col items-center mb-6">
          <Image src="/bitebox-logo.png" alt="BiteBox logo" width={72} height={72} />
        </div>
        <h1 className="text-3xl font-bold text-white mb-6 text-center">
          Créer un compte
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-slate-950 text-white focus:ring-2 focus:ring-bitebox focus:border-transparent"
              placeholder="ton@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-slate-950 text-white focus:ring-2 focus:ring-bitebox focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-950/30 border border-red-500/30 p-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="text-green-400 text-sm bg-green-950/30 border border-green-500/30 p-3 rounded-lg">
              Compte créé, vérifie tes emails ou connecte-toi
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
                <span>Inscription...</span>
              </>
            ) : (
              "S'inscrire"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-bitebox-light hover:text-bitebox font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  )
}


'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import Spinner from '@/components/Spinner'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://www.bitebox.fr/reset-password',
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      // Toujours afficher le message de succès (sécurité : éviter l'énumération de comptes)
      setSuccess(true)
      setLoading(false)
    } catch (err) {
      setError('Une erreur est survenue. Veuillez réessayer.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <>
        <div className="flex flex-col items-center mb-6">
          <Image src="/bitebox-logo.png" alt="BiteBox logo" width={72} height={72} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
          Email envoyé
        </h1>
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <p className="text-sm text-green-800 text-center">
              Si un compte existe avec cet e-mail, un lien de réinitialisation vous a été envoyé.
            </p>
          </div>
          <Link
            href="/login"
            className="block text-center text-sm text-bitebox hover:text-bitebox-dark font-medium"
          >
            Retour à la connexion
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex flex-col items-center mb-6">
        <Image src="/bitebox-logo.png" alt="BiteBox logo" width={72} height={72} />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
        Mot de passe oublié
      </h1>
      <p className="text-sm text-gray-600 mb-6 text-center">
        Entrez votre adresse e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe.
      </p>

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
              <span>Envoi en cours...</span>
            </>
          ) : (
            'Envoyer le lien de réinitialisation'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        <Link href="/login" className="text-bitebox hover:text-bitebox-dark font-medium">
          Retour à la connexion
        </Link>
      </p>
    </>
  )
}


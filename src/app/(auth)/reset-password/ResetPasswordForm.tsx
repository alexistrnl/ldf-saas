'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import Spinner from '@/components/Spinner'

export default function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Vérifier si une session de récupération existe
  useEffect(() => {
    let mounted = true

    // Écouter les changements de session (quand Supabase récupère la session depuis l'URL)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        if (mounted) {
          setHasValidSession(true)
        }
      } else if (event === 'SIGNED_IN' && session) {
        // Si on a déjà une session, on est bon
        if (mounted) {
          setHasValidSession(true)
        }
      }
    })

    // Vérifier immédiatement si une session existe déjà
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (mounted) {
          if (sessionError || !session) {
            // Vérifier si on a un hash de récupération dans l'URL
            const hash = window.location.hash
            if (hash.includes('type=recovery')) {
              // Supabase va traiter ce hash automatiquement via onAuthStateChange
              // On attend un peu pour laisser Supabase traiter l'URL
              setTimeout(() => {
                if (mounted) {
                  supabase.auth.getSession().then(({ data: { session: newSession } }) => {
                    if (mounted) {
                      setHasValidSession(!!newSession)
                    }
                  })
                }
              }, 500)
            } else {
              setHasValidSession(false)
            }
          } else {
            setHasValidSession(true)
          }
        }
      } catch (err) {
        if (mounted) {
          setHasValidSession(false)
        }
      }
    }

    checkSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validation côté client
    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      setLoading(false)
      return
    }

    try {
      // Vérifier à nouveau la session avant de mettre à jour
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        setError('Ce lien n\'est plus valide. Merci de refaire une demande de réinitialisation de mot de passe.')
        setLoading(false)
        setHasValidSession(false)
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setError('Impossible de mettre à jour le mot de passe. Veuillez réessayer.')
        setLoading(false)
        return
      }

      setSuccess(true)
      setLoading(false)

      // Rediriger vers login après 3 secondes
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (err) {
      setError('Une erreur est survenue. Veuillez réessayer.')
      setLoading(false)
    }
  }

  // Afficher un état de chargement pendant la vérification de session
  if (hasValidSession === null) {
    return (
      <>
        <div className="flex flex-col items-center mb-6">
          <Image src="/bitebox-logo.png" alt="BiteBox logo" width={72} height={72} />
        </div>
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  // Si pas de session valide, afficher un message d'erreur
  if (hasValidSession === false) {
    return (
      <>
        <div className="flex flex-col items-center mb-6">
          <Image src="/bitebox-logo.png" alt="BiteBox logo" width={72} height={72} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
          Lien invalide
        </h1>
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <p className="text-sm text-red-800 text-center">
              Ce lien n&apos;est plus valide. Merci de refaire une demande de réinitialisation de mot de passe.
            </p>
          </div>
          <Link
            href="/forgot-password"
            className="block w-full text-center px-8 py-3 bg-bitebox text-white font-semibold rounded-lg hover:bg-bitebox-dark transition-colors shadow-lg"
          >
            Demander un nouveau lien
          </Link>
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

  // Si succès, afficher un message
  if (success) {
    return (
      <>
        <div className="flex flex-col items-center mb-6">
          <Image src="/bitebox-logo.png" alt="BiteBox logo" width={72} height={72} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
          Mot de passe mis à jour
        </h1>
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <p className="text-sm text-green-800 text-center">
              Votre mot de passe a été mis à jour avec succès. Vous allez être redirigé vers la page de connexion...
            </p>
          </div>
          <Link
            href="/login"
            className="block w-full text-center px-8 py-3 bg-bitebox text-white font-semibold rounded-lg hover:bg-bitebox-dark transition-colors shadow-lg"
          >
            Retour à la connexion
          </Link>
        </div>
      </>
    )
  }

  // Afficher le formulaire de réinitialisation
  return (
    <>
      <div className="flex flex-col items-center mb-6">
        <Image src="/bitebox-logo.png" alt="BiteBox logo" width={72} height={72} />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
        Nouveau mot de passe
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Nouveau mot de passe
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-bitebox focus:border-transparent"
            placeholder="••••••••"
          />
          <p className="mt-1 text-xs text-gray-500">Au moins 8 caractères</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirmer le mot de passe
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
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
              <span>Mise à jour...</span>
            </>
          ) : (
            'Mettre à jour mon mot de passe'
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


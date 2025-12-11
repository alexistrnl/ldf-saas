'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function AdminPasswordGate() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })

      if (response.status === 200) {
        // Mot de passe correct, recharger la page
        window.location.reload()
      } else {
        const data = await response.json()
        setError('Mot de passe incorrect')
        setLoading(false)
      }
    } catch (err) {
      setError('Une erreur est survenue. Veuillez réessayer.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f4f7] px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <Image 
            src="/bitebox-logo.png" 
            alt="BiteBox logo" 
            width={64} 
            height={64}
            className="rounded-lg"
          />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Accès administrateur
        </h1>
        <p className="text-sm text-gray-600 mb-6 text-center">
          Veuillez entrer le mot de passe pour accéder à cette page
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              autoFocus
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
            className="w-full mt-6 px-6 py-3 bg-bitebox text-white font-semibold rounded-lg hover:bg-bitebox-dark transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Vérification...' : 'Valider'}
          </button>
        </form>
      </div>
    </div>
  )
}


import { headers } from 'next/headers'
import Image from 'next/image'
import ForgotPasswordForm from './ForgotPasswordForm'
import ForgotPasswordPageClient from './ForgotPasswordPageClient'

export default async function ForgotPasswordPage() {
  // Détection du user-agent côté serveur
  const headersList = await headers()
  const userAgent = headersList.get('user-agent') || ''
  const isMobileOrTablet = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
  const isDesktop = !isMobileOrTablet

  // Si desktop, afficher le message au lieu du formulaire
  if (isDesktop) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-8 md:p-12">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Logo */}
            <div className="flex justify-center mb-2">
              <Image 
                src="/bitebox-logo.png" 
                alt="BiteBox logo" 
                width={96} 
                height={96}
                className="rounded-lg"
              />
            </div>

            {/* Titre */}
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              BiteBox est optimisée pour mobile
            </h1>

            {/* Message principal */}
            <div className="space-y-4 text-gray-700">
              <p className="text-lg md:text-xl leading-relaxed">
                Pour profiter de toutes les fonctionnalités de BiteBox, merci d&apos;y accéder depuis ton téléphone.
              </p>
              <p className="text-base md:text-lg leading-relaxed">
                Ouvre simplement <span className="font-semibold text-bitebox">https://www.bitebox.fr</span> dans le navigateur de ton smartphone.
              </p>
            </div>

            {/* Icône mobile décorative */}
            <div className="pt-4">
              <svg
                className="w-24 h-24 text-bitebox opacity-60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Si mobile/tablette, afficher le formulaire de réinitialisation
  return <ForgotPasswordPageClient />
}


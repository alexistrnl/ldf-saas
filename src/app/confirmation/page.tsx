import Link from 'next/link'
import Image from 'next/image'

export const dynamic = 'force-static'

export default function ConfirmationPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#050816] via-[#050816] to-[#140421] px-4">
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-sm rounded-lg shadow-lg border border-white/10 p-8">
        <div className="flex flex-col items-center mb-6">
          <Image src="/bitebox-logo.png" alt="BiteBox logo" width={72} height={72} />
        </div>

        <div className="text-center">
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
          <p className="text-green-400 mb-6">
            Ton compte a été validé avec succès !
          </p>
          <p className="text-slate-400 text-sm mb-6">
            Ton adresse e-mail a bien été vérifiée. Tu peux maintenant te connecter à BiteBox et commencer à noter tes enseignes préférées.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3 bg-bitebox text-white font-semibold rounded-lg hover:bg-bitebox-dark transition-colors shadow-lg"
          >
            Se connecter maintenant
          </Link>
        </div>
      </div>
    </main>
  )
}

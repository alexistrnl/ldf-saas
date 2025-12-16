import LoginPageClient from './LoginPageClient'

export default function LoginPage() {
  // Toujours afficher le formulaire de connexion (desktop et mobile)
  // Le middleware gère maintenant les exceptions pour /login
  return <LoginPageClient />
}


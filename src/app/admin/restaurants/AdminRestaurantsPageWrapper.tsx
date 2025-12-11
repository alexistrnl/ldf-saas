import { cookies } from 'next/headers'
import AdminRestaurantsContent from './AdminRestaurantsContent'
import AdminPasswordGate from './AdminPasswordGate'

export default async function AdminRestaurantsPageWrapper() {
  // Vérifier si l'utilisateur a le cookie admin_access
  const cookieStore = await cookies()
  const adminAccess = cookieStore.get('admin_access')

  // Si le cookie existe et vaut "ok", afficher le contenu admin
  if (adminAccess?.value === 'ok') {
    return <AdminRestaurantsContent />
  }

  // Sinon, afficher le formulaire de mot de passe
  return <AdminPasswordGate />
}


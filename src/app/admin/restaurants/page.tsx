import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import AdminRestaurantsContent from './AdminRestaurantsContent'
import AdminPasswordGate from './AdminPasswordGate'

export default async function AdminRestaurantsPage() {
  // Le middleware gère déjà la protection de /admin/* et redirige vers /login si non authentifié
  // On vérifie quand même ici pour obtenir l'utilisateur si nécessaire
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import AdminRestaurantsContent from './AdminRestaurantsContent'
import AdminPasswordGate from './AdminPasswordGate'

export default async function AdminRestaurantsPage() {
  // Vérifier l'authentification Supabase
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()

  // Si l'utilisateur n'est pas authentifié, rediriger vers /login avec paramètre next
  if (!user) {
    redirect('/login?next=/admin/restaurants')
  }

  // Vérifier si l'utilisateur a le cookie admin_access
  const adminAccess = cookieStore.get('admin_access')

  // Si le cookie existe et vaut "ok", afficher le contenu admin
  if (adminAccess?.value === 'ok') {
    return <AdminRestaurantsContent />
  }

  // Sinon, afficher le formulaire de mot de passe
  return <AdminPasswordGate />
}

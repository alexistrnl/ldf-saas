import { createClient } from '@/lib/supabase/server'

/**
 * Vérifie si l'utilisateur connecté est un admin
 * en interrogeant profiles.is_admin
 * 
 * Retourne true si l'utilisateur est admin, false sinon
 */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.error('[Admin] Error checking admin status:', error)
      return false
    }
    
    return data?.is_admin === true
  } catch (error) {
    console.error('[Admin] Exception checking admin status:', error)
    return false
  }
}

/**
 * Récupère l'utilisateur connecté et vérifie s'il est admin
 * 
 * Retourne { user, isAdmin: boolean } ou { user: null, isAdmin: false }
 */
export async function getUserWithAdminStatus() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return { user: null, isAdmin: false }
    }
    
    const isAdminStatus = await isAdmin(user.id)
    return { user, isAdmin: isAdminStatus }
  } catch (error) {
    console.error('[Admin] Exception getting user with admin status:', error)
    return { user: null, isAdmin: false }
  }
}


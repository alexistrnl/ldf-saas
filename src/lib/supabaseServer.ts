import { cookies } from 'next/headers'

/**
 * Vérifie si l'utilisateur est authentifié côté serveur
 * en détectant la présence de cookies d'authentification Supabase
 * 
 * Note: Cette vérification est approximative mais suffisante pour la redirection.
 * La validation complète de la session se fera côté client.
 * 
 * Retourne true si des cookies d'authentification sont présents, false sinon
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    
    // Supabase stocke les sessions dans des cookies avec ces patterns
    // On cherche la présence de cookies d'authentification
    const hasAuthCookie = allCookies.some(cookie => {
      const name = cookie.name.toLowerCase()
      // Patterns de cookies Supabase courants
      return (
        (name.startsWith('sb-') && (name.includes('auth-token') || name.includes('access-token'))) ||
        name === 'sb-access-token' ||
        name === 'sb-refresh-token' ||
        // Pattern: sb-<project-ref>-auth-token
        /^sb-[a-z0-9-]+-auth-token$/i.test(name)
      )
    })
    
    return hasAuthCookie
  } catch (error) {
    // En cas d'erreur, considérer qu'il n'est pas connecté
    return false
  }
}


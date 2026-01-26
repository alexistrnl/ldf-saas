import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
}

if (!supabaseAnonKey) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

/**
 * Obtient l'URL de base du site pour les redirections d'email
 * Utilise NEXT_PUBLIC_SITE_URL si défini, sinon construit depuis window.location en client
 * ou utilise une valeur par défaut en production
 */
export function getSiteUrl(): string {
  // En production, utiliser l'URL définie dans les variables d'environnement
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  
  // En développement ou si non défini, utiliser l'URL par défaut
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.host}`
  }
  
  // Fallback pour le serveur (devrait être rare)
  return 'https://www.bitebox.fr'
}

/**
 * Client Supabase pour le navigateur
 * Utilise createBrowserClient de @supabase/ssr pour synchroniser
 * la session avec les cookies gérés par le middleware
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)


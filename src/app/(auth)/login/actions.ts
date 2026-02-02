'use server'

import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = formData.get('next') as string | null

  if (!email || !password) {
    return { error: 'Email et mot de passe requis' }
  }

  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Traduire le message d'erreur en français
    let errorMessage = error.message
    if (error.message.toLowerCase().includes('invalid login credentials') || 
        error.message.toLowerCase().includes('invalid credentials') ||
        error.message.toLowerCase().includes('email not confirmed')) {
      errorMessage = 'Le mot de passe ou l\'identifiant est incorrect'
    }
    return { error: errorMessage }
  }

  if (!user) {
    return { error: 'Erreur lors de la connexion' }
  }

  // Vérifier si next commence par /admin
  if (next && next.startsWith('/admin')) {
    // Si l'utilisateur essaie d'accéder à /admin, vérifier qu'il est admin
    const userIsAdmin = await isAdmin(user.id)
    if (!userIsAdmin) {
      // Si non-admin, rediriger vers home au lieu de /admin
      redirect('/home')
    }
    // Si admin, autoriser l'accès à next
    redirect(next)
  }

  // Si pas de next ou next ne commence pas par /admin, rediriger vers /home
  redirect(next || '/home')
}


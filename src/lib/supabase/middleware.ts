import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Rafraîchir la session si elle existe
  const { data: { user } } = await supabase.auth.getUser()

  // Si l'utilisateur existe, vérifier s'il est admin
  let isAdmin = false
  if (user) {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('1')
        .eq('user_id', user.id)
        .limit(1)
      
      if (!error && data?.length) {
        isAdmin = true
      }
    } catch (error) {
      // En cas d'erreur, considérer que l'utilisateur n'est pas admin
      console.error('[Middleware] Error checking admin status:', error)
    }
  }

  return { supabaseResponse, user, isAdmin }
}


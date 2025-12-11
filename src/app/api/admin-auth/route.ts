import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { password } = body

    const adminPassword = process.env.ADMIN_PAGE_PASSWORD

    if (!adminPassword) {
      console.error('ADMIN_PAGE_PASSWORD environment variable is not set')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (password !== adminPassword) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }

    // Cookie valide pendant 7 jours
    const cookieStore = await cookies()
    cookieStore.set('admin_access', 'ok', {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 jours
      httpOnly: false, // Permet la lecture côté client si nécessaire
      secure: process.env.NODE_ENV === 'production', // HTTPS en production
      sameSite: 'lax',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin auth error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


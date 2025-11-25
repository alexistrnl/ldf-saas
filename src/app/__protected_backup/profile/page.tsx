'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

// Types pour les données brutes retournées par Supabase (peuvent être des tableaux)
type SupabaseDishData = {
  id: string
  name: string
  image_url: string | null
}

type SupabaseRestaurantData = {
  id: string
  name: string
  slug: string | null
  logo_url: string | null
  description: string | null
}

// Types pour les données brutes retournées par les requêtes Supabase
// Supabase peut retourner les relations comme tableaux ou objets selon la configuration
type SupabaseDishRatingRaw = {
  id: string
  dish_id: string
  restaurant_id: string | null
  rating: number
  comment: string | null
  created_at: string
  dish: SupabaseDishData | SupabaseDishData[] | null
}

type SupabaseLogRaw = {
  id: string
  rating: number | null
  comment: string | null
  visited_at: string | null
  created_at: string
  restaurant: SupabaseRestaurantData | SupabaseRestaurantData[] | null
}

// Types pour l'application
type ProfileDishRating = {
  id: string
  dish_id: string
  rating: number
  comment: string | null
  created_at: string
  dish: {
    id: string
    name: string
    image_url: string | null
  } | null
}

type ProfileRestaurantEntry = {
  restaurant: {
    id: string
    name: string
    slug: string | null
    logo_url: string | null
    description: string | null
  }
  log: {
    id: string
    rating: number
    comment: string | null
    visited_at: string | null
    created_at: string
  }
  dishRatings: ProfileDishRating[]
}

export default function ProfilePage() {
  const router = useRouter()

  const [userName, setUserName] = useState<string | null>(null)
  const [entries, setEntries] = useState<ProfileRestaurantEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Récupérer l'utilisateur
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          console.error('Erreur utilisateur:', userError)
          router.push('/login')
          return
        }

        // Définir le nom d'utilisateur
        const name = user.user_metadata?.full_name || user.email || 'BiteBox User'
        setUserName(name)

        // Récupérer tous les logs avec restaurant joint
        const { data: logs, error: logsError } = await supabase
          .from('fastfood_logs')
          .select('id, rating, comment, visited_at, created_at, restaurant:restaurants(id, name, slug, logo_url, description)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (logsError) {
          console.error('Erreur récupération logs:', logsError)
          setError('Erreur lors du chargement de tes enseignes')
          setLoading(false)
          return
        }

        // Récupérer les notes par plat
        const { data: dishesRatingsData, error: drError } = await supabase
          .from('dish_ratings')
          .select('id, rating, comment, created_at, dish_id, restaurant_id, dish:dishes(id, name, image_url)')
          .eq('user_id', user.id)

        if (drError) {
          console.error('Erreur récupération notes plats:', drError)
        }

        // Fonction helper pour extraire un restaurant unique depuis la réponse Supabase
        const extractRestaurant = (
          restaurant: SupabaseRestaurantData | SupabaseRestaurantData[] | null
        ): SupabaseRestaurantData | null => {
          if (!restaurant) {
            return null
          }
          if (Array.isArray(restaurant)) {
            return restaurant[0] || null
          }
          return restaurant
        }

        // Fonction helper pour extraire un dish unique depuis la réponse Supabase
        const extractDish = (dish: SupabaseDishData | SupabaseDishData[] | null): SupabaseDishData | null => {
          if (!dish) {
            return null
          }
          if (Array.isArray(dish)) {
            return dish[0] || null
          }
          return dish
        }

        // Fonction helper pour mapper les données brutes de dish_ratings vers ProfileDishRating
        const mapDishRating = (raw: SupabaseDishRatingRaw): ProfileDishRating | null => {
          if (!raw.dish_id) {
            return null
          }

          const dishData = extractDish(raw.dish)

          return {
            id: raw.id,
            dish_id: raw.dish_id,
            rating: raw.rating,
            comment: raw.comment,
            created_at: raw.created_at,
            dish: dishData ? {
              id: dishData.id,
              name: dishData.name,
              image_url: dishData.image_url,
            } : null,
          }
        }

        // Construire la structure entries avec mapping typé
        const entriesMap: ProfileRestaurantEntry[] = []
        
        // Les données de Supabase sont typées comme unknown car la structure exacte dépend de la configuration
        // On les traite comme SupabaseLogRaw[] et SupabaseDishRatingRaw[] après vérification
        const logsArray: SupabaseLogRaw[] = Array.isArray(logs) ? logs as SupabaseLogRaw[] : []
        const dishesRatingsArray: SupabaseDishRatingRaw[] = Array.isArray(dishesRatingsData) 
          ? dishesRatingsData as SupabaseDishRatingRaw[] 
          : []

        // Mapper chaque log avec extraction sécurisée du restaurant
        logsArray.forEach((log) => {
          const restaurant = extractRestaurant(log.restaurant)

          if (!restaurant) {
            return
          }

          // Filtrer et mapper les notes de plats pour ce restaurant
          const dishRatingsForRestaurant: ProfileDishRating[] = dishesRatingsArray
            .filter((dr) => dr.restaurant_id === restaurant.id)
            .map(mapDishRating)
            .filter((dr): dr is ProfileDishRating => dr !== null)

          entriesMap.push({
            restaurant: {
              id: restaurant.id,
              name: restaurant.name,
              slug: restaurant.slug,
              logo_url: restaurant.logo_url,
              description: restaurant.description,
            },
            log: {
              id: log.id,
              rating: log.rating ?? 0,
              comment: log.comment,
              visited_at: log.visited_at,
              created_at: log.created_at,
            },
            dishRatings: dishRatingsForRestaurant,
          })
        })

        setEntries(entriesMap)
        setLoading(false)
      } catch (err) {
        console.error('Erreur inattendue:', err)
        setError('Une erreur est survenue')
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  // Calculer le nombre d'enseignes distinctes
  const uniqueRestaurants = new Set(entries.map((e) => e.restaurant.id))

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 px-4 py-10">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-slate-300">Chargement de ton profil…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Mon profil BiteBox
          </h1>
          <p className="text-slate-300 mb-4">
            {userName}, voici toutes les enseignes que tu as goûtées.
          </p>
          <div className="inline-flex items-center px-4 py-2 bg-emerald-500/20 border border-emerald-500/50 rounded-full">
            <span className="text-emerald-400 font-semibold">
              {uniqueRestaurants.size} enseigne{uniqueRestaurants.size > 1 ? 's' : ''} goûtée{uniqueRestaurants.size > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Liste des enseignes */}
        {entries.length === 0 ? (
          <div className="bg-slate-900/70 rounded-xl p-8 text-center">
            <p className="text-slate-300 mb-2">Tu n'as encore noté aucune enseigne.</p>
            <p className="text-slate-400 text-sm mb-4">
              Commence depuis la page d'accueil !
            </p>
            <Link
              href="/home"
              className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black shadow hover:bg-emerald-400 transition"
            >
              Aller à l'accueil
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {entries.map((entry) => (
              <div
                key={entry.log.id}
                className="bg-slate-900/80 rounded-2xl p-5 shadow-lg space-y-3"
              >
                <div className="flex items-center gap-4">
                  {entry.restaurant.logo_url && (
                    <img
                      src={entry.restaurant.logo_url}
                      alt={entry.restaurant.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold">{entry.restaurant.name}</h2>
                    <p className="text-sm text-slate-400">
                      Note globale : {entry.log.rating}/5
                    </p>
                    {entry.log.visited_at && (
                      <p className="text-xs text-slate-500">
                        Visité le {new Date(entry.log.visited_at).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    )}
                  </div>
                  {entry.restaurant.slug ? (
                    <Link
                      href={`/restaurants/${entry.restaurant.slug}`}
                      className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
                    >
                      Voir l'enseigne →
                    </Link>
                  ) : null}
                </div>

                {entry.log.comment && (
                  <p className="text-sm text-slate-200 mt-2">
                    {entry.log.comment}
                  </p>
                )}

                {/* Plats notés */}
                <div className="mt-3">
                  <h3 className="text-sm font-semibold mb-2">Plats que tu as notés</h3>
                  {entry.dishRatings.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      Tu n'as pas encore noté de plats pour cette enseigne.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {entry.dishRatings.map((dr) => (
                        <div key={dr.id} className="flex items-center gap-3">
                          {dr.dish?.image_url && (
                            <img
                              src={dr.dish.image_url}
                              alt={dr.dish?.name || ''}
                              className="h-8 w-8 rounded-md object-cover"
                            />
                          )}
                          <div className="text-sm">
                            <p className="font-medium">
                              {dr.dish?.name} — {dr.rating}/5
                            </p>
                            {dr.comment && (
                              <p className="text-xs text-slate-400">{dr.comment}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

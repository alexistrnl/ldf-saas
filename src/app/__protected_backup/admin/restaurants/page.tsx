'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Restaurant = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  description: string | null
  created_at: string
}

type Dish = {
  id: string
  restaurant_id: string
  name: string
  image_url: string | null
  description: string | null
  is_signature: boolean
  created_at: string
}

export default function AdminRestaurantsPage() {
  const router = useRouter()
  
  // États pour les restaurants
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingRestaurantId, setDeletingRestaurantId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // États pour la création d'enseigne
  const [newRestaurantName, setNewRestaurantName] = useState('')
  const [newRestaurantDescription, setNewRestaurantDescription] = useState('')
  const [newRestaurantLogoFile, setNewRestaurantLogoFile] = useState<File | null>(null)
  const [submittingRestaurant, setSubmittingRestaurant] = useState(false)
  
  // États pour l'édition
  const [editingRestaurantId, setEditingRestaurantId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null)
  const [updatingRestaurant, setUpdatingRestaurant] = useState(false)

  // États pour les plats
  const [dishes, setDishes] = useState<Dish[]>([])
  const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null)
  const [dishName, setDishName] = useState('')
  const [dishImageUrl, setDishImageUrl] = useState('')
  const [dishDescription, setDishDescription] = useState('')
  const [dishIsSignature, setDishIsSignature] = useState(false)
  const [submittingDish, setSubmittingDish] = useState(false)
  
  // États pour l'édition des plats
  const [editingDishId, setEditingDishId] = useState<string | null>(null)
  const [editDishName, setEditDishName] = useState<string>('')
  const [editDishImageUrl, setEditDishImageUrl] = useState<string>('')
  const [editDishDescription, setEditDishDescription] = useState<string>('')
  const [editDishIsSignature, setEditDishIsSignature] = useState<boolean>(false)
  const [updatingDish, setUpdatingDish] = useState<boolean>(false)
  const [deletingDishId, setDeletingDishId] = useState<string | null>(null)
  
  // États pour les fichiers d'images des plats (upload)
  const [newDishImageFile, setNewDishImageFile] = useState<File | null>(null)
  const [editDishImageFile, setEditDishImageFile] = useState<File | null>(null)

  // Fonction utilitaire pour générer un slug à partir d'un nom
  const slugify = (name: string) =>
    name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  // Fonction utilitaire d'upload d'image vers Supabase Storage
  const uploadImageToSupabase = async (file: File, folder: string): Promise<string> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${folder}-${crypto.randomUUID()}.${fileExt}`
      const filePath = `${folder}/${fileName}`

      const { data, error } = await supabase.storage
        .from('fastfood-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) {
        console.error('[uploadImageToSupabase] error', error)
        throw new Error('Erreur Supabase Storage : ' + error.message)
      }

      const { data: publicUrlData } = supabase.storage
        .from('fastfood-images')
        .getPublicUrl(filePath)

      return publicUrlData.publicUrl
    } catch (err: any) {
      console.error('[uploadImageToSupabase] unexpected', err)
      throw err
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          console.error('Erreur utilisateur:', userError)
          router.push('/login')
          return
        }

        // Récupérer tous les restaurants
        const { data: restaurantsData, error: restaurantsError } = await supabase
          .from('restaurants')
          .select('id, name, slug, logo_url, description, created_at')
          .order('created_at', { ascending: false })

        if (restaurantsError) {
          console.error('Erreur récupération restaurants:', restaurantsError)
          setError('Erreur lors du chargement des enseignes')
        } else {
          setRestaurants(restaurantsData || [])
        }

        // Récupérer tous les plats
        const { data: dishesData, error: dishesError } = await supabase
          .from('dishes')
          .select('*')
          .order('created_at', { ascending: false })

        if (dishesError) {
          console.error('Erreur récupération plats:', dishesError)
          setError('Erreur lors du chargement des plats')
        } else {
          setDishes(dishesData || [])
        }

        setLoading(false)
      } catch (err) {
        console.error('Erreur inattendue:', err)
        setError('Une erreur est survenue')
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const handleAddRestaurant = async () => {
    setError(null)
    setSuccessMessage(null)

    if (!newRestaurantName.trim()) {
      setError('Le nom de l\'enseigne est obligatoire.')
      return
    }

    setSubmittingRestaurant(true)
    try {
      let logoUrl: string | null = null

      if (newRestaurantLogoFile) {
        logoUrl = await uploadImageToSupabase(newRestaurantLogoFile, 'logos')
      }

      const slug = slugify(newRestaurantName.trim())

      const { data, error } = await supabase
        .from('restaurants')
        .insert({
          name: newRestaurantName.trim(),
          slug: slug,
          description: newRestaurantDescription.trim() || null,
          logo_url: logoUrl,
        })
        .select('id, name, slug, logo_url, description, created_at')
        .single()

      if (error) {
        console.error('[handleAddRestaurant] Supabase insert error', error)
        setError('Erreur Supabase (insert restaurant) : ' + error.message)
        return
      }

      if (data) {
        setRestaurants((prev) => [data as Restaurant, ...prev])
        setNewRestaurantName('')
        setNewRestaurantDescription('')
        setNewRestaurantLogoFile(null)
        setSuccessMessage('Enseigne créée avec succès.')
      }
    } catch (err: any) {
      console.error('[handleAddRestaurant] unexpected catch', err)
      setError(err?.message || 'Erreur inattendue lors de la création de l\'enseigne.')
    } finally {
      setSubmittingRestaurant(false)
    }
  }

  const handleSubmitDish = async (restaurantId: string) => {
    setError(null)

    if (!dishName.trim()) {
      setError('Le nom du plat est obligatoire')
      return
    }

    setSubmittingDish(true)

    try {
      // Upload de l'image si un fichier est présent
      let finalDishImageUrl: string | null = null

      if (newDishImageFile) {
        try {
          finalDishImageUrl = await uploadImageToSupabase(newDishImageFile, 'dishes')
        } catch (error: any) {
          setError('Erreur lors de l\'upload de l\'image du plat : ' + error.message)
          setSubmittingDish(false)
          return
        }
      }

      const { data: newDish, error: dishError } = await supabase
        .from('dishes')
        .insert({
          restaurant_id: restaurantId,
          name: dishName.trim(),
          image_url: finalDishImageUrl,
          description: dishDescription.trim() || null,
          is_signature: dishIsSignature,
        })
        .select('*')
        .single()

      if (dishError) {
        console.error('Erreur insertion plat:', dishError)
        setError(dishError.message || 'Erreur lors de l\'ajout du plat')
        setSubmittingDish(false)
        return
      }

      // Ajouter le nouveau plat au début de la liste
      setDishes([newDish, ...dishes])
      
      // Réinitialiser les champs
      setDishName('')
      setDishImageUrl('')
      setDishDescription('')
      setDishIsSignature(false)
      setNewDishImageFile(null)
      setActiveRestaurantId(null)
      setSubmittingDish(false)
    } catch (err) {
      console.error('Erreur inattendue:', err)
      setError('Une erreur est survenue')
      setSubmittingDish(false)
    }
  }

  const handleEditRestaurant = (restaurant: Restaurant) => {
    if (editingRestaurantId === restaurant.id) {
      // Annuler l'édition
      setEditingRestaurantId(null)
      setEditName('')
      setEditDescription('')
      setEditLogoFile(null)
      // Annuler aussi l'édition d'un plat si elle est en cours
      setEditingDishId(null)
    } else {
      // Activer l'édition
      setEditingRestaurantId(restaurant.id)
      setEditName(restaurant.name)
      setEditDescription(restaurant.description || '')
      setEditLogoFile(null)
      // Annuler l'édition d'un plat si elle est en cours pour une autre enseigne
      setEditingDishId(null)
    }
  }

  const handleUpdateRestaurant = async (restaurant: Restaurant) => {
    setError(null)
    setSuccessMessage(null)

    if (!editName.trim()) {
      setError('Le nom de l\'enseigne est obligatoire.')
      return
    }

    setUpdatingRestaurant(true)
    try {
      let finalLogoUrl = restaurant.logo_url

      if (editLogoFile) {
        finalLogoUrl = await uploadImageToSupabase(editLogoFile, 'logos')
      }

      const slug = slugify(editName.trim())

      const { data, error } = await supabase
        .from('restaurants')
        .update({
          name: editName.trim(),
          slug: slug,
          description: editDescription.trim() || null,
          logo_url: finalLogoUrl,
        })
        .eq('id', restaurant.id)
        .select('id, name, slug, logo_url, description, created_at')
        .single()

      if (error) {
        console.error('[handleUpdateRestaurant] Supabase error', error)
        setError(error.message)
        return
      }

      if (data) {
        setRestaurants((prev) =>
          prev.map((r) => (r.id === restaurant.id ? (data as Restaurant) : r))
        )
        setEditingRestaurantId(null)
        setEditLogoFile(null)
        setSuccessMessage('Enseigne mise à jour avec succès.')
      }
    } catch (err: any) {
      console.error('[handleUpdateRestaurant] unexpected', err)
      setError('Erreur inattendue lors de la mise à jour de l\'enseigne.')
    } finally {
      setUpdatingRestaurant(false)
    }
  }

  const handleDeleteRestaurant = async (restaurant: Restaurant) => {
    const confirmed = window.confirm(
      'Tu es sûr de vouloir supprimer cette enseigne ? Cette action supprimera aussi les plats associés.'
    )

    if (!confirmed) {
      return
    }

    setDeletingRestaurantId(restaurant.id)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('restaurants')
        .delete()
        .eq('id', restaurant.id)

      if (deleteError) {
        console.error('Erreur suppression:', deleteError)
        setError(deleteError.message || 'Erreur lors de la suppression de l\'enseigne')
        setDeletingRestaurantId(null)
        return
      }

      // Mettre à jour les states
      setRestaurants(restaurants.filter(r => r.id !== restaurant.id))
      setDishes(dishes.filter(d => d.restaurant_id !== restaurant.id))
      setDeletingRestaurantId(null)
    } catch (err) {
      console.error('Erreur inattendue:', err)
      setError('Une erreur est survenue')
      setDeletingRestaurantId(null)
    }
  }

  const handleUpdateDish = async (dishId: string) => {
    if (!editDishName.trim()) {
      setError('Le nom du plat est obligatoire')
      return
    }

    setUpdatingDish(true)
    setError(null)

    try {
      // Récupérer le plat actuel pour conserver l'image si aucun nouveau fichier
      const currentDish = dishes.find(d => d.id === dishId)
      let finalImageUrl = currentDish?.image_url || null

      // Upload de la nouvelle image si un fichier est présent
      if (editDishImageFile) {
        try {
          finalImageUrl = await uploadImageToSupabase(editDishImageFile, 'dishes')
        } catch (error: any) {
          setError('Erreur lors de l\'upload de l\'image du plat : ' + error.message)
          setUpdatingDish(false)
          return
        }
      }

      const { data, error } = await supabase
        .from('dishes')
        .update({
          name: editDishName.trim(),
          image_url: finalImageUrl,
          description: editDishDescription.trim() || null,
          is_signature: editDishIsSignature,
        })
        .eq('id', dishId)
        .select('*')
        .single()

      if (error) {
        setError(error.message)
      } else if (data) {
        // Mettre à jour le state dishes
        setDishes((prev) =>
          prev.map((d) => (d.id === dishId ? (data as any) : d))
        )
        setEditingDishId(null)
        setEditDishImageFile(null)
      }

      setUpdatingDish(false)
    } catch (err) {
      console.error('Erreur inattendue:', err)
      setError('Une erreur est survenue')
      setUpdatingDish(false)
    }
  }

  const handleDeleteDish = async (dishId: string) => {
    if (!confirm('Tu es sûr de vouloir supprimer ce plat ?')) return

    setDeletingDishId(dishId)
    setError(null)

    try {
      const { error } = await supabase
        .from('dishes')
        .delete()
        .eq('id', dishId)

      if (error) {
        setError(error.message)
      } else {
        setDishes((prev) => prev.filter((d) => d.id !== dishId))
      }

      setDeletingDishId(null)
    } catch (err) {
      console.error('Erreur inattendue:', err)
      setError('Une erreur est survenue')
      setDeletingDishId(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 px-4 py-10">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-slate-300">Chargement des enseignes…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin – Enseignes & Plats</h1>
          <p className="text-slate-300">
            Ajoute les enseignes et leurs plats. Ils seront utilisés partout dans FastFoodBox.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400 mb-2">
            {error}
          </p>
        )}

        {successMessage && (
          <p className="text-sm text-emerald-400 mb-2">
            {successMessage}
          </p>
        )}

        {/* Formulaire de création d'enseigne */}
        <div className="bg-slate-900/70 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Créer une enseigne</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="newRestaurantName" className="block text-sm font-medium text-slate-300 mb-1">
                Nom de l'enseigne *
              </label>
              <input
                id="newRestaurantName"
                type="text"
                value={newRestaurantName}
                onChange={(e) => setNewRestaurantName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="McDonald's, Burger King..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Logo de l'enseigne
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setNewRestaurantLogoFile(file)
                }}
                className="block w-full text-xs text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:font-semibold hover:file:bg-slate-700"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Tu peux laisser vide si tu veux créer l'enseigne sans logo.
              </p>
            </div>

            <div>
              <label htmlFor="newRestaurantDescription" className="block text-sm font-medium text-slate-300 mb-1">
                Description de l'enseigne
              </label>
              <textarea
                id="newRestaurantDescription"
                value={newRestaurantDescription}
                onChange={(e) => setNewRestaurantDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Description de l'enseigne..."
              />
            </div>

            <button
              type="button"
              onClick={handleAddRestaurant}
              disabled={submittingRestaurant}
              className="mt-3 inline-flex items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black shadow hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submittingRestaurant ? 'Enregistrement...' : 'Ajouter l\'enseigne'}
            </button>
          </div>
        </div>

        {/* Liste des restaurants avec leurs plats */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Enseignes ({restaurants.length})
          </h2>

          {restaurants.length === 0 ? (
            <div className="bg-slate-900/70 rounded-xl p-6 text-center text-slate-400">
              Aucune enseigne pour le moment.
            </div>
          ) : (
            <div className="space-y-5">
              {restaurants.map((restaurant) => {
                const restaurantDishes = dishes.filter(dish => dish.restaurant_id === restaurant.id)
                const isActive = activeRestaurantId === restaurant.id

                return (
                  <div
                    key={restaurant.id}
                    className="bg-slate-900/80 rounded-xl p-5 shadow-lg space-y-4"
                  >
                    {/* En-tête de l'enseigne */}
                    {editingRestaurantId === restaurant.id ? (
                      <div className="bg-slate-800/50 rounded-lg p-4 space-y-3 border border-slate-700">
                        <h4 className="text-sm font-medium text-slate-300">Modifier l'enseigne</h4>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Nom de l'enseigne *
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="Nom de l'enseigne"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1 mt-2">
                            Nouveau logo (optionnel)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null
                              setEditLogoFile(file)
                            }}
                            className="block w-full text-xs text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:font-semibold hover:file:bg-slate-700"
                          />
                          <p className="mt-1 text-[10px] text-slate-500">
                            Si tu n'en choisis pas, le logo actuel est conservé.
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Description
                          </label>
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="Description de l'enseigne..."
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateRestaurant(restaurant)}
                            disabled={updatingRestaurant}
                            className="inline-flex items-center justify-center rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-black shadow hover:bg-amber-400 disabled:opacity-60"
                          >
                            {updatingRestaurant ? 'Enregistrement...' : 'Enregistrer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditRestaurant(restaurant)}
                            disabled={updatingRestaurant}
                            className="px-4 py-2 bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        {restaurant.logo_url && (
                          <img
                            src={restaurant.logo_url}
                            alt={restaurant.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-slate-50">
                                {restaurant.name}
                              </h3>
                              <p className="text-xs text-slate-500">
                                Créée le {new Date(restaurant.created_at).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditRestaurant(restaurant)}
                                className="text-sm text-blue-400 hover:text-blue-300"
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRestaurant(restaurant)}
                                disabled={deletingRestaurantId === restaurant.id}
                                className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {deletingRestaurantId === restaurant.id ? 'Suppression...' : 'Supprimer l\'enseigne'}
                              </button>
                            </div>
                          </div>
                          {restaurant.description ? (
                            <p className="text-sm text-slate-300 mt-2">
                              {restaurant.description}
                            </p>
                          ) : (
                            <p className="text-sm text-slate-500 italic mt-2">
                              Aucune description pour l'instant.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Liste des plats */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-slate-400">Plats :</h4>
                      {restaurantDishes.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">
                          Aucun plat enregistré pour cette enseigne.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {restaurantDishes.map((dish) => (
                            <div key={dish.id}>
                              {editingDishId === dish.id ? (
                                // Formulaire d'édition inline
                                <div className="border border-slate-700 rounded-lg p-3 space-y-2">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-medium mb-1">
                                        Nom du plat
                                      </label>
                                      <input
                                        type="text"
                                        value={editDishName}
                                        onChange={(e) => setEditDishName(e.target.value)}
                                        className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium mb-1">
                                        Nouvelle image (optionnel)
                                      </label>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0] ?? null
                                          setEditDishImageFile(file)
                                        }}
                                        className="block w-full text-xs text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:font-semibold hover:file:bg-slate-700"
                                      />
                                      <p className="mt-1 text-[10px] text-slate-500">
                                        Si tu n'en choisis pas, l'image actuelle est conservée.
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium mb-1">
                                      Description
                                    </label>
                                    <textarea
                                      value={editDishDescription}
                                      onChange={(e) => setEditDishDescription(e.target.value)}
                                      rows={2}
                                      className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                    />
                                  </div>
                                  <label className="inline-flex items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={editDishIsSignature}
                                      onChange={(e) => setEditDishIsSignature(e.target.checked)}
                                      className="rounded border-slate-600 bg-slate-950 text-amber-500"
                                    />
                                    Plat signature
                                  </label>
                                  <div className="flex items-center gap-2 justify-end pt-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingDishId(null)
                                        setEditDishImageFile(null)
                                      }}
                                      className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs"
                                    >
                                      Annuler
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateDish(dish.id)}
                                      disabled={updatingDish}
                                      className="px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-xs font-semibold text-black disabled:opacity-60"
                                    >
                                      {updatingDish ? 'Enregistrement...' : 'Enregistrer'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                // Affichage lecture seule
                                <div className="flex items-center justify-between gap-3 border-b border-slate-800 py-2">
                                  <div className="flex items-center gap-3">
                                    {dish.image_url && (
                                      <img
                                        src={dish.image_url}
                                        alt={dish.name}
                                        className="h-10 w-10 rounded-md object-cover"
                                      />
                                    )}
                                    <div>
                                      <p className="text-sm font-medium">{dish.name}</p>
                                      {dish.is_signature && (
                                        <span className="inline-flex items-center rounded-full bg-amber-500/90 text-black text-[10px] font-semibold px-2 py-0.5 mt-1">
                                          Signature
                                        </span>
                                      )}
                                      {dish.description && (
                                        <p className="text-xs text-slate-400 mt-1">
                                          {dish.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {editingRestaurantId === restaurant.id && (
                                    <div className="flex items-center gap-2 text-xs">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingDishId(dish.id)
                                          setEditDishName(dish.name)
                                          setEditDishImageUrl(dish.image_url ?? '')
                                          setEditDishDescription(dish.description ?? '')
                                          setEditDishIsSignature(dish.is_signature)
                                          setEditDishImageFile(null)
                                          setError(null)
                                        }}
                                        className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700"
                                      >
                                        Modifier
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDish(dish.id)}
                                        disabled={deletingDishId === dish.id}
                                        className="px-2 py-1 rounded-md bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-60"
                                      >
                                        {deletingDishId === dish.id ? 'Suppression...' : 'Supprimer'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Formulaire d'ajout de plat */}
                    {isActive ? (
                      <div className="bg-slate-800/50 rounded-lg p-4 space-y-3 border border-slate-700">
                        <h4 className="text-sm font-medium text-slate-300">Ajouter un plat</h4>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Nom du plat *
                          </label>
                          <input
                            type="text"
                            value={dishName}
                            onChange={(e) => setDishName(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="Big Mac, Whopper..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Image du plat
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null
                              setNewDishImageFile(file)
                            }}
                            className="block w-full text-xs text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:font-semibold hover:file:bg-slate-700"
                          />
                          <p className="mt-1 text-[10px] text-slate-500">
                            Si tu ne choisis pas d'image, le plat sera créé sans visuel.
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Description
                          </label>
                          <textarea
                            value={dishDescription}
                            onChange={(e) => setDishDescription(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="Description du plat..."
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`signature-${restaurant.id}`}
                            checked={dishIsSignature}
                            onChange={(e) => setDishIsSignature(e.target.checked)}
                            className="w-4 h-4 text-orange-500 bg-slate-700 border-slate-600 rounded focus:ring-orange-500"
                          />
                          <label
                            htmlFor={`signature-${restaurant.id}`}
                            className="text-xs text-slate-300"
                          >
                            Plat signature
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSubmitDish(restaurant.id)}
                            disabled={submittingDish}
                            className="flex-1 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submittingDish ? 'Ajout...' : 'Ajouter ce plat'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveRestaurantId(null)
                              setDishName('')
                              setDishImageUrl('')
                              setDishDescription('')
                              setDishIsSignature(false)
                              setNewDishImageFile(null)
                            }}
                            className="px-4 py-2 bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-600 transition-colors"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveRestaurantId(restaurant.id)}
                        className="w-full px-4 py-2 bg-slate-800 text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors border border-slate-700"
                      >
                        + Ajouter un plat
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

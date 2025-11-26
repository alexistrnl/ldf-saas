"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type DishForRating = {
  id: string;
  name: string;
};

export default function AddNotePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<{ id: string; name: string } | null>(null);

  // note principale
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  // date de visite
  const [visitedAt, setVisitedAt] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );

  // commentaire
  const [comment, setComment] = useState("");

  // plats pour une enseigne
  const [dishes, setDishes] = useState<DishForRating[]>([]);
  const [dishRatings, setDishRatings] = useState<Record<string, number>>({});

  // charger user et restaurant
  useEffect(() => {
    const loadData = async () => {
      // Charger user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!userError && userData?.user) {
        setUserId(userData.user.id);
      } else {
        setUserId(null);
      }

      // Charger restaurant par slug
      if (params?.slug) {
        const { data: restaurantData, error: restaurantError } = await supabase
          .from("restaurants")
          .select("id, name")
          .eq("slug", params.slug)
          .single();

        if (!restaurantError && restaurantData) {
          setRestaurant({ id: restaurantData.id, name: restaurantData.name });
        } else {
          setError("Enseigne introuvable.");
        }
      }
    };

    loadData();
  }, [params?.slug]);

  // charger plats
  useEffect(() => {
    const loadDishes = async () => {
      if (!restaurant?.id) return;
      const { data, error } = await supabase
        .from("dishes")
        .select("id, name")
        .eq("restaurant_id", restaurant.id)
        .order("position", { ascending: true })
        .order("name", { ascending: true });

      if (!error && data) {
        setDishes(data as DishForRating[]);
      }
    };

    if (restaurant?.id) {
      loadDishes();
    }
  }, [restaurant?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userId) {
      setError("Tu dois être connecté pour ajouter une note.");
      return;
    }

    if (!restaurant) {
      setError("Enseigne introuvable.");
      return;
    }

    if (rating < 1 || rating > 5) {
      setError("Merci de choisir une note entre 1 et 5.");
      return;
    }

    setLoading(true);
    try {
      const { data: newLog, error: insertError } = await supabase
        .from("fastfood_logs")
        .insert({
          user_id: userId,
          restaurant_id: restaurant.id,
          restaurant_name: restaurant.name,
          rating,
          comment: comment || null,
          visited_at: visitedAt || null,
        })
        .select("id")
        .single();

      if (insertError || !newLog) {
        throw insertError || new Error("Insertion log échouée");
      }

      // insert plats notés
      const ratedDishes = Object.entries(dishRatings)
        .filter(([, r]) => r > 0)
        .map(([dishId, r]) => {
          const dish = dishes.find((d) => d.id === dishId);
          if (!dish) return null;
          return {
            log_id: newLog.id,
            dish_id: dishId,
            dish_name: dish.name,
            rating: r,
          };
        })
        .filter(Boolean) as {
        log_id: string;
        dish_id: string;
        dish_name: string;
        rating: number;
      }[];

      if (ratedDishes.length > 0) {
        const { error: dishError } = await supabase
          .from("fastfood_log_dishes")
          .insert(ratedDishes);
        if (dishError) {
          console.error("Erreur fastfood_log_dishes", dishError);
        }
      }

      // Rediriger vers la page de l'enseigne
      router.push(`/restaurants/${params.slug}`);
    } catch (err: any) {
      console.error("Erreur enregistrement expérience :", err);

      const message =
        err?.message ||
        err?.hint ||
        (typeof err === "string" ? err : null) ||
        "Erreur lors de l'enregistrement de ton expérience.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-950 text-slate-50">
      {/* Header avec bouton retour */}
      <header className="sticky top-0 z-30 w-full bg-[#020617]/95 backdrop-blur-md border-b border-white/5">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            aria-label="Revenir en arrière"
            className="rounded-full bg-white/10 px-3 py-2 text-xl text-white hover:bg-white/20 transition"
          >
            ←
          </button>
          <h1 className="text-lg font-semibold text-white">Ajouter une note</h1>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="mx-auto w-full max-w-xl px-4 py-6 pb-24">
        {restaurant && (
          <div className="mb-4">
            <p className="text-xs text-slate-400 mb-1">Enseigne</p>
            <p className="text-base font-semibold text-white">{restaurant.name}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {!userId && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-sm text-yellow-400">
              Tu dois être connecté pour enregistrer une note.
            </p>
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Date */}
          <div className="space-y-2 w-full">
            <label className="text-sm text-slate-300 font-medium">Date de visite</label>
            <input
              type="date"
              value={visitedAt}
              onChange={(e) => setVisitedAt(e.target.value)}
              className="w-full max-w-full box-border rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-sm outline-none focus:border-bitebox transition"
            />
          </div>

          {/* Note principale */}
          <div className="space-y-2">
            <label className="text-sm text-slate-300 font-medium">Note globale</label>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const activeValue = hoverRating ?? rating;
                  const isActive = activeValue >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="text-3xl leading-none transition-transform hover:scale-110"
                    >
                      <span
                        className={
                          isActive ? "text-yellow-400" : "text-slate-600"
                        }
                      >
                        ★
                      </span>
                    </button>
                  );
                })}
              </div>
              <span className="text-base text-slate-400 font-medium">
                {rating} / 5
              </span>
            </div>
          </div>

          {/* Notes de plats si disponible */}
          {restaurant && dishes.length > 0 && (
            <div className="space-y-3 w-full">
              <p className="text-sm text-slate-300 font-medium">
                Note les plats que tu as goûtés (optionnel)
              </p>
              <div className="space-y-3 max-h-96 overflow-y-auto w-full">
                {dishes.map((dish) => {
                  const value = dishRatings[dish.id] ?? 0;
                  const setValue = (v: number) =>
                    setDishRatings((prev) => ({
                      ...prev,
                      [dish.id]: prev[dish.id] === v ? 0 : v,
                    }));
                  return (
                    <div
                      key={dish.id}
                      className="flex flex-col gap-2 rounded-lg bg-slate-900/70 border border-slate-800 px-4 py-3 w-full"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-100 truncate">
                          {dish.name}
                        </p>
                        {value > 0 && (
                          <span className="text-xs text-bitebox-light font-medium">
                            {value}/5
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const active = value >= star;
                          return (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setValue(star)}
                              className="text-2xl leading-none transition-transform hover:scale-110"
                            >
                              <span
                                className={
                                  active ? "text-yellow-400" : "text-slate-700"
                                }
                              >
                                ★
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Commentaire */}
          <div className="space-y-2">
            <label className="text-sm text-slate-300 font-medium">
              Commentaire (optionnel)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-sm outline-none focus:border-bitebox resize-none transition"
              placeholder="Raconte un peu ton expérience globale…"
            />
          </div>

          {/* Boutons */}
          <div className="flex items-center justify-end gap-3 pt-4 w-full">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 sm:px-6 py-3 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 transition font-medium whitespace-nowrap"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !userId || !restaurant}
              className="px-4 sm:px-6 py-3 rounded-lg bg-bitebox text-white font-semibold hover:bg-bitebox-dark disabled:opacity-60 disabled:cursor-not-allowed transition whitespace-nowrap"
            >
              {loading ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}


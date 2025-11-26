"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AddExperienceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  presetRestaurantId?: string;
  presetRestaurantName?: string;
};

type RestaurantOption = {
  id: string;
  name: string;
};

type DishForRating = {
  id: string;
  name: string;
};

export default function AddExperienceModal({
  isOpen,
  onClose,
  presetRestaurantId,
  presetRestaurantName,
}: AddExperienceModalProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // note principale
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  // date de visite
  const [visitedAt, setVisitedAt] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );

  // commentaire
  const [comment, setComment] = useState("");

  // sélection d’enseigne (quand pas preset)
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [restaurantQuery, setRestaurantQuery] = useState("");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(
    presetRestaurantId ?? null
  );
  const [selectedRestaurantName, setSelectedRestaurantName] = useState<string>(
    presetRestaurantName ?? ""
  );
  const [showSuggestions, setShowSuggestions] = useState(false);

  // plats pour une enseigne
  const [dishes, setDishes] = useState<DishForRating[]>([]);
  const [dishRatings, setDishRatings] = useState<Record<string, number>>({});

  // charger user
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        setUserId(data.user.id);
      } else {
        setUserId(null);
      }
    };
    if (isOpen) loadUser();
  }, [isOpen]);

  // charger restaurants (si pas preset)
  useEffect(() => {
    const loadRestaurants = async () => {
      if (presetRestaurantId) return;
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .order("name", { ascending: true });

      if (!error && data) {
        setRestaurants(data as RestaurantOption[]);
      }
    };
    if (isOpen) loadRestaurants();
  }, [isOpen, presetRestaurantId]);

  // charger plats (si preset)
  useEffect(() => {
    const loadDishes = async () => {
      if (!presetRestaurantId) return;
      const { data, error } = await supabase
        .from("dishes")
        .select("id, name")
        .eq("restaurant_id", presetRestaurantId)
        .order("position", { ascending: true })
        .order("name", { ascending: true });

      if (!error && data) {
        setDishes(data as DishForRating[]);
      }
    };
    if (isOpen) loadDishes();
  }, [isOpen, presetRestaurantId]);

  if (!isOpen) return null;

  const filteredRestaurants =
    !presetRestaurantId && restaurantQuery.length > 0
      ? restaurants.filter((r) =>
          r.name.toLowerCase().includes(restaurantQuery.toLowerCase())
        )
      : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userId) {
      setError("Tu dois être connecté pour ajouter une note.");
      return;
    }

    const chosenRestaurantId = presetRestaurantId ?? selectedRestaurantId;
    const chosenRestaurantName = presetRestaurantName ?? selectedRestaurantName;

    if (!chosenRestaurantId || !chosenRestaurantName) {
      setError("Merci de choisir une enseigne.");
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
          restaurant_id: chosenRestaurantId,
          restaurant_name: chosenRestaurantName,
          rating,
          comment: comment || null,
          visited_at: visitedAt || null,
        })
        .select("id")
        .single();

      if (insertError || !newLog) {
        throw insertError || new Error("Insertion log échouée");
      }

      // insert plats notés si presetRestaurantId
      if (presetRestaurantId) {
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
      }

      // reset et fermeture
      setRating(5);
      setHoverRating(null);
      setVisitedAt(new Date().toISOString().slice(0, 10));
      setComment("");
      setRestaurantQuery("");
      if (!presetRestaurantId) {
        setSelectedRestaurantId(null);
        setSelectedRestaurantName("");
      }
      setDishRatings({});
      onClose();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-xl px-5 py-6">
        <h2 className="text-lg font-semibold mb-4">Ajouter une expérience</h2>

        {error && (
          <p className="mb-3 text-xs text-red-400">
            {error}
          </p>
        )}

        {!userId && (
          <p className="mb-3 text-xs text-slate-300">
            Tu dois être connecté pour enregistrer une note.
          </p>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Enseigne */}
          {presetRestaurantId ? (
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Enseigne</label>
              <p className="text-sm font-medium">
                {presetRestaurantName}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Enseigne</label>
              <div className="relative">
                <input
                  type="text"
                  value={restaurantQuery || selectedRestaurantName}
                  onChange={(e) => {
                    setSelectedRestaurantId(null);
                    setSelectedRestaurantName("");
                    setRestaurantQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => {
                    if (restaurantQuery || !selectedRestaurantName) {
                      setShowSuggestions(true);
                    }
                  }}
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                  placeholder="Tape le nom de l’enseigne…"
                />
                {showSuggestions &&
                  restaurantQuery.length > 0 &&
                  filteredRestaurants.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md bg-slate-950 border border-slate-700 shadow-lg">
                      {filteredRestaurants.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setSelectedRestaurantId(r.id);
                            setSelectedRestaurantName(r.name);
                            setRestaurantQuery("");
                            setShowSuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-800"
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
              {selectedRestaurantName && (
                <p className="text-[11px] text-slate-400">
                  Enseigne sélectionnée :{" "}
                  <span className="font-medium">
                    {selectedRestaurantName}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Date */}
          <div className="space-y-1">
            <label className="text-xs text-slate-300">Date de visite</label>
            <input
              type="date"
              value={visitedAt}
              onChange={(e) => setVisitedAt(e.target.value)}
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
            />
          </div>

          {/* Note principale */}
          <div className="space-y-1">
            <label className="text-xs text-slate-300">Note globale</label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
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
                      className="text-xl leading-none"
                    >
                      <span
                        className={
                          isActive ? "text-bitebox-light" : "text-slate-600"
                        }
                      >
                        ★
                      </span>
                    </button>
                  );
                })}
              </div>
              <span className="text-xs text-slate-400">
                {rating} / 5
              </span>
            </div>
          </div>

          {/* Notes de plats si preset */}
          {presetRestaurantId && dishes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-300">
                Note les plats que tu as goûtés (optionnel).
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
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
                      className="flex flex-col gap-1 rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-100 truncate">
                          {dish.name}
                        </p>
                        {value > 0 && (
                          <span className="text-[10px] text-bitebox-light">
                            {value}/5
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const active = value >= star;
                          return (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setValue(star)}
                              className="text-lg leading-none"
                            >
                              <span
                                className={
                                  active ? "text-bitebox-light" : "text-slate-700"
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

          {/* Commentaire (dernier champ) */}
          <div className="space-y-1">
            <label className="text-xs text-slate-300">
              Commentaire (optionnel)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox resize-none"
              placeholder="Raconte un peu ton expérience globale…"
            />
          </div>

          {/* Boutons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !userId}
              className="text-xs px-4 py-2 rounded-md bg-bitebox text-white font-semibold hover:bg-bitebox-dark disabled:opacity-60"
            >
              {loading ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

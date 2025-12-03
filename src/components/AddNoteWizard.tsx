"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Spinner from "@/components/Spinner";
import Image from "next/image";

type Restaurant = {
  id: string;
  name: string;
  logo_url: string | null;
  slug: string | null;
};

type Dish = {
  id: string;
  name: string;
  image_url: string | null;
};

type WizardState = {
  currentStep: number;
  selectedRestaurantId: string | null;
  selectedRestaurantName: string | null;
  selectedRestaurantSlug: string | null;
  selectedDishIds: string[];
  dishRatings: Record<string, number>;
  globalRating: number;
  visitDate: string;
  comment: string;
};

type AddNoteWizardProps = {
  presetRestaurantId?: string | null;
  presetRestaurantName?: string | null;
  presetRestaurantSlug?: string | null;
  onSuccess?: () => void;
};

export default function AddNoteWizard({
  presetRestaurantId,
  presetRestaurantName,
  presetRestaurantSlug,
  onSuccess,
}: AddNoteWizardProps) {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // État du wizard
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: 1,
    selectedRestaurantId: presetRestaurantId || null,
    selectedRestaurantName: presetRestaurantName || null,
    selectedRestaurantSlug: presetRestaurantSlug || null,
    selectedDishIds: [],
    dishRatings: {},
    globalRating: 0,
    visitDate: new Date().toISOString().slice(0, 10),
    comment: "",
  });

  // Données chargées
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantQuery, setRestaurantQuery] = useState("");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [dishQuery, setDishQuery] = useState("");

  // Charger l'utilisateur
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        setUserId(data.user.id);
      }
    };
    loadUser();
  }, []);

  // Charger les restaurants (étape 1)
  useEffect(() => {
    const loadRestaurants = async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, logo_url, slug")
        .order("name", { ascending: true });

      if (!error && data) {
        setRestaurants(data as Restaurant[]);
      }
    };
    loadRestaurants();
  }, []);

  // Charger les plats quand un restaurant est sélectionné (étape 2)
  useEffect(() => {
    const loadDishes = async () => {
      if (!wizardState.selectedRestaurantId) {
        setDishes([]);
        return;
      }

      const { data, error } = await supabase
        .from("dishes")
        .select("id, name, image_url")
        .eq("restaurant_id", wizardState.selectedRestaurantId)
        .order("position", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

      if (!error && data) {
        setDishes(data as Dish[]);
      }
    };

    if (wizardState.selectedRestaurantId) {
      loadDishes();
    }
  }, [wizardState.selectedRestaurantId]);

  // Filtrer les restaurants
  const filteredRestaurants =
    restaurantQuery.length > 0
      ? restaurants.filter((r) =>
          r.name.toLowerCase().includes(restaurantQuery.toLowerCase())
        )
      : restaurants;

  // Filtrer les plats
  const filteredDishes =
    dishQuery.length > 0
      ? dishes.filter((d) =>
          d.name.toLowerCase().includes(dishQuery.toLowerCase())
        )
      : dishes;

  // Navigation
  const goToStep = (step: number) => {
    if (step >= 1 && step <= 4) {
      setWizardState((prev) => ({ ...prev, currentStep: step }));
      setError(null);
    }
  };

  const nextStep = () => {
    // Validation selon l'étape
    if (wizardState.currentStep === 1) {
      if (!wizardState.selectedRestaurantId) {
        setError("Merci de choisir une enseigne.");
        return;
      }
      goToStep(2);
    } else if (wizardState.currentStep === 2) {
      // On peut continuer même sans plat sélectionné
      if (wizardState.selectedDishIds.length > 0) {
        goToStep(3); // Aller à l'étape des notes de plats
      } else {
        goToStep(4); // Passer directement à l'étape finale
      }
    } else if (wizardState.currentStep === 3) {
      goToStep(4);
    }
  };

  const prevStep = () => {
    if (wizardState.currentStep > 1) {
      goToStep(wizardState.currentStep - 1);
    }
  };

  // Sélection/désélection d'un plat
  const toggleDishSelection = (dishId: string) => {
    setWizardState((prev) => ({
      ...prev,
      selectedDishIds: prev.selectedDishIds.includes(dishId)
        ? prev.selectedDishIds.filter((id) => id !== dishId)
        : [...prev.selectedDishIds, dishId],
    }));
  };

  // Définir la note d'un plat
  const setDishRating = (dishId: string, rating: number) => {
    setWizardState((prev) => ({
      ...prev,
      dishRatings: {
        ...prev.dishRatings,
        [dishId]: prev.dishRatings[dishId] === rating ? 0 : rating,
      },
    }));
  };

  // Soumettre le formulaire
  const handleSubmit = async () => {
    setError(null);

    if (!userId) {
      setError("Tu dois être connecté pour ajouter une note.");
      return;
    }

    if (!wizardState.selectedRestaurantId || !wizardState.selectedRestaurantName) {
      setError("Merci de choisir une enseigne.");
      return;
    }

    if (wizardState.globalRating < 1 || wizardState.globalRating > 5) {
      setError("Merci de choisir une note globale entre 1 et 5.");
      return;
    }

    setSubmitting(true);
    try {
      // Créer le log principal
      const { data: newLog, error: insertError } = await supabase
        .from("fastfood_logs")
        .insert({
          user_id: userId,
          restaurant_id: wizardState.selectedRestaurantId,
          restaurant_name: wizardState.selectedRestaurantName,
          rating: wizardState.globalRating,
          comment: wizardState.comment || null,
          visited_at: wizardState.visitDate || null,
        })
        .select("id")
        .single();

      if (insertError || !newLog) {
        throw insertError || new Error("Insertion log échouée");
      }

      // Insérer les notes de plats (uniquement ceux qui ont une note)
      const ratedDishes = wizardState.selectedDishIds
        .filter((dishId) => {
          const rating = wizardState.dishRatings[dishId];
          return rating && rating > 0;
        })
        .map((dishId) => {
          const dish = dishes.find((d) => d.id === dishId);
          if (!dish) return null;
          return {
            log_id: newLog.id,
            dish_id: dishId,
            dish_name: dish.name,
            rating: wizardState.dishRatings[dishId],
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
          throw dishError;
        }
      }

      // Succès
      if (onSuccess) {
        onSuccess();
      } else if (wizardState.selectedRestaurantSlug) {
        router.push(`/restaurants/${wizardState.selectedRestaurantSlug}`);
      } else {
        router.push("/home");
      }
    } catch (err: any) {
      console.error("Erreur enregistrement note :", err);
      const message =
        err?.message ||
        err?.hint ||
        (typeof err === "string" ? err : null) ||
        "Impossible d'enregistrer ta note. Réessaie dans un instant.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Plats sélectionnés pour l'étape 3
  const selectedDishes = dishes.filter((d) =>
    wizardState.selectedDishIds.includes(d.id)
  );

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-950 text-slate-50">
      {/* Header avec bouton retour */}
      <header className="sticky top-0 z-30 w-full bg-[#020617]/95 backdrop-blur-md border-b border-white/5">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => {
              if (wizardState.currentStep > 1) {
                prevStep();
              } else {
                router.back();
              }
            }}
            aria-label="Revenir en arrière"
            className="rounded-full bg-white/10 px-3 py-2 text-xl text-white hover:bg-white/20 transition"
          >
            ←
          </button>
          <h1 className="text-lg font-semibold text-white">Ajouter une note</h1>
        </div>
      </header>

      {/* Barre de progression */}
      <div className="sticky top-[57px] z-20 w-full bg-[#020617]/90 backdrop-blur-md border-b border-white/5">
        <div className="mx-auto max-w-xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">
              Étape {wizardState.currentStep} / 4
            </span>
            <span className="text-xs text-slate-400">
              {Math.round((wizardState.currentStep / 4) * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-bitebox transition-all duration-300"
              style={{ width: `${(wizardState.currentStep / 4) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <main className="mx-auto w-full max-w-xl px-4 py-6 pb-32">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Étape 1 : Choix de l'enseigne */}
        {wizardState.currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                1. Quelle enseigne ?
              </h2>
              <p className="text-sm text-slate-400">
                Sélectionne l'enseigne où tu as mangé
              </p>
            </div>

            {/* Recherche */}
            <div className="relative">
              <input
                type="text"
                value={restaurantQuery}
                onChange={(e) => setRestaurantQuery(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-sm outline-none focus:border-bitebox transition"
                placeholder="Rechercher une enseigne..."
              />
            </div>

            {/* Liste des restaurants */}
            <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
              {filteredRestaurants.map((restaurant) => {
                const isSelected =
                  wizardState.selectedRestaurantId === restaurant.id;
                return (
                  <button
                    key={restaurant.id}
                    type="button"
                    onClick={() => {
                      setWizardState((prev) => ({
                        ...prev,
                        selectedRestaurantId: restaurant.id,
                        selectedRestaurantName: restaurant.name,
                        selectedRestaurantSlug: restaurant.slug,
                      }));
                      setRestaurantQuery("");
                    }}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition ${
                      isSelected
                        ? "border-bitebox bg-bitebox/10"
                        : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                    }`}
                  >
                    {restaurant.logo_url ? (
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800">
                        <Image
                          src={restaurant.logo_url}
                          alt={restaurant.name}
                          fill
                          className="object-contain p-1"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-slate-500">📦</span>
                      </div>
                    )}
                    <span
                      className={`flex-1 text-left font-medium ${
                        isSelected ? "text-white" : "text-slate-200"
                      }`}
                    >
                      {restaurant.name}
                    </span>
                    {isSelected && (
                      <span className="text-bitebox">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Étape 2 : Sélection des plats */}
        {wizardState.currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                2. Quels plats as-tu goûtés ?
              </h2>
              <p className="text-sm text-slate-400">
                Sélectionne les plats que tu as mangés. Tu peux en sélectionner
                plusieurs.
              </p>
            </div>

            {/* Résumé enseigne */}
            {wizardState.selectedRestaurantName && (
              <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                <p className="text-xs text-slate-400 mb-1">Enseigne</p>
                <p className="text-sm font-medium text-white">
                  {wizardState.selectedRestaurantName}
                </p>
              </div>
            )}

            {/* Recherche de plats */}
            {dishes.length > 5 && (
              <div className="relative">
                <input
                  type="text"
                  value={dishQuery}
                  onChange={(e) => setDishQuery(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-sm outline-none focus:border-bitebox transition"
                  placeholder="Rechercher un plat..."
                />
              </div>
            )}

            {/* Liste des plats */}
            {dishes.length === 0 ? (
              <div className="p-6 rounded-lg bg-slate-900/70 border border-slate-800 text-center">
                <p className="text-sm text-slate-400">
                  Aucun plat n'a encore été ajouté pour cette enseigne.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 max-h-[calc(100vh-350px)] overflow-y-auto">
                  {filteredDishes.map((dish) => {
                    const isSelected = wizardState.selectedDishIds.includes(
                      dish.id
                    );
                    return (
                      <button
                        key={dish.id}
                        type="button"
                        onClick={() => toggleDishSelection(dish.id)}
                        className={`relative flex flex-col rounded-xl border-2 overflow-hidden transition ${
                          isSelected
                            ? "border-bitebox bg-bitebox/10"
                            : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                        }`}
                      >
                        {/* Image */}
                        {dish.image_url ? (
                          <div className="relative w-full aspect-square bg-amber-50 border-b border-amber-200">
                            {dish.image_url.toLowerCase().includes(".png") ? (
                              <img
                                src={dish.image_url}
                                alt={dish.name}
                                className="w-full h-full object-contain object-top scale-95 drop-shadow-xl p-2"
                              />
                            ) : (
                              <img
                                src={dish.image_url}
                                alt={dish.name}
                                className="w-full h-full object-cover object-center"
                              />
                            )}
                          </div>
                        ) : (
                          <div className="w-full aspect-square bg-slate-800 flex items-center justify-center">
                            <span className="text-xs text-slate-500">🍽️</span>
                          </div>
                        )}

                        {/* Nom */}
                        <div className="p-3">
                          <p
                            className={`text-xs font-medium text-left line-clamp-2 ${
                              isSelected ? "text-white" : "text-slate-200"
                            }`}
                          >
                            {dish.name}
                          </p>
                        </div>

                        {/* Badge sélectionné */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-bitebox text-white text-[10px] font-semibold px-2 py-1 rounded-full">
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {wizardState.selectedDishIds.length === 0 && (
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                    <p className="text-xs text-slate-400 text-center">
                      Tu peux aussi continuer sans sélectionner de plat.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Étape 3 : Note des plats */}
        {wizardState.currentStep === 3 && selectedDishes.length > 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                3. Note les plats que tu as goûtés
              </h2>
              <p className="text-sm text-slate-400">
                Donne une note à chaque plat (optionnel)
              </p>
            </div>

            <div className="space-y-4 max-h-[calc(100vh-350px)] overflow-y-auto">
              {selectedDishes.map((dish) => {
                const rating = wizardState.dishRatings[dish.id] || 0;
                return (
                  <div
                    key={dish.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/70 border border-slate-800"
                  >
                    {/* Image miniature */}
                    {dish.image_url ? (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-amber-50 border border-amber-200">
                        {dish.image_url.toLowerCase().includes(".png") ? (
                          <img
                            src={dish.image_url}
                            alt={dish.name}
                            className="w-full h-full object-contain object-top scale-95 drop-shadow-xl p-1"
                          />
                        ) : (
                          <img
                            src={dish.image_url}
                            alt={dish.name}
                            className="w-full h-full object-cover object-center"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">🍽️</span>
                      </div>
                    )}

                    {/* Nom et étoiles */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white mb-2 truncate">
                        {dish.name}
                      </p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setDishRating(dish.id, star)}
                            className="text-xl leading-none transition-transform hover:scale-110"
                          >
                            <span
                              className={
                                rating >= star
                                  ? "text-yellow-400"
                                  : "text-slate-700"
                              }
                            >
                              ★
                            </span>
                          </button>
                        ))}
                        {rating > 0 && (
                          <span className="text-xs text-slate-400 ml-2">
                            {rating}/5
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Étape 4 : Note globale + avis */}
        {wizardState.currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                4. Ton avis global
              </h2>
              <p className="text-sm text-slate-400">
                Donne une note globale à cette enseigne
              </p>
            </div>

            {/* Résumé */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-900/70 border border-slate-800">
              <div>
                <p className="text-xs text-slate-400 mb-1">Enseigne</p>
                <p className="text-sm font-medium text-white">
                  {wizardState.selectedRestaurantName}
                </p>
              </div>
              {wizardState.selectedDishIds.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">
                    Plats sélectionnés ({wizardState.selectedDishIds.length})
                  </p>
                  <p className="text-xs text-slate-300">
                    {selectedDishes.map((d) => d.name).join(", ")}
                  </p>
                </div>
              )}
            </div>

            {/* Note globale */}
            <div className="space-y-3">
              <label className="text-sm text-slate-300 font-medium">
                Note globale *
              </label>
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() =>
                        setWizardState((prev) => ({
                          ...prev,
                          globalRating: star,
                        }))
                      }
                      className="text-3xl leading-none transition-transform hover:scale-110"
                    >
                      <span
                        className={
                          wizardState.globalRating >= star
                            ? "text-yellow-400"
                            : "text-slate-600"
                        }
                      >
                        ★
                      </span>
                    </button>
                  ))}
                </div>
                {wizardState.globalRating > 0 && (
                  <span className="text-base text-slate-400 font-medium">
                    {wizardState.globalRating} / 5
                  </span>
                )}
              </div>
            </div>

            {/* Date de visite */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300 font-medium">
                Date de visite
              </label>
              <input
                type="date"
                value={wizardState.visitDate}
                onChange={(e) =>
                  setWizardState((prev) => ({
                    ...prev,
                    visitDate: e.target.value,
                  }))
                }
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-sm outline-none focus:border-bitebox transition appearance-none"
                style={{ WebkitAppearance: "none", MozAppearance: "textfield" }}
              />
            </div>

            {/* Commentaire */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300 font-medium">
                Ajoute un avis (optionnel)
              </label>
              <textarea
                value={wizardState.comment}
                onChange={(e) =>
                  setWizardState((prev) => ({
                    ...prev,
                    comment: e.target.value,
                  }))
                }
                rows={4}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-sm outline-none focus:border-bitebox resize-none transition"
                placeholder="Raconte un peu ton expérience globale…"
              />
            </div>
          </div>
        )}
      </main>

      {/* Navigation fixée en bas */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#020617]/95 backdrop-blur-md border-t border-white/5">
        <div className="mx-auto max-w-xl px-4 py-4">
          <div className="flex items-center gap-3">
            {wizardState.currentStep > 1 && (
              <button
                onClick={prevStep}
                disabled={submitting}
                className="px-4 py-3 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 transition font-medium flex-1"
              >
                Retour
              </button>
            )}
            {wizardState.currentStep < 4 ? (
              <button
                onClick={nextStep}
                disabled={
                  (wizardState.currentStep === 1 &&
                    !wizardState.selectedRestaurantId) ||
                  submitting
                }
                className="px-4 py-3 rounded-lg bg-bitebox text-white font-semibold hover:bg-bitebox-dark disabled:opacity-60 disabled:cursor-not-allowed transition flex-1 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Spinner size="sm" />
                    <span>Enregistrement…</span>
                  </>
                ) : (
                  "Continuer"
                )}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={
                  wizardState.globalRating < 1 ||
                  wizardState.globalRating > 5 ||
                  submitting
                }
                className="px-4 py-3 rounded-lg bg-bitebox text-white font-semibold hover:bg-bitebox-dark disabled:opacity-60 disabled:cursor-not-allowed transition flex-1 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Spinner size="sm" />
                    <span>Enregistrement…</span>
                  </>
                ) : (
                  "Publier ma note"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


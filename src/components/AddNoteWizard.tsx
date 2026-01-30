"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Spinner from "@/components/Spinner";
import Image from "next/image";
import StarRating from "@/components/StarRating";
import DishImage from "@/components/DishImage";

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

    if (wizardState.globalRating <= 0 || wizardState.globalRating > 5) {
      setError("Merci de choisir une note globale entre 0.5 et 5.");
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

  // Calculer la moyenne des notes des plats notés
  const calculateAverageDishRating = () => {
    const ratedDishes = selectedDishes.filter((dish) => {
      const rating = wizardState.dishRatings[dish.id];
      return rating && rating > 0;
    });

    if (ratedDishes.length === 0) return 0;

    const sum = ratedDishes.reduce((acc, dish) => {
      return acc + (wizardState.dishRatings[dish.id] || 0);
    }, 0);

    const average = sum / ratedDishes.length;
    return Math.round(average * 100) / 100; // Arrondir à 2 décimales maximum
  };

  // Préremplir la note globale avec la moyenne des plats quand on arrive à l'étape 4
  useEffect(() => {
    if (wizardState.currentStep === 4) {
      const averageRating = calculateAverageDishRating();
      // Toujours préremplir avec la moyenne si des plats ont été notés
      // Cela calcule la moyenne de tous les plats notés (ou la note unique si un seul plat)
      if (averageRating > 0) {
        setWizardState((prev) => ({
          ...prev,
          globalRating: averageRating,
        }));
      }
    }
  }, [wizardState.currentStep, wizardState.dishRatings]);

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
            <div className="space-y-2">
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
                <div className="grid grid-cols-2 gap-3">
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
                        <DishImage
                          src={dish.image_url}
                          alt={dish.name}
                          className="rounded-t-2xl rounded-b-none"
                        />

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
            </div>

            <div className="space-y-4">
              {selectedDishes.map((dish) => {
                const rating = wizardState.dishRatings[dish.id] || 0;
                return (
                  <div
                    key={dish.id}
                    className="flex gap-4 p-4 rounded-xl bg-slate-900/70 border border-slate-800"
                  >
                    {/* Image à gauche */}
                    <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24">
                      <DishImage
                        src={dish.image_url}
                        alt={dish.name}
                        size="small"
                        className="w-full h-full"
                      />
                    </div>

                    {/* Contenu principal : nom et notation */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      {/* Nom du plat */}
                      <p className="text-sm font-semibold text-white mb-3 line-clamp-2">
                        {dish.name}
                      </p>
                      
                      {/* Zone de notation bien visible */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <StarRating
                            value={rating}
                            onChange={(value) => setDishRating(dish.id, value)}
                            size="lg"
                            allowHalf={true}
                            className="flex-shrink-0"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="5"
                              step="0.5"
                              value={rating > 0 ? rating : ""}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value) && value >= 0 && value <= 5) {
                                  setDishRating(dish.id, value);
                                } else if (e.target.value === "") {
                                  setDishRating(dish.id, 0);
                                }
                              }}
                              onBlur={(e) => {
                                const value = parseFloat(e.target.value);
                                if (isNaN(value) || value < 0) {
                                  setDishRating(dish.id, 0);
                                } else if (value > 5) {
                                  setDishRating(dish.id, 5);
                                }
                              }}
                              placeholder="0"
                              className="w-16 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm font-semibold text-white text-center outline-none focus:border-bitebox transition"
                              style={{ WebkitAppearance: "none", MozAppearance: "textfield" }}
                            />
                            <span className="text-sm font-semibold text-slate-400 whitespace-nowrap">
                              / 5
                            </span>
                          </div>
                        </div>
                        {rating === 0 && (
                          <p className="text-xs text-slate-500">
                            Clique, glisse ou tape une note
                          </p>
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
                  <p className="text-xs text-slate-400 mb-2">
                    Plats sélectionnés ({wizardState.selectedDishIds.length})
                  </p>
                  <div className="space-y-2">
                    {selectedDishes.map((dish) => {
                      const dishRating = wizardState.dishRatings[dish.id] || 0;
                      return (
                        <div
                          key={dish.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-300 truncate flex-1 mr-2">
                            {dish.name}
                          </span>
                          {dishRating > 0 ? (
                            <span className="text-slate-200 font-semibold whitespace-nowrap">
                              {dishRating.toFixed(2)} / 5
                            </span>
                          ) : (
                            <span className="text-slate-500 whitespace-nowrap">
                              Non noté
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Note globale */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300 font-medium">
                  Note globale *
                </label>
                {selectedDishes.some((d) => (wizardState.dishRatings[d.id] || 0) > 0) && (
                  <span className="text-xs text-slate-500">
                    (Moyenne: {calculateAverageDishRating().toFixed(2)} / 5)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <StarRating
                  value={wizardState.globalRating}
                  onChange={(value) =>
                    setWizardState((prev) => ({
                      ...prev,
                      globalRating: value,
                    }))
                  }
                  size="lg"
                  allowHalf={true}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    value={wizardState.globalRating > 0 ? wizardState.globalRating : ""}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 0 && value <= 5) {
                        setWizardState((prev) => ({
                          ...prev,
                          globalRating: value,
                        }));
                      } else if (e.target.value === "") {
                        setWizardState((prev) => ({
                          ...prev,
                          globalRating: 0,
                        }));
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value);
                      if (isNaN(value) || value < 0) {
                        setWizardState((prev) => ({
                          ...prev,
                          globalRating: 0,
                        }));
                      } else if (value > 5) {
                        setWizardState((prev) => ({
                          ...prev,
                          globalRating: 5,
                        }));
                      }
                    }}
                    placeholder="0"
                    className="w-16 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm font-semibold text-white text-center outline-none focus:border-bitebox transition"
                    style={{ WebkitAppearance: "none", MozAppearance: "textfield" }}
                  />
                  <span className="text-base text-slate-400 font-medium">
                    / 5
                  </span>
                </div>
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
                  wizardState.globalRating <= 0 ||
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


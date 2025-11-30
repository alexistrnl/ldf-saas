"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AddExperienceModal from "@/components/AddExperienceModal";
import Image from "next/image";
import { calculatePublicRating } from "@/lib/ratingUtils";
import { useIsMobile } from "@/hooks/useIsMobile";
import Spinner from "@/components/Spinner";

type Restaurant = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  description: string | null;
};

type Dish = {
  id: string;
  restaurant_id: string;
  name: string;
  image_url: string | null;
  description: string | null;
  is_signature: boolean;
  is_limited_edition: boolean;
  sort_order: number | null;
  category_id: string | null;
};

type DishCategory = {
  id: string;
  restaurant_id: string;
  name: string;
  order_index: number;
};

type RatingStats = {
  count: number;
  sum: number;
  avg: number;
};

type DishWithStats = Dish & {
  ratingStats: RatingStats;
};

// Fonction helper pour détecter si une image est un PNG
const isPngImage = (url: string | null): boolean => {
  if (!url) return false;
  // Extraire le chemin sans paramètres de requête ni fragments
  const path = url.split('?')[0].split('#')[0];
  return path.toLowerCase().endsWith('.png');
};

export default function RestaurantPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const isMobile = useIsMobile();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantRatingStats, setRestaurantRatingStats] = useState<{ count: number; avg: number }>({ count: 0, avg: 0 });
  const [dishes, setDishes] = useState<DishWithStats[]>([]);
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddExperienceOpen, setIsAddExperienceOpen] = useState(false);
  const [topDishIndex, setTopDishIndex] = useState(0);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const handleAddNoteClick = () => {
    if (isMobile) {
      router.push(`/restaurants/${params.slug}/add-note`);
    } else {
      setIsAddExperienceOpen(true);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        setLoading(true);

        // 1) Charger l'enseigne par son slug
        const { data: restaurantData, error: restaurantError } = await supabase
          .from("restaurants")
          .select("*")
          .eq("slug", params.slug)
          .single();

        if (restaurantError || !restaurantData) {
          console.error("[RestaurantPage] restaurant error", restaurantError);
          setError("Impossible de charger cette enseigne.");
          setLoading(false);
          return;
        }

        setRestaurant(restaurantData as Restaurant);

        // 2) Charger les logs concernant cette enseigne pour calculer la note publique (1 utilisateur = 1 voix)
        const { data: restaurantLogs, error: restaurantLogsError } = await supabase
          .from("fastfood_logs")
          .select("user_id, rating")
          .eq("restaurant_id", restaurantData.id);

        if (restaurantLogsError) {
          console.error("Erreur chargement logs restaurant", restaurantLogsError);
        }

        // Calculer la note publique avec la règle "1 utilisateur = 1 voix"
        const logs = (restaurantLogs || []) as Array<{ user_id: string; rating: number | null }>;
        const { publicRating, uniqueVotersCount } = calculatePublicRating(logs);

        const restaurantRatingStats: { count: number; avg: number } = {
          count: uniqueVotersCount,
          avg: publicRating,
        };

        setRestaurantRatingStats(restaurantRatingStats);

        // 3) Charger les sections de menu pour cette enseigne
        const { data: categoriesData, error: categoriesError } = await supabase
          .from("dish_categories")
          .select("*")
          .eq("restaurant_id", restaurantData.id)
          .order("order_index", { ascending: true });

        if (categoriesError) {
          console.error("[RestaurantPage] categories error", categoriesError);
          // Ne pas bloquer si les catégories n'existent pas encore
        }

        const categoriesTyped = (categoriesData || []) as DishCategory[];
        setCategories(categoriesTyped);

        // 4) Charger les plats de cette enseigne
        const { data: dishesData, error: dishesError } = await supabase
          .from("dishes")
          .select("*")
          .eq("restaurant_id", restaurantData.id)
          .order("position", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true });

        if (dishesError) {
          console.error("[RestaurantPage] dishes error", dishesError);
          setLoading(false);
          return;
        }

        const dishesDataTyped = (dishesData || []) as Dish[];

        // 5) Charger les notes des plats depuis fastfood_log_dishes
        const dishIds = dishesDataTyped.map((d) => d.id);

        let dishRatingMap = new Map<string, { count: number; sum: number; avg: number }>();

        if (dishIds.length > 0) {
          const { data: dishLogs, error: dishLogsError } = await supabase
            .from("fastfood_log_dishes")
            .select("dish_id, rating")
            .in("dish_id", dishIds);

          if (dishLogsError) {
            console.error("Erreur chargement notes plats", dishLogsError);
          } else if (dishLogs) {
            dishRatingMap = new Map();

            for (const row of dishLogs) {
              if (!row.dish_id || typeof row.rating !== "number") continue;
              const current = dishRatingMap.get(row.dish_id) ?? {
                count: 0,
                sum: 0,
                avg: 0,
              };
              const count = current.count + 1;
              const sum = current.sum + row.rating;
              dishRatingMap.set(row.dish_id, {
                count,
                sum,
                avg: sum / count,
              });
            }
          }
        }

        // Enrichir chaque plat avec ses stats
        const dishesWithStats: DishWithStats[] = dishesDataTyped.map((dish) => {
          const stats = dishRatingMap.get(dish.id);
          return {
            ...dish,
            ratingStats: stats ?? { count: 0, sum: 0, avg: 0 },
          };
        });

        setDishes(dishesWithStats);
        setLoading(false);
      } catch (err) {
        console.error("[RestaurantPage] unexpected error", err);
        setError("Erreur inattendue lors du chargement de l'enseigne.");
        setLoading(false);
      }
    };

    if (params?.slug) {
      fetchData();
    }
  }, [params?.slug]);

  // Filtrer les catégories qui ont des plats (calculé avec useMemo)
  const categoriesWithDishes = useMemo(() => {
    if (!categories || !dishes) return [];
    return categories.filter((cat) => {
      return dishes.some((d) => d.category_id === cat.id);
    });
  }, [categories, dishes]);

  // Créer une dépendance stable basée sur les IDs pour l'observer
  const categoryIdsString = useMemo(() => {
    return categoriesWithDishes.map((cat) => cat.id).join(",");
  }, [categoriesWithDishes]);

  // Observer pour détecter la section visible lors du scroll
  useEffect(() => {
    if (categoriesWithDishes.length === 0 || loading) return;

    let observer: IntersectionObserver | null = null;
    const categoryIds = categoriesWithDishes.map((cat) => cat.id);

    // Petit délai pour s'assurer que les éléments DOM sont rendus
    const timeoutId = setTimeout(() => {
      const observerOptions = {
        root: null,
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
      };

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const categoryId = entry.target.id.replace("section-", "");
            setActiveCategoryId(categoryId);
          }
        });
      }, observerOptions);

      // Observer toutes les sections de catégories
      categoryIds.forEach((categoryId) => {
        const element = document.getElementById(`section-${categoryId}`);
        if (element) {
          observer?.observe(element);
        }
      });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (observer) {
        categoryIds.forEach((categoryId) => {
          const element = document.getElementById(`section-${categoryId}`);
          if (element) {
            observer?.unobserve(element);
          }
        });
        observer?.disconnect();
      }
    };
  }, [categoryIdsString, loading, categoriesWithDishes.length]);

  // Définir la première catégorie comme active par défaut
  useEffect(() => {
    if (categoriesWithDishes.length > 0 && activeCategoryId === null && !loading) {
      setActiveCategoryId(categoriesWithDishes[0].id);
    }
  }, [categoriesWithDishes, loading, activeCategoryId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-red-400">{error ?? "Enseigne introuvable."}</p>
      </div>
    );
  }

  // Calculer le Top 3 des plats les mieux notés
  const topRatedDishes = dishes
    .filter((d) => d.ratingStats.count > 0)
    .sort((a, b) => {
      if (b.ratingStats.avg === a.ratingStats.avg) {
        return b.ratingStats.count - a.ratingStats.count; // départage sur nb d'avis
      }
      return b.ratingStats.avg - a.ratingStats.avg;
    })
    .slice(0, 3);

  // Navigation du carrousel
  const goToNextDish = () => {
    setTopDishIndex((prev) => (prev + 1) % topRatedDishes.length);
  };

  const goToPrevDish = () => {
    setTopDishIndex((prev) => (prev - 1 + topRatedDishes.length) % topRatedDishes.length);
  };

  const goToDish = (index: number) => {
    setTopDishIndex(index);
  };

  // Fonction de scroll fluide vers une section
  const scrollToSection = (categoryId: string) => {
    const el = document.getElementById(`section-${categoryId}`);
    if (!el) return;
    setActiveCategoryId(categoryId);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-b-3xl bg-black/40">
        {/* Bannière */}
        <div className="relative h-40 sm:h-52">
          {restaurant.logo_url ? (
            <Image
              src={restaurant.logo_url}
              alt={restaurant.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full bg-slate-800 flex items-center justify-center">
              <span className="text-sm text-slate-500">Pas de logo</span>
            </div>
          )}
          {/* Dégradé en bas pour la lisibilité */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Menu d'ancrage des catégories */}
        {categoriesWithDishes.length > 0 && (
          <div className="mb-6 -mt-2">
            <div className="overflow-x-auto no-scrollbar">
              <div className="flex gap-2 sm:gap-3 justify-center">
                {categoriesWithDishes.map((cat) => {
                  const isActive = activeCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => scrollToSection(cat.id)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
                        isActive
                          ? "bg-bitebox text-white"
                          : "bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {/* Bloc note + bouton */}
        <section className="mt-4 flex flex-col items-center gap-4 mb-6">
          {/* Bloc note */}
          {restaurantRatingStats.count === 0 ? (
            <span className="text-sm text-slate-500">
              Cette enseigne n'a pas encore de note publique.
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={
                      restaurantRatingStats.avg >= star
                        ? "text-yellow-400"
                        : "text-slate-700"
                    }
                  >
                    ★
                  </span>
                ))}
              </div>
              <span className="text-sm text-slate-300">
                {restaurantRatingStats.avg.toFixed(1)} / 5 • {restaurantRatingStats.count} avis
              </span>
            </div>
          )}

          {/* Bouton Ajouter une note */}
          <button
            onClick={handleAddNoteClick}
            className="inline-flex items-center rounded-full bg-bitebox px-6 py-3 text-sm font-semibold text-white shadow hover:bg-bitebox-dark transition"
          >
            Ajouter une note
          </button>
        </section>

        {/* Top 3 plats les mieux notés */}
        {topRatedDishes.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-slate-50 mb-3">
              Les plats les mieux notés
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Le top 3 des plats notés par la communauté pour cette enseigne.
            </p>
            
            {/* Carrousel */}
            <div className="relative">
              {/* Conteneur du carrousel */}
              <div className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
                <div
                  className="flex transition-transform duration-300 ease-in-out"
                  style={{
                    transform: `translateX(-${topDishIndex * 100}%)`,
                  }}
                >
                  {topRatedDishes.map((dish, index) => (
                    <div
                      key={dish.id}
                      className="min-w-full flex flex-col"
                    >
                      {/* Image */}
                      <div className="aspect-[4/3] bg-slate-950 flex items-center justify-center overflow-hidden">
                        {dish.image_url ? (
                          <img
                            src={dish.image_url}
                            alt={dish.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-slate-500">Pas d'image</span>
                        )}
                      </div>

                      {/* Contenu */}
                      <div className="px-4 py-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-100 truncate">
                            {dish.name}
                          </p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-bitebox/10 text-yellow-400 border border-bitebox/40 whitespace-nowrap">
                            Top {index + 1}
                          </span>
                        </div>

                        {/* Note en étoiles */}
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={
                                  dish.ratingStats.avg >= star
                                    ? "text-yellow-400"
                                    : "text-slate-700"
                                }
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <span className="text-[11px] text-slate-400 ml-1">
                            {dish.ratingStats.avg.toFixed(1)} / 5 ·{" "}
                            {dish.ratingStats.count} avis
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Boutons de navigation */}
                {topRatedDishes.length > 1 && (
                  <>
                    <button
                      onClick={goToPrevDish}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-full p-2 transition shadow-lg"
                      aria-label="Plat précédent"
                    >
                      <svg
                        className="w-5 h-5 text-slate-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={goToNextDish}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-full p-2 transition shadow-lg"
                      aria-label="Plat suivant"
                    >
                      <svg
                        className="w-5 h-5 text-slate-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </>
                )}
              </div>

              {/* Indicateurs de position */}
              {topRatedDishes.length > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  {topRatedDishes.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToDish(index)}
                      className={`h-2 rounded-full transition-all ${
                        index === topDishIndex
                          ? "w-6 bg-bitebox"
                          : "w-2 bg-slate-600 hover:bg-slate-500"
                      }`}
                      aria-label={`Aller au plat ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Carte des plats */}
        <section className="mt-4">
          <h2 className="text-lg font-semibold mb-3">La carte</h2>

          {dishes.length === 0 ? (
            <p className="text-sm text-slate-400">
              Aucun plat n'a encore été ajouté pour cette enseigne.
            </p>
          ) : categories.length === 0 ? (
            // Affichage sans sections (comportement par défaut)
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {dishes.map((dish) => (
                <div
                  key={dish.id}
                  className="bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-800/70 shadow-md flex flex-col"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl bg-[#0d0d12]">
                    {dish.image_url ? (
                      <img
                        src={dish.image_url}
                        alt={dish.name}
                        className={`absolute inset-0 w-full h-full object-cover object-center ${
                          isPngImage(dish.image_url) ? 'scale-90' : ''
                        }`}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs text-slate-500">Pas d'image</span>
                      </div>
                    )}
                  </div>

                  <div className="px-3 py-3 space-y-1">
                    <p className="text-sm font-semibold truncate">{dish.name}</p>
                    {(dish.is_signature || dish.is_limited_edition) && (
                      <div className="flex gap-2 flex-wrap">
                        {dish.is_signature && (
                          <span className="inline-flex items-center rounded-full bg-bitebox/90 text-white text-[10px] font-semibold px-2 py-[1px]">
                            Plat signature
                          </span>
                        )}
                        {dish.is_limited_edition && (
                          <span className="inline-flex items-center rounded-full bg-bitebox/60 text-white text-[10px] font-semibold px-2 py-[1px]">
                            Édition limitée
                          </span>
                        )}
                      </div>
                    )}
                    {dish.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2">
                        {dish.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
                      {dish.ratingStats.count === 0 ? (
                        <span className="text-slate-500">Pas encore noté</span>
                      ) : (
                        <>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={
                                  dish.ratingStats.avg >= star
                                    ? "text-yellow-400"
                                    : "text-slate-700"
                                }
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <span className="text-slate-400 ml-1">
                            {dish.ratingStats.avg.toFixed(1)} / 5 · {dish.ratingStats.count} avis
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Affichage groupé par sections
            <div className="space-y-6">
              {categories.map((category) => {
                const categoryDishes = dishes.filter((d) => d.category_id === category.id);
                if (categoryDishes.length === 0) return null;

                return (
                  <div key={category.id} id={`section-${category.id}`} className="space-y-3 pt-4">
                    <h3 className="text-base font-semibold text-slate-100 border-b border-slate-800 pb-2">
                      {category.name}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      {categoryDishes.map((dish) => (
                        <div
                          key={dish.id}
                          className="bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-800/70 shadow-md flex flex-col"
                        >
                          <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl bg-[#0d0d12]">
                            {dish.image_url ? (
                              <img
                                src={dish.image_url}
                                alt={dish.name}
                                className={`absolute inset-0 w-full h-full object-cover object-center ${
                                  dish.image_url.toLowerCase().endsWith('.png') ? 'scale-90' : ''
                                }`}
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs text-slate-500">Pas d'image</span>
                              </div>
                            )}
                          </div>

                          <div className="px-3 py-3 space-y-1">
                            <p className="text-sm font-semibold truncate">{dish.name}</p>
                            {(dish.is_signature || dish.is_limited_edition) && (
                              <div className="flex gap-2 flex-wrap">
                                {dish.is_signature && (
                                  <span className="inline-flex items-center rounded-full bg-bitebox/90 text-white text-[10px] font-semibold px-2 py-[1px]">
                                    Plat signature
                                  </span>
                                )}
                                {dish.is_limited_edition && (
                                  <span className="inline-flex items-center rounded-full bg-bitebox/60 text-white text-[10px] font-semibold px-2 py-[1px]">
                                    Édition limitée
                                  </span>
                                )}
                              </div>
                            )}
                            {dish.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-2">
                                {dish.description}
                              </p>
                            )}
                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
                              {dish.ratingStats.count === 0 ? (
                                <span className="text-slate-500">Pas encore noté</span>
                              ) : (
                                <>
                                  <div className="flex">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <span
                                        key={star}
                                        className={
                                          dish.ratingStats.avg >= star
                                            ? "text-yellow-400"
                                            : "text-slate-700"
                                        }
                                      >
                                        ★
                                      </span>
                                    ))}
                                  </div>
                                  <span className="text-slate-400 ml-1">
                                    {dish.ratingStats.avg.toFixed(1)} / 5 · {dish.ratingStats.count} avis
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {/* Plats sans section */}
              {(() => {
                const dishesWithoutCategory = dishes.filter((d) => !d.category_id);
                if (dishesWithoutCategory.length === 0) return null;

                return (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-slate-100 border-b border-slate-800 pb-2">
                      Autres
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      {dishesWithoutCategory.map((dish) => (
                        <div
                          key={dish.id}
                          className="bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-800/70 shadow-md flex flex-col"
                        >
                          <div className="aspect-[4/3] bg-slate-950 flex items-center justify-center overflow-hidden">
                            {dish.image_url ? (
                              <img
                                src={dish.image_url}
                                alt={dish.name}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <span className="text-xs text-slate-500">Pas d'image</span>
                            )}
                          </div>

                          <div className="px-3 py-3 space-y-1">
                            <p className="text-sm font-semibold truncate">{dish.name}</p>
                            {(dish.is_signature || dish.is_limited_edition) && (
                              <div className="flex gap-2 flex-wrap">
                                {dish.is_signature && (
                                  <span className="inline-flex items-center rounded-full bg-bitebox/90 text-white text-[10px] font-semibold px-2 py-[1px]">
                                    Plat signature
                                  </span>
                                )}
                                {dish.is_limited_edition && (
                                  <span className="inline-flex items-center rounded-full bg-bitebox/60 text-white text-[10px] font-semibold px-2 py-[1px]">
                                    Édition limitée
                                  </span>
                                )}
                              </div>
                            )}
                            {dish.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-2">
                                {dish.description}
                              </p>
                            )}
                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
                              {dish.ratingStats.count === 0 ? (
                                <span className="text-slate-500">Pas encore noté</span>
                              ) : (
                                <>
                                  <div className="flex">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <span
                                        key={star}
                                        className={
                                          dish.ratingStats.avg >= star
                                            ? "text-yellow-400"
                                            : "text-slate-700"
                                        }
                                      >
                                        ★
                                      </span>
                                    ))}
                                  </div>
                                  <span className="text-slate-400 ml-1">
                                    {dish.ratingStats.avg.toFixed(1)} / 5 · {dish.ratingStats.count} avis
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </section>
      </div>
      {/* Modal uniquement sur desktop */}
      {!isMobile && (
        <AddExperienceModal
          isOpen={isAddExperienceOpen}
          onClose={() => setIsAddExperienceOpen(false)}
          presetRestaurantId={restaurant.id}
          presetRestaurantName={restaurant.name}
        />
      )}
    </div>
  );
}

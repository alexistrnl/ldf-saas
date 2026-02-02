"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AddExperienceModal from "@/components/AddExperienceModal";
import Image from "next/image";
import { calculatePublicRating } from "@/lib/ratingUtils";
import { useIsMobile } from "@/hooks/useIsMobile";
import Spinner from "@/components/Spinner";
import DishImage from "@/components/DishImage";

type Restaurant = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  description: string | null;
  show_latest_additions: boolean | null;
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
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [latestDishes, setLatestDishes] = useState<DishWithStats[]>([]);
  const [brokenImageUrls, setBrokenImageUrls] = useState<Set<string>>(new Set());

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
                avg: Math.round((sum / count) * 100) / 100,
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

        // 6) Charger les 4 derniers plats créés pour ce restaurant
        const { data: latestDishesData, error: latestDishesError } = await supabase
          .from("dishes")
          .select("*")
          .eq("restaurant_id", restaurantData.id)
          .order("created_at", { ascending: false })
          .limit(4);

        if (latestDishesError) {
          console.error("[RestaurantPage] latest dishes error", latestDishesError);
        } else if (latestDishesData && latestDishesData.length > 0) {
          // Enrichir les plats récents avec leurs stats de notation
          const latestDishIds = latestDishesData.map((d) => d.id);
          const latestDishRatingMap = new Map<string, { count: number; sum: number; avg: number }>();

          if (latestDishIds.length > 0) {
            const { data: latestDishLogs, error: latestDishLogsError } = await supabase
              .from("fastfood_log_dishes")
              .select("dish_id, rating")
              .in("dish_id", latestDishIds);

            if (latestDishLogsError) {
              console.error("[RestaurantPage] latest dish logs error", latestDishLogsError);
            } else if (latestDishLogs) {
              for (const row of latestDishLogs) {
                if (!row.dish_id || typeof row.rating !== "number") continue;
                const current = latestDishRatingMap.get(row.dish_id) ?? {
                  count: 0,
                  sum: 0,
                  avg: 0,
                };
                const count = current.count + 1;
                const sum = current.sum + row.rating;
                latestDishRatingMap.set(row.dish_id, {
                  count,
                  sum,
                  avg: Math.round((sum / count) * 100) / 100,
                });
              }
            }
          }

          // Construire les plats récents avec leurs stats
          const latestDishesWithStats: DishWithStats[] = (latestDishesData as Dish[]).map((dish) => {
            const stats = latestDishRatingMap.get(dish.id);
            return {
              ...dish,
              ratingStats: stats ?? { count: 0, sum: 0, avg: 0 },
            };
          });

          setLatestDishes(latestDishesWithStats);
        } else {
          setLatestDishes([]);
        }

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

  // Fonction pour gérer les erreurs d'image
  const handleImageError = (imageUrl: string | null) => {
    if (imageUrl) {
      setBrokenImageUrls((prev) => new Set(prev).add(imageUrl));
    }
  };

  // Fonction helper pour vérifier si un plat a une image valide
  const hasValidImage = (dish: DishWithStats) => {
    // Vérifier que image_url existe, n'est pas null, et n'est pas une chaîne vide ou seulement des espaces
    if (!dish.image_url || typeof dish.image_url !== 'string' || dish.image_url.trim() === "") {
      return false;
    }
    // Vérifier que l'image n'est pas dans la liste des images cassées
    return !brokenImageUrls.has(dish.image_url);
  };

  // Fonction helper pour rendre une carte de plat (réutilisée dans plusieurs sections)
  // NOTE: Cette fonction ne devrait être appelée que pour les plats avec hasValidImage(dish) === true
  const renderDishCard = (dish: DishWithStats) => {
    // Double vérification de sécurité - ne pas afficher si pas d'image valide
    if (!hasValidImage(dish)) {
      return null;
    }
    
    return (
      <div
        key={dish.id}
        className="bg-white/5 backdrop-blur-sm rounded-lg overflow-hidden border border-white/10 shadow-sm hover:shadow-md transition-all flex flex-col"
      >
        <DishImage
          src={dish.image_url}
          alt={dish.name}
          className="rounded-t-lg rounded-b-none"
          onImageError={handleImageError}
        />

        <div className="px-3 py-2.5 space-y-1">
          <p className="text-sm font-medium truncate">{dish.name}</p>
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
                  {dish.ratingStats.avg.toFixed(2)} / 5 · {dish.ratingStats.count} avis
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

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


  // Fonction de scroll fluide vers une section
  const scrollToSection = (categoryId: string) => {
    const el = document.getElementById(`section-${categoryId}`);
    if (!el) return;
    setActiveCategoryId(categoryId);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Bannière avec logo */}
      <div className="relative w-full">
        <div className="relative h-48 sm:h-64 overflow-hidden">
          {restaurant.logo_url ? (
            <Image
              src={restaurant.logo_url}
              alt={restaurant.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
              <span className="text-lg text-slate-500 font-medium">Pas de logo</span>
            </div>
          )}
          {/* Dégradé en bas pour la lisibilité */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
        </div>
        
        {/* Nom du restaurant et informations */}
        <div className="relative -mt-16 sm:-mt-20 px-4 pb-6">
          <div className="max-w-5xl mx-auto">
            {/* Nom du restaurant */}
            <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-3">
              {restaurant.name}
            </h1>
            
            {/* Bloc note et bouton */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 bg-white/5 backdrop-blur-md rounded-lg p-4 border border-white/10 shadow-lg">
              {/* Bloc note */}
              <div className="flex-1 w-full sm:w-auto">
                {restaurantRatingStats.count === 0 ? (
                  <div className="text-center sm:text-left">
                    <p className="text-sm text-slate-400 mb-2">
                      Cette enseigne n'a pas encore de note publique.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`text-2xl ${
                              restaurantRatingStats.avg >= star
                                ? "text-orange-400"
                                : "text-slate-700"
                            }`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-lg font-semibold text-white">
                        {restaurantRatingStats.avg.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-300">
                      <span className="font-medium">{restaurantRatingStats.count}</span>{" "}
                      {restaurantRatingStats.count === 1 ? "avis" : "avis"}
                    </div>
                  </div>
                )}
              </div>

              {/* Bouton Ajouter une note */}
              <button
                onClick={handleAddNoteClick}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-bitebox px-5 py-2.5 text-sm font-medium text-white shadow-md hover:bg-bitebox-dark transition-colors"
              >
                Ajouter une note
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4">



        {/* Carte des plats */}
        <section className="mt-3">
          <h2 className="text-lg font-medium mb-3 text-slate-200">La carte</h2>

          {dishes.filter((dish) => hasValidImage(dish)).length === 0 ? (
            <p className="text-sm text-slate-400">
              Aucun plat n'a encore été ajouté pour cette enseigne.
            </p>
          ) : categories.length === 0 ? (
            // Affichage sans sections (comportement par défaut)
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {dishes.filter((dish) => hasValidImage(dish)).map((dish) => {
                const isBigFernand = restaurant?.name?.toLowerCase().includes("big fernand") || restaurant?.name?.toLowerCase().includes("big dfernand") || restaurant?.slug?.toLowerCase().includes("big-fernand") || restaurant?.slug?.toLowerCase().includes("big-dfernand");
                return (
                <div
                  key={dish.id}
                  className="bg-white/5 backdrop-blur-sm rounded-lg overflow-hidden border border-white/10 shadow-sm hover:shadow-md transition-all flex flex-col"
                >
                    <DishImage
                      src={dish.image_url}
                      alt={dish.name}
                      className="rounded-t-lg rounded-b-none"
                      onImageError={handleImageError}
                      forceCover={isBigFernand}
                    />

                  <div className="px-3 py-3 space-y-1">
                    <p className="text-sm font-medium truncate">{dish.name}</p>
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
                            {dish.ratingStats.avg.toFixed(2)} / 5 · {dish.ratingStats.count} avis
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            // Affichage groupé par sections
            <div className="space-y-6">
              {categories
                .filter((category) => {
                  const categoryDishes = dishes.filter((d) => d.category_id === category.id && hasValidImage(d));
                  return categoryDishes.length > 0;
                })
                .map((category) => {
                const categoryDishes = dishes.filter((d) => d.category_id === category.id && hasValidImage(d));
                const isBurgerKing = restaurant?.name?.toLowerCase().includes("burger king") || restaurant?.slug?.toLowerCase().includes("burger-king");
                const isBigFernand = restaurant?.name?.toLowerCase().includes("big fernand") || restaurant?.name?.toLowerCase().includes("big dfernand") || restaurant?.slug?.toLowerCase().includes("big-fernand") || restaurant?.slug?.toLowerCase().includes("big-dfernand");
                const isSmashSection = category.name?.toLowerCase().includes("smash");
                const shouldZoomImages = isBigFernand && isSmashSection;

                return (
                  <div key={category.id} id={`section-${category.id}`} className={`${isBurgerKing ? 'space-y-1 pt-1' : 'space-y-3 pt-4'}`}>
                    <h3 className="text-base font-medium text-slate-200 border-b border-white/10 pb-2">
                      {category.name}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      {categoryDishes.map((dish) => (
                        <div
                          key={dish.id}
                          className="bg-white/5 backdrop-blur-sm rounded-lg overflow-hidden border border-white/10 shadow-sm hover:shadow-md transition-all flex flex-col"
                        >
                    <DishImage
                      src={dish.image_url}
                      alt={dish.name}
                      className="rounded-t-lg rounded-b-none"
                      onImageError={handleImageError}
                      imageZoom={shouldZoomImages ? 1.3 : 1}
                      forceCover={isBigFernand}
                    />

                          <div className="px-3 py-2.5 space-y-1">
                            <p className="text-sm font-medium truncate">{dish.name}</p>
                            {(dish.is_signature || dish.is_limited_edition) && (
                              <div className="flex gap-2 flex-wrap">
                                {dish.is_signature && (
                                  <span className="inline-flex items-center rounded-full bg-bitebox/90 text-white text-[10px] font-semibold px-2 py-[1px]">
                                    Plat signature
                                  </span>
                                )}
                                {dish.is_limited_edition && (
                                  <span className="inline-flex items-center rounded-full bg-amber-500/90 text-white text-[10px] font-semibold px-2 py-[1px]">
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
                                    {dish.ratingStats.avg.toFixed(2)} / 5 · {dish.ratingStats.count} avis
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
                const dishesWithoutCategory = dishes.filter((d) => !d.category_id && hasValidImage(d));
                if (dishesWithoutCategory.length === 0) return null;
                const isBurgerKing = restaurant?.name?.toLowerCase().includes("burger king") || restaurant?.slug?.toLowerCase().includes("burger-king");
                const isBigFernand = restaurant?.name?.toLowerCase().includes("big fernand") || restaurant?.name?.toLowerCase().includes("big dfernand") || restaurant?.slug?.toLowerCase().includes("big-fernand") || restaurant?.slug?.toLowerCase().includes("big-dfernand");

                return (
                  <div className={isBurgerKing ? "space-y-1" : "space-y-3"}>
                    <h3 className="text-base font-medium text-slate-200 border-b border-white/10 pb-2">
                      Autres
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      {dishesWithoutCategory.map((dish) => {
                        // Ne pas afficher si pas d'image valide
                        if (!hasValidImage(dish)) return null;
                        return (
                        <div
                          key={dish.id}
                          className="bg-white/5 backdrop-blur-sm rounded-lg overflow-hidden border border-white/10 shadow-sm hover:shadow-md transition-all flex flex-col"
                        >
                    <DishImage
                      src={dish.image_url}
                      alt={dish.name}
                      className="rounded-t-lg rounded-b-none"
                      onImageError={handleImageError}
                      forceCover={isBigFernand}
                    />

                          <div className="px-3 py-2.5 space-y-1">
                            <p className="text-sm font-medium truncate">{dish.name}</p>
                            {(dish.is_signature || dish.is_limited_edition) && (
                              <div className="flex gap-2 flex-wrap">
                                {dish.is_signature && (
                                  <span className="inline-flex items-center rounded-full bg-bitebox/90 text-white text-[10px] font-semibold px-2 py-[1px]">
                                    Plat signature
                                  </span>
                                )}
                                {dish.is_limited_edition && (
                                  <span className="inline-flex items-center rounded-full bg-amber-500/90 text-white text-[10px] font-semibold px-2 py-[1px]">
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
                                    {dish.ratingStats.avg.toFixed(2)} / 5 · {dish.ratingStats.count} avis
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        );
                      })}
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

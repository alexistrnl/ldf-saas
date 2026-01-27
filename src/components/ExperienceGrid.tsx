"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import Spinner from "./Spinner";

type Experience = {
  id: string;
  restaurant_id: string | null;
  restaurant_slug: string | null;
  restaurant_name: string;
  restaurant_logo_url: string | null;
  rating: number;
  comment: string | null;
  visited_at: string | null;
  created_at: string;
  dish_image_url: string | null;
};

type DishRating = {
  dish_id: string;
  dish_name: string;
  rating: number;
  image_url: string | null;
};

type ExperienceGridProps = {
  experiences: Experience[];
  title: string;
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "Date inconnue";
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ExperienceGrid({ experiences, title }: ExperienceGridProps) {
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(null);
  const [experienceDishes, setExperienceDishes] = useState<DishRating[]>([]);
  const [loadingDishes, setLoadingDishes] = useState(false);

  const handleExperienceClick = async (exp: Experience) => {
    setSelectedExperience(exp);
    setLoadingDishes(true);
    setExperienceDishes([]);

    try {
      // Charger les plats notés pour cette expérience
      const { data: dishRatings, error } = await supabase
        .from("fastfood_log_dishes")
        .select("dish_id, dish_name, rating")
        .eq("log_id", exp.id);

      if (error) {
        console.error("[ExperienceGrid] Error loading dish ratings:", error);
      } else if (dishRatings && dishRatings.length > 0) {
        // Récupérer les images des plats
        const dishIds = dishRatings.map((dr) => dr.dish_id).filter(Boolean);
        let dishImagesMap = new Map<string, string | null>();

        if (dishIds.length > 0) {
          const { data: dishes } = await supabase
            .from("dishes")
            .select("id, image_url")
            .in("id", dishIds);

          if (dishes) {
            dishes.forEach((dish) => {
              dishImagesMap.set(dish.id, dish.image_url);
            });
          }
        }

        const dishesWithImages: DishRating[] = dishRatings.map((dr) => ({
          dish_id: dr.dish_id,
          dish_name: dr.dish_name || "Plat inconnu",
          rating: dr.rating || 0,
          image_url: dishImagesMap.get(dr.dish_id) || null,
        }));

        setExperienceDishes(dishesWithImages);
      }
    } catch (err) {
      console.error("[ExperienceGrid] Unexpected error loading dishes:", err);
    } finally {
      setLoadingDishes(false);
    }
  };

  const handleCloseExperienceModal = () => {
    setSelectedExperience(null);
    setExperienceDishes([]);
  };

  if (experiences.length === 0) {
    return (
      <section className="mt-8 text-center py-12">
        <p className="text-slate-400">Aucune expérience pour le moment</p>
      </section>
    );
  }

  return (
    <>
      <section className="mt-4 px-4">
        <h2 className="text-sm font-semibold text-white mb-3">{title}</h2>
        <div className="grid grid-cols-3 gap-1">
          {experiences.map((exp) => (
            <button
              key={exp.id}
              onClick={() => handleExperienceClick(exp)}
              className="aspect-square relative overflow-hidden bg-slate-800 group border border-white/5 cursor-pointer"
            >
              {exp.dish_image_url ? (
                <Image
                  src={exp.dish_image_url}
                  alt={exp.restaurant_name}
                  fill
                  className="object-cover group-hover:opacity-70 transition-opacity"
                />
              ) : exp.restaurant_logo_url ? (
                <Image
                  src={exp.restaurant_logo_url}
                  alt={exp.restaurant_name}
                  fill
                  className="object-cover w-full h-full group-hover:opacity-70 transition-opacity"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-800 group-hover:bg-slate-700 transition-colors">
                  <div className="flex flex-col items-center gap-1">
                    <svg
                      className="w-8 h-8 text-slate-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      />
                    </svg>
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-3 h-3 ${
                            i < exp.rating
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-slate-600"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {/* Overlay avec rating au survol */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-5 h-5 ${
                        i < exp.rating
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-slate-400"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Modal détails expérience */}
      {selectedExperience && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleCloseExperienceModal}>
          <div 
            className="bg-[#020617] rounded-2xl border border-white/10 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">{selectedExperience.restaurant_name}</h2>
              <button
                onClick={handleCloseExperienceModal}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                aria-label="Fermer"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Contenu */}
            <div className="p-4 space-y-4">
              {/* Note du restaurant */}
              <div className="flex flex-col items-center gap-2 pb-4 border-b border-white/10">
                <span className="text-sm text-slate-400">Note du restaurant</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`w-6 h-6 ${
                          i < selectedExperience.rating
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-slate-600"
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-xl font-bold text-white">{selectedExperience.rating}/5</span>
                </div>
                {selectedExperience.comment && (
                  <p className="text-sm text-slate-300 text-center mt-2">{selectedExperience.comment}</p>
                )}
                {selectedExperience.visited_at && (
                  <p className="text-xs text-slate-400 mt-1">{formatDate(selectedExperience.visited_at)}</p>
                )}
              </div>

              {/* Plats mangés */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">
                  Plats goûtés {experienceDishes.length > 0 && `(${experienceDishes.length})`}
                </h3>
                {loadingDishes ? (
                  <div className="flex justify-center py-8">
                    <Spinner />
                  </div>
                ) : experienceDishes.length > 0 ? (
                  <div className="space-y-3">
                    {experienceDishes.map((dish) => (
                      <div
                        key={dish.dish_id}
                        className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 p-3"
                      >
                        {dish.image_url ? (
                          <div className="relative h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden">
                            <Image
                              src={dish.image_url}
                              alt={dish.dish_name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-slate-700/50 flex items-center justify-center">
                            <span className="text-xs text-slate-400">?</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-white truncate">{dish.dish_name}</h4>
                          <div className="flex items-center gap-1 mt-1">
                            {[...Array(5)].map((_, i) => (
                              <svg
                                key={i}
                                className={`w-4 h-4 ${
                                  i < dish.rating
                                    ? "text-yellow-400 fill-yellow-400"
                                    : "text-slate-600"
                                }`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                            <span className="text-xs text-slate-400 ml-1">{dish.rating}/5</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">Aucun plat noté pour cette expérience</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

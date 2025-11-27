"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import {
  getCurrentUserProfile,
  UserProfile,
  updateAvatar,
  checkUsernameAvailability,
  updateUsername,
} from "@/lib/profile";
import Spinner from "@/components/Spinner";

type ProfileRestaurantSummary = {
  restaurantId: string;
  restaurantName: string;
  slug: string | null;
  logoUrl: string | null;
  visitsCount: number;
  avgRating: number;
};

type ProfileExperience = {
  id: string;
  restaurantId: string | null;
  restaurantName: string;
  restaurantSlug: string | null;
  restaurantLogoUrl: string | null;
  rating: number;
  comment: string | null;
  visitedAt: string | null;
  createdAt: string;
  dishes: {
    dishId: string | null;
    dishName: string;
    rating: number;
    imageUrl: string | null;
  }[];
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [restaurantsSummary, setRestaurantsSummary] = useState<
    ProfileRestaurantSummary[]
  >([]);
  const [experiences, setExperiences] = useState<ProfileExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  // States pour l'édition du username
  const [username, setUsername] = useState("");
  const [initialUsername, setInitialUsername] = useState<string | null>(null);
  const [isSubmittingUsername, setIsSubmittingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setError(null);
        setLoading(true);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("[Profile] getUser error", userError);
          setError("Impossible de récupérer ton profil.");
          setLoading(false);
          return;
        }

        if (!user) {
          setUser(null);
          setLoading(false);
          return;
        }

        setUser(user);

        // Charger le profil (username)
        const { profile: userProfile, error: profileError } =
          await getCurrentUserProfile();
        if (profileError) {
          console.error("[Profile] load profile error", profileError);
          // Ne bloquer pas le chargement si le profil n'existe pas encore
        } else {
          setProfile(userProfile);
          // Initialiser le username pour l'édition
          if (userProfile?.username) {
            setUsername(userProfile.username);
            setInitialUsername(userProfile.username);
          } else {
            setUsername("");
            setInitialUsername(null);
          }
        }

        // 1) Charger tous les logs
        const { data: logsData, error: logsError } = await supabase
          .from("fastfood_logs")
          .select("id, restaurant_id, restaurant_name, rating, comment, visited_at, created_at")
          .eq("user_id", user.id)
          .order("visited_at", { ascending: false });

        if (logsError) {
          console.error("[Profile] logs error", logsError);
          setError("Erreur lors du chargement de tes expériences.");
          setLoading(false);
          return;
        }

        const logs = logsData || [];

        // 2) Récupérer les IDs de restaurants uniques
        const restaurantIds = Array.from(
          new Set(
            logs
              .map((log) => log.restaurant_id)
              .filter((id): id is string => Boolean(id))
          )
        );

        // 3) Charger les infos des restaurants (slug, logo_url)
        let restaurantMap: Record<
          string,
          { slug: string | null; logo_url: string | null; name: string }
        > = {};

        if (restaurantIds.length > 0) {
          const { data: restaurantsData, error: restaurantsError } = await supabase
            .from("restaurants")
            .select("id, slug, logo_url, name")
            .in("id", restaurantIds);

          if (restaurantsError) {
            console.error("[Profile] restaurants error", restaurantsError);
          } else {
            (restaurantsData || []).forEach((restaurant) => {
              restaurantMap[restaurant.id] = {
                slug: restaurant.slug,
                logo_url: restaurant.logo_url,
                name: restaurant.name,
              };
            });
          }
        }

        // 4) Construire le résumé des enseignes
        const grouped = new Map<
          string,
          {
            name: string;
            visits: number;
            totalRating: number;
            countRatings: number;
            restaurantId: string | null;
          }
        >();

        logs.forEach((log) => {
          const key = log.restaurant_id ?? `custom-${log.restaurant_name}`;
          if (!grouped.has(key)) {
            grouped.set(key, {
              name: log.restaurant_name,
              visits: 0,
              totalRating: 0,
              countRatings: 0,
              restaurantId: log.restaurant_id,
            });
          }

          const entry = grouped.get(key)!;
          entry.visits += 1;
          if (log.rating !== null && log.rating !== undefined) {
            entry.totalRating += log.rating;
            entry.countRatings += 1;
          }
        });

        const summaryData: ProfileRestaurantSummary[] = Array.from(
          grouped.entries()
        ).map(([key, value]) => {
          const restaurantInfo = value.restaurantId
            ? restaurantMap[value.restaurantId]
            : null;
          return {
            restaurantId: value.restaurantId ?? key,
            restaurantName: value.name,
            slug: restaurantInfo?.slug ?? null,
            logoUrl: restaurantInfo?.logo_url ?? null,
            visitsCount: value.visits,
            avgRating:
              value.countRatings > 0
                ? Number((value.totalRating / value.countRatings).toFixed(1))
                : 0,
          };
        });

        setRestaurantsSummary(summaryData);

        // 5) Charger les plats notés (fastfood_log_dishes)
        const logIds = logs.map((log) => log.id);
        let dishLogsMap: Record<
          string,
          Array<{
            dish_id: string | null;
            dish_name: string;
            rating: number;
          }>
        > = {};

        if (logIds.length > 0) {
          const { data: dishLogsData, error: dishLogsError } = await supabase
            .from("fastfood_log_dishes")
            .select("log_id, dish_id, dish_name, rating")
            .in("log_id", logIds);

          if (dishLogsError) {
            console.error("[Profile] dishLogs error", dishLogsError);
          } else {
            (dishLogsData || []).forEach((dishLog) => {
              if (!dishLogsMap[dishLog.log_id]) {
                dishLogsMap[dishLog.log_id] = [];
              }
              dishLogsMap[dishLog.log_id].push({
                dish_id: dishLog.dish_id,
                dish_name: dishLog.dish_name,
                rating: dishLog.rating,
              });
            });
          }
        }

        // 6) Charger les images des plats
        const dishIds = Array.from(
          new Set(
            Object.values(dishLogsMap)
              .flat()
              .map((d) => d.dish_id)
              .filter((id): id is string => Boolean(id))
          )
        );

        let dishImagesMap: Record<string, string | null> = {};

        if (dishIds.length > 0) {
          const { data: dishesData, error: dishesError } = await supabase
            .from("dishes")
            .select("id, image_url")
            .in("id", dishIds);

          if (dishesError) {
            console.error("[Profile] dishes error", dishesError);
          } else {
            (dishesData || []).forEach((dish) => {
              dishImagesMap[dish.id] = dish.image_url;
            });
          }
        }

        // 7) Construire les expériences complètes
        const experiencesData: ProfileExperience[] = logs.map((log) => {
          const restaurantInfo = log.restaurant_id
            ? restaurantMap[log.restaurant_id]
            : null;
          const dishLogs = dishLogsMap[log.id] || [];

          return {
            id: log.id,
            restaurantId: log.restaurant_id,
            restaurantName: log.restaurant_name,
            restaurantSlug: restaurantInfo?.slug ?? null,
            restaurantLogoUrl: restaurantInfo?.logo_url ?? null,
            rating: log.rating ?? 0,
            comment: log.comment,
            visitedAt: log.visited_at,
            createdAt: log.created_at,
            dishes: dishLogs.map((dishLog) => ({
              dishId: dishLog.dish_id,
              dishName: dishLog.dish_name,
              rating: dishLog.rating,
              imageUrl: dishLog.dish_id
                ? dishImagesMap[dishLog.dish_id] ?? null
                : null,
            })),
          };
        });

        setExperiences(experiencesData);
      } catch (err) {
        console.error("[Profile] unexpected", err);
        setError("Erreur inattendue lors du chargement de ton profil.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // Recharger le profil quand on revient sur la page (si username a changé via réglages)
  useEffect(() => {
    const reloadProfile = async () => {
      const { profile: updatedProfile } = await getCurrentUserProfile();
      if (updatedProfile) {
        setProfile(updatedProfile);
        // Mettre à jour aussi le username pour l'édition
        if (updatedProfile.username) {
          setUsername(updatedProfile.username);
          setInitialUsername(updatedProfile.username);
        } else {
          setUsername("");
          setInitialUsername(null);
        }
      }
    };

    // Recharger au focus de la page
    const handleFocus = () => reloadProfile();
    window.addEventListener("focus", handleFocus);

    // Recharger aussi au mount si on arrive depuis settings
    reloadProfile();

    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-50 px-4 py-10">
        <div className="max-w-md mx-auto text-center space-y-4">
          <p className="text-sm text-slate-300">
            Tu dois être connecté pour voir ton profil.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-bitebox px-4 py-2 text-sm font-semibold text-white shadow hover:bg-bitebox-dark transition"
          >
            Me connecter
          </Link>
        </div>
      </div>
    );
  }

  // Calculer les stats
  const restaurantsCount = restaurantsSummary.length;
  const totalExperiences = experiences.length;
  const avgRating =
    experiences.length > 0
      ? (
          experiences.reduce((sum, exp) => sum + exp.rating, 0) / experiences.length
        ).toFixed(1)
      : "0.0";

  // Fonction pour obtenir l'initiale
  const getInitial = (value?: string | null): string => {
    if (!value || value.trim().length === 0) return "?";
    return value.trim().charAt(0).toUpperCase();
  };

  // Fonction pour formater la date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Date inconnue";
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Calculer le nom d'affichage et la source de l'initiale
  const displayName =
    profile?.username && profile.username.trim().length > 0
      ? profile.username
      : user?.email ?? "Utilisateur BiteBox";
  const initialSource = profile?.username || user?.email;

  // Gérer la sélection d'avatar
  const handleAvatarSelect = async (avatarUrl: string) => {
    if (isUpdatingAvatar) return;

    setIsUpdatingAvatar(true);
    setAvatarError(null);

    try {
      const { profile: updatedProfile, error } = await updateAvatar(avatarUrl);

      if (error) {
        console.error("[Profile] update avatar error:", error);
        setAvatarError("Impossible de mettre à jour l'avatar. Réessaie plus tard.");
        setIsUpdatingAvatar(false);
        return;
      }

      if (updatedProfile) {
        setProfile(updatedProfile);
        router.refresh();
      }
    } catch (err) {
      console.error("[Profile] unexpected avatar error:", err);
      setAvatarError("Erreur inattendue lors de la mise à jour de l'avatar.");
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const AVAILABLE_AVATARS = [
    "/avatar/avatar-bleu.png",
    "/avatar/avatar-orange.png",
    "/avatar/avatar-rouge.png",
    "/avatar/avatar-vert.png",
    "/avatar/avatar-violet.png",
  ];

  const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,20}$/;

  // Validation du username
  const validateUsername = (value: string): string | null => {
    if (!value.trim()) {
      return "Le nom d'utilisateur est obligatoire.";
    }
    if (value.length < 3 || value.length > 20) {
      return "Le nom d'utilisateur doit contenir entre 3 et 20 caractères.";
    }
    if (!USERNAME_REGEX.test(value)) {
      return "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, underscores et points.";
    }
    return null;
  };

  // Gérer la soumission du username
  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError(null);
    setUsernameSuccess(null);

    const validationError = validateUsername(username);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    if (username === initialUsername) {
      setUsernameSuccess("Aucune modification.");
      return;
    }

    if (!user?.id) {
      setUsernameError("Tu dois être connecté.");
      return;
    }

    setIsSubmittingUsername(true);

    try {
      const { available, error: checkError } = await checkUsernameAvailability(
        username,
        user.id
      );

      if (checkError) {
        console.warn("[Profile] check username error (continuing anyway):", checkError);
      }

      if (!checkError && !available) {
        setUsernameError("Ce nom d'utilisateur est déjà pris.");
        setIsSubmittingUsername(false);
        return;
      }

      const { profile: updatedProfile, error } = await updateUsername(username);

      if (error) {
        console.error("[Profile] update username error:", error);
        let message = "Impossible de mettre à jour ton nom d'utilisateur. Réessaie plus tard.";
        if (error.code === "23505" || error.code === "PGRST116") {
          message = "Ce nom d'utilisateur est déjà pris. Choisis-en un autre.";
        } else if (
          error.message?.toLowerCase().includes("row-level security") ||
          error.message?.toLowerCase().includes("policy") ||
          error.code === "42501"
        ) {
          message = "Tu n'as pas les droits pour modifier ce profil. Vérifie que tu es bien connecté.";
        }
        setUsernameError(message);
        setIsSubmittingUsername(false);
        return;
      }

      if (updatedProfile) {
        setProfile(updatedProfile);
        setInitialUsername(username);
        setUsernameSuccess("Nom d'utilisateur mis à jour ✅");
        router.refresh();
      }
    } catch (err) {
      console.error("[Profile] unexpected username error:", err);
      setUsernameError("Erreur inattendue. Réessaie plus tard.");
    } finally {
      setIsSubmittingUsername(false);
    }
  };

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#020617]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-28 pt-6">
        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Header profil */}
        <section className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-5 flex-1 min-w-0">
            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full">
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt="Avatar"
                  fill
                  className="object-cover object-center scale-150"
                  style={{ minWidth: '100%', minHeight: '100%' }}
                />
              ) : (
                <Image
                  src="/avatar/avatar-violet.png"
                  alt="Avatar par défaut"
                  fill
                  className="object-cover object-center scale-150"
                  style={{ minWidth: '100%', minHeight: '100%' }}
                />
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-lg font-semibold text-white truncate">
                {displayName}
              </span>
              {user?.email && (
                <span className="text-xs text-slate-400 truncate">
                  {user.email}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Stats rapides */}
        <section className="grid grid-cols-3 gap-3 rounded-2xl bg-[#020617] border border-white/5 px-4 py-4">
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold text-white">
              {restaurantsCount}
            </span>
            <span className="text-[11px] text-slate-400 text-center">
              Restos testés
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold text-white">
              {totalExperiences}
            </span>
            <span className="text-[11px] text-slate-400 text-center">
              Expériences
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold text-white">
              {avgRating}
            </span>
            <span className="text-[11px] text-slate-400 text-center">
              Note moyenne
            </span>
          </div>
        </section>


        {/* Restaurants que j'ai testés */}
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Restaurants que j'ai testés
            </h2>
            <p className="text-xs text-slate-400">
              Ton top des spots où tu as déjà mis une note.
            </p>
          </div>

          {restaurantsSummary.length === 0 ? (
            <p className="text-sm text-slate-400">
              Tu n'as pas encore testé de restaurant.
            </p>
          ) : (
            <div className="-mx-4 overflow-x-auto pb-2">
              <div className="flex gap-3 px-4">
                {restaurantsSummary.map((r) => (
                  <Link
                    key={r.restaurantId}
                    href={r.slug ? `/restaurants/${r.slug}` : "#"}
                    className={`w-48 flex-shrink-0 overflow-hidden rounded-2xl bg-[#020617] border border-white/5 transition hover:border-bitebox/40 ${
                      !r.slug ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    <div className="h-24 w-full overflow-hidden bg-black/60 flex items-center justify-center">
                      {r.logoUrl ? (
                        <img
                          src={r.logoUrl}
                          alt={r.restaurantName}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-500">
                          Pas de logo
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 px-3 py-2">
                      <p className="truncate text-sm font-medium text-white">
                        {r.restaurantName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {r.avgRating.toFixed(1)} / 5 · {r.visitsCount}{" "}
                        visite{r.visitsCount > 1 ? "s" : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Mes expériences */}
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Mes expériences</h2>
            <p className="text-xs text-slate-400">
              Retrouve toutes tes notes, par date.
            </p>
          </div>

          {experiences.length === 0 ? (
            <p className="text-sm text-slate-400">
              Tu n'as pas encore enregistré d'expérience.
            </p>
          ) : (
            <div className="space-y-3">
              {experiences.map((exp) => (
                <div
                  key={exp.id}
                  className="rounded-2xl bg-[#020617] border border-white/5 px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                        {exp.restaurantLogoUrl ? (
                          <img
                            src={exp.restaurantLogoUrl}
                            alt={exp.restaurantName}
                            className="h-10 w-10 object-cover"
                          />
                        ) : (
                          <span className="text-xs text-slate-300">
                            {exp.restaurantName.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        {exp.restaurantSlug ? (
                          <Link
                            href={`/restaurants/${exp.restaurantSlug}`}
                            className="text-sm font-medium text-white hover:text-bitebox-light truncate"
                          >
                            {exp.restaurantName}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-white truncate">
                            {exp.restaurantName}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          {formatDate(exp.visitedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex justify-end mb-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={
                              exp.rating >= star
                                ? "text-yellow-400"
                                : "text-slate-700"
                            }
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-slate-400">
                        {exp.rating} / 5
                      </span>
                    </div>
                  </div>

                  {/* Commentaire */}
                  {exp.comment && (
                    <p className="text-xs text-slate-300 mt-3 px-1">
                      {exp.comment}
                    </p>
                  )}

                  {/* Plats goûtés */}
                  {exp.dishes.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-medium text-slate-300">
                        Plats goûtés :
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {exp.dishes.map((dish, idx) => (
                          <div
                            key={dish.dishId ?? `${exp.id}-dish-${idx}`}
                            className="rounded-lg bg-slate-900/50 border border-slate-800/50 p-2"
                          >
                            <p className="text-xs font-medium text-slate-100 truncate mb-1">
                              {dish.dishName}
                            </p>
                            <div className="flex items-center gap-1">
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span
                                    key={star}
                                    className={
                                      dish.rating >= star
                                        ? "text-yellow-400 text-[10px]"
                                        : "text-slate-700 text-[10px]"
                                    }
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {dish.rating}/5
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section Paramètres du compte */}
        <section className="mt-8 mb-6 rounded-2xl bg-[#020617] border border-white/5 p-5 w-full overflow-x-hidden">
          <h2 className="text-lg font-semibold text-white mb-1">
            Paramètres du compte
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Personnalise ton profil et tes préférences.
          </p>

          <div className="space-y-8">
            {/* Édition du nom d'utilisateur */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-white mb-1">
                  Nom d'utilisateur
                </h3>
                <p className="text-xs text-slate-400">
                  Choisis un nom unique pour ton profil.
                </p>
              </div>
              <form onSubmit={handleUsernameSubmit} className="space-y-3">
                <div className="space-y-1">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setUsernameError(null);
                      setUsernameSuccess(null);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-bitebox focus:outline-none focus:ring-1 focus:ring-bitebox transition"
                    placeholder="Ex : alex_bitebox"
                    maxLength={20}
                  />
                  {usernameError && (
                    <p className="text-xs text-red-400">{usernameError}</p>
                  )}
                  {usernameSuccess && (
                    <p className="text-xs text-emerald-400">{usernameSuccess}</p>
                  )}
                  {!usernameError && !usernameSuccess && (
                    <p className="text-xs text-slate-500">
                      3 à 20 caractères (lettres, chiffres, _ et .)
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingUsername || !username.trim()}
                  className="w-full rounded-xl bg-bitebox px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {isSubmittingUsername ? (
                    <>
                      <Spinner size="sm" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    "Enregistrer"
                  )}
                </button>
              </form>
            </div>

            {/* Sélection de l'avatar */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-white mb-1">
                  Avatar
                </h3>
                <p className="text-xs text-slate-400">
                  Choisis ta couleur de profil.
                </p>
              </div>

              {avatarError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2">
                  <p className="text-xs text-red-400">{avatarError}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {AVAILABLE_AVATARS.map((avatarUrl) => {
                  const isSelected = profile?.avatar_url === avatarUrl;
                  return (
                    <button
                      key={avatarUrl}
                      onClick={() => handleAvatarSelect(avatarUrl)}
                      disabled={isUpdatingAvatar}
                      className={`
                        relative h-16 w-16 sm:h-14 sm:w-14 rounded-full overflow-hidden border-2 transition-all
                        ${
                          isSelected
                            ? "ring-2 ring-bitebox shadow-lg shadow-bitebox/50 border-bitebox"
                            : "border-white/10 hover:border-white/30"
                        }
                        ${isUpdatingAvatar ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                      `}
                      aria-label={`Sélectionner l'avatar ${avatarUrl}`}
                    >
                      <Image
                        src={avatarUrl}
                        alt={`Avatar ${avatarUrl}`}
                        fill
                        className="object-cover"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="h-5 w-5 rounded-full bg-bitebox flex items-center justify-center">
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {isUpdatingAvatar && (
                <div className="flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  <span className="text-xs text-slate-400">
                    Mise à jour de l'avatar...
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

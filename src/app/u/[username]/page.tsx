import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { getAvatarTheme, hexToRgba } from "@/lib/getAvatarTheme";
import { UserProfile } from "@/lib/profile";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client Supabase public pour les pages publiques
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type PublicProfileData = {
  profile: UserProfile;
  stats: {
    restaurantsCount: number;
    totalExperiences: number;
    avgRating: number;
  };
  favoriteRestaurants: Array<{
    id: string;
    name: string;
    slug: string | null;
    logo_url: string | null;
  }>;
  lastExperience: {
    id: string;
    restaurant_name: string;
    restaurant_logo_url: string | null;
    rating: number;
    comment: string | null;
    visited_at: string | null;
    created_at: string;
  } | null;
};

async function getPublicProfile(username: string): Promise<PublicProfileData | null> {
  // 1. Récupérer le profil par username
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .eq("is_public", true)
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  const userId = profile.id;

  // 2. Calculer les stats
  const { data: logs, error: logsError } = await supabase
    .from("fastfood_logs")
    .select("restaurant_id, rating")
    .eq("user_id", userId);

  if (logsError) {
    console.error("[PublicProfile] Error loading logs:", logsError);
  }

  const logsData = logs || [];
  
  // Restos testés : count distinct restaurant_id
  const uniqueRestaurantIds = new Set(
    logsData.map((log) => log.restaurant_id).filter((id): id is string => Boolean(id))
  );
  const restaurantsCount = uniqueRestaurantIds.size;
  
  // Expériences : count total
  const totalExperiences = logsData.length;
  
  // Note moyenne : avg(rating)
  const ratings = logsData
    .map((log) => log.rating)
    .filter((rating): rating is number => typeof rating === "number");
  const avgRating = ratings.length > 0
    ? Number((ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1))
    : 0;

  // 3. Récupérer les 3 restaurants favoris
  const favoriteIds = (profile.favorite_restaurant_ids || []).slice(0, 3);
  let favoriteRestaurants: PublicProfileData["favoriteRestaurants"] = [];

  if (favoriteIds.length > 0) {
    const { data: restaurantsData } = await supabase
      .from("restaurants")
      .select("id, name, slug, logo_url")
      .in("id", favoriteIds);

    if (restaurantsData) {
      // Préserver l'ordre des favoris
      favoriteRestaurants = favoriteIds
        .map((id) => restaurantsData.find((r) => r.id === id))
        .filter((r): r is { id: string; name: string; slug: string | null; logo_url: string | null } => Boolean(r));
    }
  }

  // 4. Récupérer la dernière expérience
  const { data: lastLog, error: lastLogError } = await supabase
    .from("fastfood_logs")
    .select("id, restaurant_id, restaurant_name, rating, comment, visited_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let lastExperience: PublicProfileData["lastExperience"] = null;

  if (lastLog && !lastLogError) {
    // Récupérer le logo du restaurant si restaurant_id existe
    let restaurantLogoUrl: string | null = null;
    if (lastLog.restaurant_id) {
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("logo_url")
        .eq("id", lastLog.restaurant_id)
        .maybeSingle();
      restaurantLogoUrl = restaurant?.logo_url || null;
    }

    lastExperience = {
      id: lastLog.id,
      restaurant_name: lastLog.restaurant_name || "Restaurant inconnu",
      restaurant_logo_url: restaurantLogoUrl,
      rating: lastLog.rating || 0,
      comment: lastLog.comment,
      visited_at: lastLog.visited_at,
      created_at: lastLog.created_at,
    };
  }

  return {
    profile: profile as UserProfile,
    stats: {
      restaurantsCount,
      totalExperiences,
      avgRating,
    },
    favoriteRestaurants,
    lastExperience,
  };
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Date inconnue";
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function truncateComment(comment: string | null, maxLength: number = 150): string {
  if (!comment) return "";
  if (comment.length <= maxLength) return comment;
  return comment.slice(0, maxLength).trim() + "...";
}

export default async function PublicProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const username = decodeURIComponent(params.username);
  const data = await getPublicProfile(username);

  if (!data) {
    notFound();
  }

  const { profile, stats, favoriteRestaurants, lastExperience } = data;
  const theme = getAvatarTheme(profile.avatar_url);
  const themeColorGlow = hexToRgba(theme.color, 0.33);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#020617]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-28 pt-6">
        {/* Header profil */}
        <section className="flex items-center gap-5">
          <div
            className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full"
            style={{ boxShadow: `0 0 20px ${themeColorGlow}` }}
          >
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.username || "Avatar"}
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
            <h1 className="text-lg font-semibold text-white truncate">
              @{profile.username}
            </h1>
          </div>
        </section>

        {/* Stats rapides */}
        <section className="grid grid-cols-3 gap-3 rounded-xl bg-[#0F0F1A] border border-white/5 shadow-md shadow-black/20 px-4 py-4">
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold text-white">
              {stats.restaurantsCount}
            </span>
            <span className="text-[11px] text-slate-400 text-center">
              Restos testés
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold text-white">
              {stats.totalExperiences}
            </span>
            <span className="text-[11px] text-slate-400 text-center">
              Expériences
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold text-white">
              {stats.avgRating.toFixed(1)}
            </span>
            <span className="text-[11px] text-slate-400 text-center">
              Note moyenne
            </span>
          </div>
        </section>

        {/* 3 enseignes favorites */}
        {favoriteRestaurants.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white">
              3 enseignes favorites
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {favoriteRestaurants.map((restaurant) => (
                <Link
                  key={restaurant.id}
                  href={restaurant.slug ? `/restaurants/${restaurant.slug}` : `#`}
                  className="flex flex-col items-center gap-2 rounded-xl bg-[#0F0F1A] border border-white/5 p-3 hover:bg-[#151520] transition-colors"
                >
                  {restaurant.logo_url ? (
                    <div className="relative h-12 w-12 rounded overflow-hidden">
                      <Image
                        src={restaurant.logo_url}
                        alt={restaurant.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded bg-slate-700/50 flex items-center justify-center">
                      <span className="text-xs text-slate-400">?</span>
                    </div>
                  )}
                  <span className="text-xs text-white text-center truncate w-full">
                    {restaurant.name}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Dernière expérience */}
        {lastExperience && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white">
              Dernière expérience
            </h2>
            <div className="rounded-xl bg-[#0F0F1A] border border-white/5 p-4">
              <div className="flex items-start gap-3">
                {lastExperience.restaurant_logo_url && (
                  <div className="relative h-12 w-12 flex-shrink-0 rounded overflow-hidden">
                    <Image
                      src={lastExperience.restaurant_logo_url}
                      alt={lastExperience.restaurant_name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-base font-semibold text-white truncate">
                      {lastExperience.restaurant_name}
                    </h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${
                            i < lastExperience.rating
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
                  <p className="text-xs text-slate-400 mb-2">
                    {formatDate(lastExperience.visited_at || lastExperience.created_at)}
                  </p>
                  {lastExperience.comment && (
                    <p className="text-sm text-slate-300">
                      {truncateComment(lastExperience.comment)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}


import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { getAvatarThemeFromVariant } from "@/lib/avatarTheme";
import { getAvatarUrl, getProfileAccentColor, hexToRgba } from "@/lib/avatarUtils";
import { UserProfile } from "@/lib/profile";
import ExperienceGrid from "@/components/ExperienceGrid";

// Désactiver le cache pour cette page (données toujours fraîches)
export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client Supabase public pour les pages publiques
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type RestaurantLite = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
};

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

type PublicProfileData = {
  profile: UserProfile;
  stats: {
    restaurantsCount: number;
    totalExperiences: number;
    avgRating: number;
  };
  favoriteRestaurants: Array<RestaurantLite | null>; // Peut contenir null pour préserver les positions
  experiences: Array<Experience>;
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
      .select("id, username, display_name, is_public, favorite_restaurant_ids, avatar_url, avatar_variant, avatar_type, avatar_preset, accent_color, bio, updated_at")
      .eq("username", username.toLowerCase())
      .eq("is_public", true)
      .maybeSingle();
    
    // Log pour confirmer les données récupérées
    if (profile) {
      console.log("[PublicProfile] profile fetched from DB:", profile.username, "avatar_variant:", profile.avatar_variant, "display_name:", profile.display_name, "bio:", profile.bio);
    }

  if (profileError || !profile) {
    return null;
  }

  // S'assurer que le profil a les types corrects avec display_name, bio et avatar_variant
  // Normaliser les valeurs vides (trim) pour display_name et bio
  const typedProfile: UserProfile = {
    id: profile.id,
    username: profile.username,
    avatar_url: profile.avatar_url,
    avatar_variant: profile.avatar_variant || null,
    avatar_type: profile.avatar_type || 'preset',
    avatar_preset: profile.avatar_preset || null,
    accent_color: profile.accent_color || null,
    display_name: (profile.display_name && profile.display_name.trim().length > 0) ? profile.display_name.trim() : null,
    bio: (profile.bio && profile.bio.trim().length > 0) ? profile.bio.trim() : null,
    is_public: profile.is_public ?? false,
    favorite_restaurant_ids: profile.favorite_restaurant_ids || null,
    updated_at: profile.updated_at || null,
  };
  
  // Log pour confirmer avatar_variant
  console.log("[PublicProfile] username", username, "avatar_variant", typedProfile.avatar_variant);

  const userId = typedProfile.id;

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
    ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 100) / 100
    : 0;

  // 3. Récupérer les 3 restaurants favoris en préservant les positions
  // Normaliser favorite_restaurant_ids en préservant les positions (peut contenir null)
  function normalizeFavoriteIdsWithPositions(raw: unknown): (string | null)[] {
    if (Array.isArray(raw)) {
      // Préserver les positions : prendre les 3 premiers éléments (peuvent être null)
      const ids: (string | null)[] = [];
      for (let i = 0; i < 3; i++) {
        const id = raw[i];
        ids.push(id && typeof id === "string" ? id : null);
      }
      return ids;
    }
    if (typeof raw === "string") {
      // Ancien format : string, le convertir en tableau
      const cleaned = raw.replace(/^{|}$/g, "");
      const ids = cleaned
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
        .slice(0, 3);
      // Remplir jusqu'à 3 éléments avec null si nécessaire
      const result: (string | null)[] = [];
      for (let i = 0; i < 3; i++) {
        result.push(i < ids.length ? ids[i] : null);
      }
      return result;
    }
    return [null, null, null];
  }

  const favoriteIds = normalizeFavoriteIdsWithPositions(profile.favorite_restaurant_ids);
  
  // Filtrer les IDs valides (non null) pour la requête
  const validIds = favoriteIds.filter((id): id is string => 
    id !== null && typeof id === 'string' && id.length > 0
  );
  
  // Créer un tableau de 3 éléments pour préserver les positions
  let favoriteRestaurants: (RestaurantLite | null)[] = [null, null, null];

  if (validIds.length > 0) {
    const { data: restaurantsData, error: restaurantsError } = await supabase
      .from("restaurants")
      .select("id, name, slug, logo_url")
      .in("id", validIds);

    if (restaurantsError) {
      console.error("[PublicProfile] Error loading favorite restaurants:", restaurantsError);
      // Ne pas casser la page si la requête échoue
    } else if (restaurantsData && restaurantsData.length > 0) {
      const typedRestaurantsData = restaurantsData as RestaurantLite[];
      // Créer un Map pour un accès rapide
      const restaurantMap = new Map(typedRestaurantsData.map(r => [r.id, r]));
      // Préserver les positions exactes : mapper selon l'ordre original
      favoriteIds.forEach((id, index) => {
        if (id && typeof id === 'string' && restaurantMap.has(id) && index < 3) {
          favoriteRestaurants[index] = restaurantMap.get(id)!;
        }
      });
    }
  }
  
  // Convertir en RestaurantLite[] pour le type (sans les null pour l'affichage)
  // Mais on va utiliser favoriteRestaurants directement dans le JSX avec les positions

  // 4. Charger toutes les expériences avec leurs images de plats
  const { data: allLogs } = await supabase
    .from("fastfood_logs")
    .select("id, restaurant_id, restaurant_name, rating, comment, visited_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  let experiences: PublicProfileData["experiences"] = [];

  if (allLogs && allLogs.length > 0) {
    // Récupérer les logos et slugs des restaurants, et les images des plats depuis dish_ratings
    experiences = await Promise.all(
      allLogs.map(async (log) => {
        let restaurantLogoUrl: string | null = null;
        let restaurantSlug: string | null = null;
        let dishImageUrl: string | null = null;

        if (log.restaurant_id) {
          const { data: restaurant } = await supabase
            .from("restaurants")
            .select("logo_url, slug")
            .eq("id", log.restaurant_id)
            .maybeSingle();
          restaurantLogoUrl = restaurant?.logo_url || null;
          restaurantSlug = restaurant?.slug || null;
        }

        // Récupérer une image de plat depuis dish_ratings pour ce restaurant
        if (log.restaurant_id) {
          const { data: dishRatings } = await supabase
            .from("dish_ratings")
            .select("dish_id")
            .eq("user_id", userId)
            .eq("restaurant_id", log.restaurant_id)
            .limit(1);
          
          if (dishRatings && dishRatings.length > 0 && dishRatings[0].dish_id) {
            const { data: dish } = await supabase
              .from("dishes")
              .select("image_url")
              .eq("id", dishRatings[0].dish_id)
              .maybeSingle();
            dishImageUrl = dish?.image_url || null;
          }
        }

        return {
          id: log.id,
          restaurant_id: log.restaurant_id,
          restaurant_slug: restaurantSlug,
          restaurant_name: log.restaurant_name || "Restaurant inconnu",
          restaurant_logo_url: restaurantLogoUrl,
          rating: log.rating || 0,
          comment: log.comment,
          visited_at: log.visited_at,
          created_at: log.created_at,
          dish_image_url: dishImageUrl,
        };
      })
    );
  }

  // 5. Récupérer la dernière expérience
  const lastLog = allLogs && allLogs.length > 0 ? allLogs[0] : null;
  let lastExperience: PublicProfileData["lastExperience"] = null;

  if (lastLog) {
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
    profile: typedProfile,
    stats: {
      restaurantsCount,
      totalExperiences,
      avgRating,
    },
    favoriteRestaurants,
    experiences,
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

  const { profile, stats, favoriteRestaurants, experiences, lastExperience } = data;
  
  // Obtenir la couleur d'accent et l'URL de l'avatar (nouveau système)
  const accentColor = getProfileAccentColor(profile);
  const accentGlow = hexToRgba(accentColor, 0.33);
  const avatarUrl = getAvatarUrl(profile);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#020617]">
      <div className="mx-auto flex w-full max-w-xl flex-col px-4 pb-44 pt-6">
        {/* Header profil style TikTok */}
        <section className="px-4 pt-0 pb-6">
          {/* Avatar centré en haut */}
          <div className="flex justify-center mb-4">
            <div
              className="relative h-28 w-28 overflow-hidden rounded-full border-2 shadow-lg"
              style={{ boxShadow: `0 0 20px ${accentGlow}`, borderColor: accentColor }}
            >
              <Image
                src={avatarUrl}
                alt={profile.username || "Avatar"}
                fill
                className="object-cover object-center"
                style={{ minWidth: '100%', minHeight: '100%' }}
              />
            </div>
          </div>

          {/* Nom d'utilisateur centré en dessous de l'avatar */}
          <div className="flex flex-col items-center mb-6">
            {profile.display_name && profile.display_name.trim().length > 0 ? (
              <>
                <h1 className="text-base font-bold text-white mb-1.5">
                  {profile.display_name}
                </h1>
                <span className="text-sm text-slate-400 font-medium">
                  @{profile.username}
                </span>
              </>
            ) : (
              <h1 className="text-base font-bold text-white">
                @{profile.username}
              </h1>
            )}
            {profile.bio && profile.bio.trim().length > 0 && (
              <p className="text-sm text-slate-300 mt-3 leading-relaxed text-center max-w-sm px-4">
                {profile.bio}
              </p>
            )}
          </div>

          {/* Stats alignées en dessous avec séparateurs */}
          <div className="flex justify-center gap-6 mb-6 px-4">
            <div className="flex flex-col items-center flex-1">
              <span className="text-xl font-bold text-white mb-0.5">
                {stats.totalExperiences}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Expériences
              </span>
            </div>
            <div className="h-12 w-px" style={{ backgroundColor: accentColor }}></div>
            <div className="flex flex-col items-center flex-1">
              <span className="text-xl font-bold text-white mb-0.5">
                {stats.restaurantsCount}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Restos
              </span>
            </div>
            <div className="h-12 w-px" style={{ backgroundColor: accentColor }}></div>
            <div className="flex flex-col items-center flex-1">
              <span className="text-xl font-bold text-white mb-0.5">
                {stats.avgRating.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Note moy.
              </span>
            </div>
          </div>
        </section>

        {/* Son podium BiteBox */}
        <section className="px-4 py-4">
          <h2 className="text-base font-bold text-white mb-6 border-b-2 pb-2" style={{ borderBottomColor: accentColor }}>Son podium BiteBox</h2>
          <div className="flex items-center justify-between gap-3 w-full">
            {/* 2ème place */}
            {favoriteRestaurants[1] ? (
              <Link
                href={favoriteRestaurants[1].slug ? `/restaurants/${favoriteRestaurants[1].slug}` : '#'}
                className="flex flex-col items-center gap-1.5 flex-1"
              >
                {favoriteRestaurants[1].logo_url ? (
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-slate-400/40">
                    <Image
                      src={favoriteRestaurants[1].logo_url}
                      alt={favoriteRestaurants[1].name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-700/50 flex items-center justify-center border-2 border-slate-400/40">
                    <span className="text-xs text-slate-400">?</span>
                  </div>
                )}
                <span className="text-xs text-slate-400 font-medium">#2</span>
              </Link>
            ) : (
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-700/50 flex items-center justify-center border-2 border-slate-400/40">
                  <span className="text-xs text-slate-400">+</span>
                </div>
                <span className="text-xs text-slate-400 font-medium">#2</span>
              </div>
            )}
            
            {/* 1ère place - Plus grande */}
            {favoriteRestaurants[0] ? (
              <Link
                href={favoriteRestaurants[0].slug ? `/restaurants/${favoriteRestaurants[0].slug}` : '#'}
                className="flex flex-col items-center gap-1.5 flex-1"
              >
                {favoriteRestaurants[0].logo_url ? (
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-yellow-500/60">
                    <Image
                      src={favoriteRestaurants[0].logo_url}
                      alt={favoriteRestaurants[0].name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-700/50 flex items-center justify-center border-2 border-yellow-500/60">
                    <span className="text-sm text-slate-400">?</span>
                  </div>
                )}
                <span className="text-xs text-yellow-500/80 font-medium">#1</span>
              </Link>
            ) : (
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-700/50 flex items-center justify-center border-2 border-yellow-500/60">
                  <span className="text-sm text-slate-400">+</span>
                </div>
                <span className="text-xs text-yellow-500/80 font-medium">#1</span>
              </div>
            )}
            
            {/* 3ème place */}
            {favoriteRestaurants[2] ? (
              <Link
                href={favoriteRestaurants[2].slug ? `/restaurants/${favoriteRestaurants[2].slug}` : '#'}
                className="flex flex-col items-center gap-1.5 flex-1"
              >
                {favoriteRestaurants[2].logo_url ? (
                  <div className="relative w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-amber-600/50">
                    <Image
                      src={favoriteRestaurants[2].logo_url}
                      alt={favoriteRestaurants[2].name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-full bg-slate-700/50 flex items-center justify-center border-2 border-amber-600/50">
                    <span className="text-[10px] text-slate-400">?</span>
                  </div>
                )}
                <span className="text-xs text-amber-600/70 font-medium">#3</span>
              </Link>
            ) : (
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-full bg-slate-700/50 flex items-center justify-center border-2 border-amber-600/50">
                  <span className="text-[10px] text-slate-400">+</span>
                </div>
                <span className="text-xs text-amber-600/70 font-medium">#3</span>
              </div>
            )}
          </div>
        </section>

        {/* Grille d'expériences style Instagram */}
        <ExperienceGrid experiences={experiences} title="Ses dernières expériences" accentColor={accentColor} />
      </div>
    </main>
  );
}


"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getAvatarThemeFromVariant } from "@/lib/avatarTheme";
import { useProfile } from "@/context/ProfileContext";
import { getMyProfileWithData, UserProfile } from "@/lib/profile";
import Spinner from "@/components/Spinner";

type PublicProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  avatar_variant?: string | null;
  favorite_restaurant_ids: string[] | null;
};

type MyProfileData = {
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

export default function SocialPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile: currentProfile } = useProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Mon profil (carte en haut)
  const [myProfileData, setMyProfileData] = useState<MyProfileData | null>(null);
  const [myProfileLoading, setMyProfileLoading] = useState(true);
  const [myProfileError, setMyProfileError] = useState<string | null>(null);

  // Debounce de 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Recherche des profils - toujours depuis Supabase (pas de cache)
  useEffect(() => {
    const searchProfiles = async () => {
      if (!debouncedQuery.trim()) {
        setProfiles([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Nettoyer la requête (enlever le @ si présent)
        const cleanQuery = debouncedQuery.trim().replace(/^@/, '');
        
        // Toujours faire une requête fraîche (pas de cache)
        const { data, error: searchError } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, avatar_variant, favorite_restaurant_ids")
          .eq("is_public", true)
          .ilike("username", `%${cleanQuery}%`)
          .not("username", "is", null)
          .limit(50);

        if (searchError) {
          console.error("[Social] search error", searchError);
          setError("Erreur lors de la recherche.");
          setProfiles([]);
        } else {
          // Si le profil connecté correspond à la recherche, utiliser les données du contexte à jour
          const profilesData = (data || []).map((profile) => {
            // Si c'est le profil connecté, utiliser les données du contexte (plus à jour)
            if (currentProfile && profile.id === currentProfile.id) {
              console.log("[Social] Using context profile for current user:", currentProfile.username, "avatar_variant:", currentProfile.avatar_variant);
              return {
                id: currentProfile.id,
                username: currentProfile.username,
                avatar_url: currentProfile.avatar_url,
                avatar_variant: currentProfile.avatar_variant || profile.avatar_variant,
                favorite_restaurant_ids: currentProfile.favorite_restaurant_ids,
              } as PublicProfile;
            }
            console.log("[Social] profile fetched from DB:", profile.username, "avatar_variant:", profile.avatar_variant);
            return profile as PublicProfile;
          });
          
          setProfiles(profilesData);
        }
      } catch (err) {
        console.error("[Social] unexpected error", err);
        setError("Une erreur inattendue s'est produite.");
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    };

    searchProfiles();
  }, [debouncedQuery, currentProfile?.id, currentProfile?.avatar_variant, currentProfile?.username]);

  // Recharger la recherche si on revient sur la page avec une recherche active
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Si la page redevient visible et qu'une recherche est active, la relancer
      if (!document.hidden && debouncedQuery.trim()) {
        console.log("[Social] Page visible again, re-fetching search results for:", debouncedQuery);
        // Déclencher une recherche fraîche en modifiant temporairement la query
        const currentQuery = searchQuery;
        setSearchQuery("");
        setTimeout(() => setSearchQuery(currentQuery), 10);
      }
    };

    const handleFocus = () => {
      // Si une recherche est active, la relancer
      if (debouncedQuery.trim()) {
        console.log("[Social] Window focused, re-fetching search results for:", debouncedQuery);
        const currentQuery = searchQuery;
        setSearchQuery("");
        setTimeout(() => setSearchQuery(currentQuery), 10);
      }
    };

    // Utiliser visibilitychange pour détecter quand l'onglet redevient actif
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [debouncedQuery, searchQuery]);

  const handleProfileClick = (profile: PublicProfile) => {
    if (profile.username) {
      router.push(`/u/${profile.username}`);
    }
  };

  const favoriteCount = (favoriteIds: string[] | null) => {
    if (!favoriteIds) return 0;
    return favoriteIds.length;
  };

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#020617]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-28 pt-6">
        <h1 className="text-2xl font-bold text-white">Social</h1>

        {/* Champ de recherche */}
        <div className="relative">
          <input
            type="search"
            name="q"
            id="profile-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="@username ou Rechercher un profil"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="search"
            className="w-full rounded-2xl bg-slate-800/50 border border-white/10 px-4 py-3 pr-10 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-bitebox focus:border-transparent"
          />
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Carte "Mon profil" */}
        <section className="rounded-xl bg-[#0e0e1a] border border-white/5 p-4 space-y-4">
          <h2 className="text-sm font-medium text-white mb-2">Mon profil</h2>
          
          {myProfileLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : myProfileError ? (
            <div className="rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2 text-xs text-red-300">
              {myProfileError}
            </div>
          ) : myProfileData && myProfileData.profile ? (
              <>
                {/* Header profil */}
                <div className="flex items-start gap-4 rounded-xl p-4 border" style={{ borderColor: getAvatarThemeFromVariant(myProfileData.profile.avatar_variant as any).accentSoft, backgroundColor: getAvatarThemeFromVariant(myProfileData.profile.avatar_variant as any).accentSoft }}>
                  <div
                    className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border"
                    style={{ boxShadow: getAvatarThemeFromVariant(myProfileData.profile.avatar_variant as any).glow, borderColor: getAvatarThemeFromVariant(myProfileData.profile.avatar_variant as any).accentSoft }}
                  >
                    <Image
                      src={getAvatarThemeFromVariant(myProfileData.profile.avatar_variant as any).avatarSrc}
                      alt={myProfileData.profile.username || "Avatar"}
                      fill
                      className="object-cover object-center scale-150"
                      style={{ minWidth: '100%', minHeight: '100%' }}
                    />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1 gap-1">
                    {myProfileData.profile.display_name && myProfileData.profile.display_name.trim().length > 0 ? (
                      <>
                        <h3 className="text-base font-semibold break-words" style={{ color: getAvatarThemeFromVariant(myProfileData.profile.avatar_variant as any).accent }}>
                          {myProfileData.profile.display_name}
                        </h3>
                        <span className="text-xs text-slate-400 break-words">
                          @{myProfileData.profile.username}
                        </span>
                      </>
                    ) : (
                      <h3 className="text-base font-semibold break-words" style={{ color: getAvatarThemeFromVariant(myProfileData.profile.avatar_variant as any).accent }}>
                        @{myProfileData.profile.username}
                      </h3>
                    )}
                    {myProfileData.profile.bio && myProfileData.profile.bio.trim().length > 0 && (
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 break-words mt-1">
                        {myProfileData.profile.bio}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats rapides */}
                <div className="grid grid-cols-3 gap-3 rounded-xl bg-[#0F0F1A] border shadow-md shadow-black/20 px-4 py-3" style={{ borderColor: getAvatarThemeFromVariant(myProfileData.profile.avatar_variant as any).accentSoft, boxShadow: getAvatarThemeFromVariant(myProfileData.profile.avatar_variant as any).ring }}>
                  <div className="flex flex-col items-center">
                    <span className="text-base font-semibold text-white">
                      {myProfileData.stats.restaurantsCount}
                    </span>
                    <span className="text-[10px] text-slate-400 text-center">
                      Restos testés
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-base font-semibold text-white">
                      {myProfileData.stats.totalExperiences}
                    </span>
                    <span className="text-[10px] text-slate-400 text-center">
                      Expériences
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-base font-semibold text-white">
                      {myProfileData.stats.avgRating.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-slate-400 text-center">
                      Note moyenne
                    </span>
                  </div>
                </div>

                {/* 3 enseignes favorites */}
                {myProfileData.favoriteRestaurants.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-white">3 enseignes favorites</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {myProfileData.favoriteRestaurants.map((restaurant) => (
                        <Link
                          key={restaurant.id}
                          href={restaurant.slug ? `/restaurants/${restaurant.slug}` : `#`}
                          className="flex flex-col items-center gap-1.5 rounded-xl bg-[#0F0F1A] border border-white/5 p-2 hover:bg-[#151520] transition-colors"
                        >
                          {restaurant.logo_url ? (
                            <div className="relative h-10 w-10 rounded overflow-hidden">
                              <Image
                                src={restaurant.logo_url}
                                alt={restaurant.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded bg-slate-700 flex items-center justify-center">
                              <span className="text-xs text-slate-400">{restaurant.name.charAt(0)}</span>
                            </div>
                          )}
                          <span className="text-[10px] text-slate-300 text-center line-clamp-2">{restaurant.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dernière expérience */}
                {myProfileData.lastExperience && (
                  <div className="rounded-xl bg-[#0F0F1A] border p-3" style={{ borderColor: getAvatarThemeFromVariant(myProfileData.profile.avatar_variant as any).accentSoft, boxShadow: getAvatarThemeFromVariant(myProfileData.profile.avatar_variant as any).ring }}>
                    <h3 className="text-sm font-semibold text-white mb-2">Dernière expérience</h3>
                    <div className="flex items-center gap-3">
                      {myProfileData.lastExperience.restaurant_logo_url && (
                        <div className="relative h-10 w-10 rounded overflow-hidden flex-shrink-0">
                          <Image
                            src={myProfileData.lastExperience.restaurant_logo_url}
                            alt={myProfileData.lastExperience.restaurant_name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{myProfileData.lastExperience.restaurant_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-400">{myProfileData.lastExperience.rating}/5</span>
                          {myProfileData.lastExperience.comment && (
                            <span className="text-xs text-slate-400 truncate">{myProfileData.lastExperience.comment}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lien vers le profil complet */}
                <Link
                  href="/profile"
                  className="flex items-center justify-center gap-2 rounded-xl bg-bitebox/10 border border-bitebox/30 px-4 py-2 text-sm font-medium text-bitebox hover:bg-bitebox/20 transition-colors"
                >
                  <span>Voir mon profil complet</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              Aucun profil trouvé
            </div>
          )}
        </section>

        {/* Contenu selon l'état */}
        {!debouncedQuery.trim() ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              className="w-16 h-16 text-slate-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p className="text-slate-400 text-lg">Recherche un profil avec son @</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              className="w-16 h-16 text-slate-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="text-slate-400 text-lg">Aucun profil trouvé</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {profiles.map((profile) => {
              const theme = getAvatarThemeFromVariant((profile as any).avatar_variant);
              const favoritesCount = favoriteCount(profile.favorite_restaurant_ids);

              return (
                <button
                  key={profile.id}
                  onClick={() => handleProfileClick(profile)}
                  className="flex items-center gap-4 rounded-2xl bg-slate-800/50 border-l-4 border-r border-t border-b p-4 hover:bg-slate-800/70 transition-colors text-left"
                  style={{ borderLeftColor: theme.accent, borderRightColor: theme.accentSoft, borderTopColor: theme.accentSoft, borderBottomColor: theme.accentSoft }}
                >
                  {/* Avatar */}
                  <div
                    className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border"
                    style={{ boxShadow: theme.glow, borderColor: theme.accentSoft }}
                  >
                    <Image
                      src={theme.avatarSrc}
                      alt={profile.username || "Avatar"}
                      fill
                      className="object-cover object-center scale-150"
                      style={{ minWidth: '100%', minHeight: '100%' }}
                    />
                  </div>

                  {/* Infos */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-base font-semibold truncate" style={{ color: theme.accent }}>
                      @{profile.username}
                    </span>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="flex items-center gap-1.5">
                        <svg
                          className="w-4 h-4 text-slate-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          />
                        </svg>
                        <span className="text-sm text-slate-400">
                          {favoritesCount} {favoritesCount === 1 ? 'restaurant' : 'restaurants'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Flèche */}
                  <svg
                    className="w-5 h-5 text-slate-400 flex-shrink-0"
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
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}


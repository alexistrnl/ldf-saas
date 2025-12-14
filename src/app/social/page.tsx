"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { getAvatarTheme, hexToRgba } from "@/lib/getAvatarTheme";
import Spinner from "@/components/Spinner";

type PublicProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  favorite_restaurant_ids: string[] | null;
};

export default function SocialPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce de 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Recherche des profils
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
        
        const { data, error: searchError } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, favorite_restaurant_ids")
          .eq("is_public", true)
          .ilike("username", `%${cleanQuery}%`)
          .not("username", "is", null)
          .limit(50);

        if (searchError) {
          console.error("[Social] search error", searchError);
          setError("Erreur lors de la recherche.");
          setProfiles([]);
        } else {
          setProfiles(data || []);
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
  }, [debouncedQuery]);

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
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="@username ou Rechercher un profil"
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
              const theme = getAvatarTheme(profile.avatar_url);
              const themeColorGlow = hexToRgba(theme.color, 0.33);
              const favoritesCount = favoriteCount(profile.favorite_restaurant_ids);

              return (
                <button
                  key={profile.id}
                  onClick={() => handleProfileClick(profile)}
                  className="flex items-center gap-4 rounded-2xl bg-slate-800/50 border border-white/10 p-4 hover:bg-slate-800/70 transition-colors text-left"
                >
                  {/* Avatar */}
                  <div
                    className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full"
                    style={{ boxShadow: `0 0 15px ${themeColorGlow}` }}
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

                  {/* Infos */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-base font-semibold text-white truncate">
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


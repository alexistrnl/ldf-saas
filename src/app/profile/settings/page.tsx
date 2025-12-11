"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getCurrentUserProfile,
  UserProfile,
  checkUsernameAvailability,
  updateUsername,
  updateAvatar,
} from "@/lib/profile";
import Spinner from "@/components/Spinner";

const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,20}$/;

const AVAILABLE_AVATARS = [
  "/avatar/avatar-bleu.png",
  "/avatar/avatar-orange.png",
  "/avatar/avatar-rouge.png",
  "/avatar/avatar-vert.png",
  "/avatar/avatar-violet.png",
];

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [initialUsername, setInitialUsername] = useState<string | null>(null);
  const [isSubmittingUsername, setIsSubmittingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const { user, profile: userProfile, error } = await getCurrentUserProfile();

        if (error) {
          console.error("[Settings] load profile error", error);
          setLoading(false);
          return;
        }

        if (user && userProfile) {
          setProfile(userProfile);
          if (userProfile.username) {
            setUsername(userProfile.username);
            setInitialUsername(userProfile.username);
          } else {
            setUsername("");
            setInitialUsername(null);
          }
        }
      } catch (err) {
        console.error("[Settings] unexpected error", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

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

    setIsSubmittingUsername(true);

    try {
      const { profile: currentProfile } = await getCurrentUserProfile();
      if (!currentProfile?.id) {
        setUsernameError("Tu dois être connecté.");
        setIsSubmittingUsername(false);
        return;
      }

      const { available, error: checkError } = await checkUsernameAvailability(
        username,
        currentProfile.id
      );

      if (checkError) {
        console.warn("[Settings] check username error (continuing anyway):", checkError);
      }

      if (!checkError && !available) {
        setUsernameError("Ce nom d'utilisateur est déjà pris.");
        setIsSubmittingUsername(false);
        return;
      }

      const { profile: updatedProfile, error } = await updateUsername(username);

      if (error) {
        console.error("[Settings] update username error:", error);
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
      }
    } catch (err) {
      console.error("[Settings] unexpected username error:", err);
      setUsernameError("Erreur inattendue. Réessaie plus tard.");
    } finally {
      setIsSubmittingUsername(false);
    }
  };

  const handleAvatarSelect = async (avatarUrl: string) => {
    if (isUpdatingAvatar) return;

    setIsUpdatingAvatar(true);
    setAvatarError(null);

    try {
      const { profile: updatedProfile, error } = await updateAvatar(avatarUrl);

      if (error) {
        console.error("[Settings] update avatar error:", error);
        setAvatarError("Impossible de mettre à jour l'avatar. Réessaie plus tard.");
        setIsUpdatingAvatar(false);
        return;
      }

      if (updatedProfile) {
        setProfile(updatedProfile);
      }
    } catch (err) {
      console.error("[Settings] unexpected avatar error:", err);
      setAvatarError("Erreur inattendue lors de la mise à jour de l'avatar.");
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen w-full overflow-x-hidden bg-[#020617]">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-28 pt-6">
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#020617]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-28 pt-6">
        {/* Header */}
        <section className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">
              Paramètres du compte
            </h1>
            <p className="text-xs text-slate-400">
              Personnalise ton profil et tes préférences.
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5 transition"
          >
            Retour
          </button>
        </section>

        {/* Édition du nom d'utilisateur */}
        <section className="rounded-xl bg-[#0e0e1a] border border-white/5 p-4 w-full overflow-x-hidden">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-white mb-1">
              Nom d'utilisateur
            </h2>
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
        </section>

        {/* Sélection de l'avatar */}
        <section className="rounded-xl bg-[#0e0e1a] border border-white/5 p-4 w-full overflow-x-hidden">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-white mb-1">Avatar</h2>
            <p className="text-xs text-slate-400">
              Choisis ta couleur de profil.
            </p>
          </div>

          {avatarError && (
            <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2">
              <p className="text-xs text-red-400">{avatarError}</p>
            </div>
          )}

          <div className="flex justify-center gap-3">
            {AVAILABLE_AVATARS.map((avatarUrl) => {
              const isSelected = profile?.avatar_url === avatarUrl;
              return (
                <button
                  key={avatarUrl}
                  onClick={() => handleAvatarSelect(avatarUrl)}
                  disabled={isUpdatingAvatar}
                  className={`
                    relative h-14 w-14 flex-shrink-0 rounded-full overflow-hidden border-2 transition-all
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
            <div className="mt-4 flex items-center justify-center gap-2">
              <Spinner size="sm" />
              <span className="text-xs text-slate-400">
                Mise à jour de l'avatar...
              </span>
            </div>
          )}
        </section>

        {/* Instructions pour ajouter à l'écran d'accueil */}
        <section className="rounded-xl bg-[#0e0e1a] border border-white/5 p-4 w-full overflow-x-hidden">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-white mb-1">
              Ajouter BiteBox à l'écran d'accueil
            </h2>
            <p className="text-xs text-slate-400">
              Accède rapidement à BiteBox depuis ton téléphone.
            </p>
          </div>

          <div className="space-y-6">
            {/* iPhone */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-white">
                iPhone (Safari)
              </h3>
              <ol className="space-y-1.5 text-xs text-slate-300 list-decimal list-inside">
                <li>Ouvre BiteBox dans Safari.</li>
                <li>Appuie sur le bouton Partager (carré avec flèche).</li>
                <li>Sélectionne &apos;Ajouter à l&apos;écran d&apos;accueil&apos;.</li>
                <li>Valide.</li>
              </ol>
            </div>

            {/* Séparateur */}
            <div className="border-t border-white/5"></div>

            {/* Android */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-white">
                Android (Chrome)
              </h3>
              <ol className="space-y-1.5 text-xs text-slate-300 list-decimal list-inside">
                <li>Ouvre BiteBox dans Chrome.</li>
                <li>Appuie sur le menu ⋮ (trois points).</li>
                <li>Choisis &apos;Ajouter à l&apos;écran d&apos;accueil&apos;.</li>
                <li>Valide.</li>
              </ol>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

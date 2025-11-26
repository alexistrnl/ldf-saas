"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  getCurrentUserProfile,
  checkUsernameAvailability,
  updateUsername,
} from "@/lib/profile";
import Spinner from "@/components/Spinner";

const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,20}$/;

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [initialUsername, setInitialUsername] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const { user, profile, error } = await getCurrentUserProfile();

        if (error) {
          console.error("[Settings] load profile error", error);
          setErrorMessage("Impossible de charger ton profil.");
          return;
        }

        if (user) {
          setUserId(user.id);
          if (profile?.username) {
            setUsername(profile.username);
            setInitialUsername(profile.username);
          }
        }
      } catch (err) {
        console.error("[Settings] unexpected error", err);
        setErrorMessage("Erreur inattendue.");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation côté client
    const validationError = validateUsername(username);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    // Si le username n'a pas changé, ne rien faire
    if (username === initialUsername) {
      setSuccessMessage("Aucune modification.");
      return;
    }

    if (!userId) {
      setErrorMessage("Tu dois être connecté.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Vérifier l'unicité (optionnel, mais permet de donner un feedback plus rapide)
      const { available, error: checkError } = await checkUsernameAvailability(
        username,
        userId
      );

      if (checkError) {
        // Si erreur lors de la vérification, on continue quand même
        // L'update vérifiera aussi l'unicité côté serveur
        console.warn("[Settings] check username error (continuing anyway):", checkError);
      }

      if (!checkError && !available) {
        setErrorMessage("Ce nom d'utilisateur est déjà pris.");
        setIsSubmitting(false);
        return;
      }

      // Mettre à jour le username
      const { profile: updatedProfile, error } = await updateUsername(username);

      if (error) {
        console.error("[Settings] update username error:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          fullError: error,
        });

        let message = "Impossible de mettre à jour ton nom d'utilisateur. Réessaie plus tard.";

        // Contrainte UNIQUE (username déjà pris)
        // Code PostgreSQL pour violation de contrainte unique
        if (error.code === "23505" || error.code === "PGRST116") {
          message = "Ce nom d'utilisateur est déjà pris. Choisis-en un autre.";
        }
        // Erreur RLS (row-level security)
        else if (
          error.message?.toLowerCase().includes("row-level security") ||
          error.message?.toLowerCase().includes("policy") ||
          error.code === "42501"
        ) {
          message =
            "Tu n'as pas les droits pour modifier ce profil. Vérifie que tu es bien connecté.";
        }
        // Erreur de contrainte (générale)
        else if (error.code === "23503" || error.message?.toLowerCase().includes("foreign key")) {
          message = "Erreur de référence. Contacte le support.";
        }
        // Autres erreurs - afficher le message détaillé en dev
        else if (error.message) {
          // En développement, montrer plus de détails
          if (process.env.NODE_ENV === "development") {
            message = `Erreur: ${error.message}${error.hint ? ` (${error.hint})` : ""}`;
          } else {
            message = `Erreur: ${error.message}`;
          }
        }

        setErrorMessage(message);
        setIsSubmitting(false);
        return;
      }

      setInitialUsername(username);
      setSuccessMessage("Nom d'utilisateur mis à jour ✅");

      // Rafraîchir la page après un court délai pour permettre la visualisation du message
      setTimeout(() => {
        router.refresh();
        router.push("/profile");
      }, 1000);
    } catch (err) {
      console.error("[Settings] unexpected error", err);
      setErrorMessage("Erreur inattendue. Réessaie plus tard.");
    } finally {
      setIsSubmitting(false);
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
        <section className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white">
                Réglages du profil
              </h1>
              <p className="text-xs text-slate-400">
                Modifie ton nom d'utilisateur.
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5 transition"
            >
              Retour
            </button>
          </div>
        </section>

        {/* Formulaire */}
        <section className="rounded-2xl bg-[#020617] border border-white/5 p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                Nom d'utilisateur
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-bitebox focus:outline-none focus:ring-1 focus:ring-bitebox transition"
                placeholder="Ex : alex_bitebox"
                maxLength={20}
              />
              {errorMessage && (
                <p className="text-xs text-red-400">{errorMessage}</p>
              )}
              {!errorMessage && (
                <p className="text-xs text-slate-500">
                  3 à 20 caractères (lettres, chiffres, _ et .)
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !username.trim()}
              className="w-full rounded-xl bg-bitebox px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                "Enregistrer"
              )}
            </button>

            {successMessage && (
              <p className="text-xs text-emerald-400 text-center">
                {successMessage}
              </p>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}


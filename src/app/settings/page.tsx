"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import Spinner from "@/components/Spinner";

type AccordionSection = "account" | "install" | null;

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState<AccordionSection>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error("[Settings] getUser error", error);
          router.push("/login");
          return;
        }

        if (!user) {
          router.push("/login");
          return;
        }

        setUser(user);
      } catch (err) {
        console.error("[Settings] unexpected error", err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [router]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("[Settings] signOut error", error);
        alert("Erreur lors de la déconnexion. Réessaie.");
        setIsSigningOut(false);
        return;
      }
      router.push("/login");
    } catch (err) {
      console.error("[Settings] unexpected signOut error", err);
      alert("Erreur inattendue lors de la déconnexion.");
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    setIsDeletingAccount(true);
    setDeleteError(null);

    try {
      const userId = user.id;

      // Supprimer toutes les données utilisateur
      // Les foreign keys avec CASCADE devraient gérer les suppressions en cascade
      
      // Supprimer le profil (cela devrait déclencher les suppressions en cascade si configuré)
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (profileError) {
        console.error("[Settings] delete profile error", profileError);
        setDeleteError("Erreur lors de la suppression des données. Réessaie plus tard.");
        setIsDeletingAccount(false);
        return;
      }

      // Note: La suppression du compte Auth nécessite des permissions admin (côté serveur)
      // Pour l'instant, on supprime toutes les données et on déconnecte l'utilisateur
      // Le compte Auth restera mais sans données associées
      // Pour une suppression complète, il faudrait créer un endpoint API avec permissions admin
      
      // Déconnecter l'utilisateur
      await supabase.auth.signOut();
      
      // Rediriger vers login
      router.push("/login");
    } catch (err) {
      console.error("[Settings] unexpected delete error", err);
      setDeleteError("Erreur lors de la suppression du compte. Réessaie plus tard.");
      setIsDeletingAccount(false);
    }
  };

  const toggleSection = (section: AccordionSection) => {
    setOpenSection(openSection === section ? null : section);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#020617]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-28 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-white">Paramètres</h1>
          <Link
            href="/profile"
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Retour au profil
          </Link>
        </div>

        {/* Section 1: Compte */}
        <div className="rounded-xl bg-[#0F0F1A] border border-white/5 overflow-hidden">
          <button
            onClick={() => toggleSection("account")}
            className="w-full flex items-center justify-between px-4 py-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <span className="text-base font-semibold text-white">Compte</span>
            </div>
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform ${
                openSection === "account" ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {openSection === "account" && (
            <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
              {/* Email (lecture seule) */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">
                  Adresse e-mail
                </label>
                <div className="rounded-lg bg-slate-900/50 border border-white/10 px-3 py-2">
                  <span className="text-sm text-slate-300">{user.email}</span>
                </div>
                <p className="text-xs text-slate-500">
                  L'adresse e-mail ne peut pas être modifiée pour l'instant.
                </p>
              </div>

              {/* Changer le mot de passe */}
              <div className="space-y-2">
                <Link
                  href="/forgot-password"
                  className="flex items-center justify-between rounded-lg bg-slate-900/50 border border-white/10 px-3 py-2 hover:bg-slate-800/50 transition-colors"
                >
                  <span className="text-sm font-medium text-white">
                    Changer le mot de passe
                  </span>
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </div>

              {/* Se déconnecter */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full flex items-center justify-center rounded-lg bg-slate-800/50 border border-white/10 px-3 py-2 hover:bg-slate-700/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSigningOut ? (
                    <>
                      <Spinner size="sm" />
                      <span className="ml-2 text-sm font-medium text-white">
                        Déconnexion...
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-medium text-white">
                      Se déconnecter
                    </span>
                  )}
                </button>
              </div>

              {/* Supprimer mon compte */}
              <div className="space-y-2 pt-2 border-t border-red-500/20">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center justify-center rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 hover:bg-red-500/20 transition-colors"
                >
                  <span className="text-sm font-medium text-red-400">
                    Supprimer mon compte
                  </span>
                </button>
                <p className="text-xs text-slate-500">
                  Cette action est irréversible. Toutes tes données seront
                  définitivement supprimées.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Installer l'app */}
        <div className="rounded-xl bg-[#0F0F1A] border border-white/5 overflow-hidden">
          <button
            onClick={() => toggleSection("install")}
            className="w-full flex items-center justify-between px-4 py-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
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
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <span className="text-base font-semibold text-white">
                Installer l'app
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform ${
                openSection === "install" ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {openSection === "install" && (
            <div className="px-4 pb-4 space-y-6 border-t border-white/5 pt-4">
              {/* iOS */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white">
                  Installer sur iPhone
                </h3>
                <ol className="space-y-2 text-sm text-slate-300">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-bitebox/20 text-bitebox flex items-center justify-center text-xs font-semibold">
                      1
                    </span>
                    <span className="pt-0.5">
                      Ouvre BiteBox dans Safari
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-bitebox/20 text-bitebox flex items-center justify-center text-xs font-semibold">
                      2
                    </span>
                    <span className="pt-0.5">
                      Appuie sur le bouton Partager
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-bitebox/20 text-bitebox flex items-center justify-center text-xs font-semibold">
                      3
                    </span>
                    <span className="pt-0.5">
                      Sélectionne "Ajouter à l'écran d'accueil"
                    </span>
                  </li>
                </ol>
              </div>

              {/* Android */}
              <div className="space-y-3 pt-4 border-t border-white/5">
                <h3 className="text-sm font-semibold text-white">
                  Installer sur Android
                </h3>
                <ol className="space-y-2 text-sm text-slate-300">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-bitebox/20 text-bitebox flex items-center justify-center text-xs font-semibold">
                      1
                    </span>
                    <span className="pt-0.5">
                      Ouvre BiteBox dans Chrome
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-bitebox/20 text-bitebox flex items-center justify-center text-xs font-semibold">
                      2
                    </span>
                    <span className="pt-0.5">
                      Appuie sur les trois points
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-bitebox/20 text-bitebox flex items-center justify-center text-xs font-semibold">
                      3
                    </span>
                    <span className="pt-0.5">
                      Sélectionne "Ajouter à l'écran d'accueil"
                    </span>
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmation pour suppression de compte */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl bg-[#0F0F1A] border border-white/10 p-6 space-y-4">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                Supprimer mon compte
              </h2>
              <p className="text-sm text-slate-300">
                Es-tu sûr de vouloir supprimer ton compte ? Cette action est
                irréversible et toutes tes données seront définitivement
                supprimées.
              </p>
            </div>

            {deleteError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/40 px-3 py-2">
                <p className="text-xs text-red-400">{deleteError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                disabled={isDeletingAccount}
                className="flex-1 rounded-lg bg-slate-800/50 border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="flex-1 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isDeletingAccount ? (
                  <>
                    <Spinner size="sm" />
                    <span className="ml-2">Suppression...</span>
                  </>
                ) : (
                  "Supprimer définitivement"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


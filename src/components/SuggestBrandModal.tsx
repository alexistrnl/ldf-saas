"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Spinner from "@/components/Spinner";

type SuggestBrandModalProps = {
  isOpen: boolean;
  onClose: () => void;
  searchQuery?: string;
};

type Toast = {
  message: string;
  type: "success" | "error";
} | null;

export default function SuggestBrandModal({
  isOpen,
  onClose,
  searchQuery = "",
}: SuggestBrandModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [brandName, setBrandName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Vérifier l'authentification au montage
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      setIsCheckingAuth(false);
    };
    if (isOpen) {
      checkAuth();
    }
  }, [isOpen]);

  // Réinitialiser le formulaire quand le modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      setBrandName("");
      setError(null);
      setToast(null);
    }
  }, [isOpen]);

  // Masquer le toast après 3 secondes
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fermer le modal avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const validateBrandName = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) {
      return "Le nom de l'enseigne est requis";
    }
    if (trimmed.length < 2) {
      return "Le nom doit contenir au moins 2 caractères";
    }
    if (trimmed.length > 80) {
      return "Le nom ne peut pas dépasser 80 caractères";
    }
    return null;
  };

  const checkDuplicate = async (name: string): Promise<boolean> => {
    try {
      const trimmed = name.trim().toLowerCase();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data, error } = await supabase
        .from("brand_suggestions")
        .select("id")
        .ilike("suggested_name", trimmed)
        .gte("created_at", sevenDaysAgo.toISOString())
        .limit(1);

      if (error) {
        console.error("[SuggestBrand] Error checking duplicate:", error);
        return false; // En cas d'erreur, on laisse passer pour ne pas bloquer
      }

      return (data?.length || 0) > 0;
    } catch (err) {
      console.error("[SuggestBrand] Exception checking duplicate:", err);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const validationError = validateBrandName(brandName);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Vérifier si l'utilisateur est connecté
    if (!userId) {
      setToast({
        message: "Connecte-toi pour suggérer une enseigne",
        type: "error",
      });
      return;
    }

    // Vérifier les doublons
    const isDuplicate = await checkDuplicate(brandName);
    if (isDuplicate) {
      setToast({
        message: "Cette suggestion a déjà été envoyée récemment",
        type: "error",
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const trimmedName = brandName.trim();
      const locale = typeof window !== "undefined" ? navigator.language : null;

      const { error: insertError } = await supabase
        .from("brand_suggestions")
        .insert({
          user_id: userId,
          suggested_name: trimmedName,
          search_query: searchQuery || null,
          context_page: pathname || null,
          locale: locale || null,
          status: "new",
        });

      if (insertError) {
        throw insertError;
      }

      // Succès
      setToast({
        message: "Merci, suggestion envoyée",
        type: "success",
      });

      // Fermer le modal après un court délai
      setTimeout(() => {
        setBrandName("");
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("[SuggestBrand] Error submitting suggestion:", err);
      setToast({
        message: "Impossible d'envoyer, réessaie",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-slate-900 rounded-lg border border-slate-700 shadow-xl w-full max-w-md relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Suggérer une enseigne
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Fermer"
            >
              <svg
                className="w-6 h-6"
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

          {/* Content */}
          <div className="px-6 py-4">
            {isCheckingAuth ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : (
              <>
                {!userId && (
                  <div className="mb-4 p-4 bg-amber-950/30 border border-amber-500/30 rounded-lg">
                    <p className="text-sm text-amber-400 mb-3">
                      Connecte-toi pour suggérer une enseigne
                    </p>
                    <Link
                      href={`/login?redirect=${encodeURIComponent(pathname || "/")}`}
                      className="inline-block px-4 py-2 bg-bitebox text-white text-sm font-medium rounded-lg hover:bg-bitebox-dark transition-colors"
                    >
                      Se connecter
                    </Link>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="brand-name"
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      Nom de l'enseigne
                    </label>
                    <input
                      id="brand-name"
                      type="text"
                      value={brandName}
                      onChange={(e) => {
                        setBrandName(e.target.value);
                        setError(null);
                      }}
                      disabled={loading || !userId}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bitebox focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Ex: McDonald's"
                      maxLength={80}
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Ça nous aide à améliorer le catalogue
                    </p>
                    {error && (
                      <p className="mt-1 text-sm text-red-400">{error}</p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={loading}
                      className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !userId || !brandName.trim()}
                      className="flex-1 px-4 py-2.5 bg-bitebox text-white font-medium rounded-lg hover:bg-bitebox-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Spinner size="sm" />
                          <span>Envoi...</span>
                        </>
                      ) : (
                        "Envoyer"
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[60] animate-in slide-in-from-bottom-2">
          <div
            className={`px-4 py-3 rounded-lg shadow-lg border ${
              toast.type === "success"
                ? "bg-green-950/90 border-green-500/30 text-green-400"
                : "bg-red-950/90 border-red-500/30 text-red-400"
            }`}
          >
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}
    </>
  );
}

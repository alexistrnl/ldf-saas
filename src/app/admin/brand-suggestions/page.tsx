"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Spinner from "@/components/Spinner";
import AdminHeader from "@/components/AdminHeader";

type BrandSuggestion = {
  id: string;
  user_id: string | null;
  suggested_name: string;
  search_query: string | null;
  context_page: string | null;
  locale: string | null;
  status: "new" | "reviewing" | "accepted" | "rejected";
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  user_email?: string | null;
};

type Toast = {
  message: string;
  type: "success" | "error";
} | null;

const ITEMS_PER_PAGE = 20;

export default function BrandSuggestionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [suggestions, setSuggestions] = useState<BrandSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(true); // Le middleware vérifie déjà l'admin
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [editingNote, setEditingNote] = useState<{ id: string; note: string } | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Le middleware vérifie déjà l'admin, donc si on arrive ici, on est admin
  // Pas besoin de vérification supplémentaire

  // Charger les suggestions
  const loadSuggestions = async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("brand_suggestions")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(
          (currentPage - 1) * ITEMS_PER_PAGE,
          currentPage * ITEMS_PER_PAGE - 1
        );

      // Appliquer le filtre de statut
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        throw fetchError;
      }

      // Enrichir avec les emails des utilisateurs si disponibles
      const enrichedSuggestions = await Promise.all(
        (data || []).map(async (suggestion) => {
          if (!suggestion.user_id) {
            return { ...suggestion, user_email: null };
          }

          const { data: profile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", suggestion.user_id)
            .single();

          return {
            ...suggestion,
            user_email: profile?.email || null,
          };
        })
      );

      setSuggestions(enrichedSuggestions as BrandSuggestion[]);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error("[BrandSuggestions] Error loading suggestions:", err);
      setError("Erreur lors du chargement des suggestions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, [currentPage, statusFilter]);

  // Masquer le toast après 3 secondes
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingStatus(id);
    try {
      const { error } = await supabase
        .from("brand_suggestions")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) {
        throw error;
      }

      setToast({
        message: "Statut mis à jour",
        type: "success",
      });

      // Recharger les suggestions
      await loadSuggestions();
    } catch (err: any) {
      console.error("[BrandSuggestions] Error updating status:", err);
      setToast({
        message: "Erreur lors de la mise à jour",
        type: "error",
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const updateAdminNote = async (id: string, note: string) => {
    try {
      const { error } = await supabase
        .from("brand_suggestions")
        .update({ admin_note: note || null })
        .eq("id", id);

      if (error) {
        throw error;
      }

      setToast({
        message: "Note mise à jour",
        type: "success",
      });

      setEditingNote(null);
      await loadSuggestions();
    } catch (err: any) {
      console.error("[BrandSuggestions] Error updating note:", err);
      setToast({
        message: "Erreur lors de la mise à jour de la note",
        type: "error",
      });
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Le middleware gère déjà la vérification admin et la redirection

  return (
    <div className="h-full w-full bg-[#020617] text-slate-50 flex flex-col overflow-hidden">
      <AdminHeader
        title="Suggestions d'enseignes"
        description={`${totalCount} suggestion${totalCount !== 1 ? "s" : ""} au total`}
      />
      
      {/* Contenu défilable */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-6 min-h-0">

        {/* Filtres */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setStatusFilter("all");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === "all"
                ? "bg-bitebox text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => {
              setStatusFilter("new");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === "new"
                ? "bg-bitebox text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Nouveau
          </button>
          <button
            onClick={() => {
              setStatusFilter("reviewing");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === "reviewing"
                ? "bg-bitebox text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            En cours
          </button>
          <button
            onClick={() => {
              setStatusFilter("accepted");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === "accepted"
                ? "bg-bitebox text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Accepté
          </button>
          <button
            onClick={() => {
              setStatusFilter("rejected");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === "rejected"
                ? "bg-bitebox text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Rejeté
          </button>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-4 text-red-400">
            {error}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-8 text-center">
            <p className="text-slate-400">Aucune suggestion trouvée</p>
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Nom suggéré
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Recherche
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Utilisateur
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Note admin
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {suggestions.map((suggestion) => (
                    <tr
                      key={suggestion.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {new Date(suggestion.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-white">
                        {suggestion.suggested_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {suggestion.search_query || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {suggestion.user_email || suggestion.user_id?.slice(0, 8) || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            suggestion.status === "new"
                              ? "bg-blue-500/20 text-blue-400"
                              : suggestion.status === "reviewing"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : suggestion.status === "accepted"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {suggestion.status === "new"
                            ? "Nouveau"
                            : suggestion.status === "reviewing"
                            ? "En cours"
                            : suggestion.status === "accepted"
                            ? "Accepté"
                            : "Rejeté"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {editingNote?.id === suggestion.id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editingNote.note}
                              onChange={(e) =>
                                setEditingNote({
                                  ...editingNote,
                                  note: e.target.value,
                                })
                              }
                              className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                              placeholder="Note..."
                              autoFocus
                              onBlur={() =>
                                updateAdminNote(editingNote.id, editingNote.note)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  updateAdminNote(editingNote.id, editingNote.note);
                                } else if (e.key === "Escape") {
                                  setEditingNote(null);
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              setEditingNote({
                                id: suggestion.id,
                                note: suggestion.admin_note || "",
                              })
                            }
                            className="text-sm text-slate-400 hover:text-white transition-colors text-left"
                          >
                            {suggestion.admin_note || "Ajouter une note"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => updateStatus(suggestion.id, "accepted")}
                            disabled={updatingStatus === suggestion.id}
                            className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded hover:bg-green-500/30 transition-colors disabled:opacity-50"
                          >
                            {updatingStatus === suggestion.id ? (
                              <Spinner size="sm" />
                            ) : (
                              "Accepter"
                            )}
                          </button>
                          <button
                            onClick={() => updateStatus(suggestion.id, "rejected")}
                            disabled={updatingStatus === suggestion.id}
                            className="px-3 py-1 bg-red-500/20 text-red-400 text-xs font-medium rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
                          >
                            {updatingStatus === suggestion.id ? (
                              <Spinner size="sm" />
                            ) : (
                              "Rejeter"
                            )}
                          </button>
                          <button
                            onClick={() => updateStatus(suggestion.id, "reviewing")}
                            disabled={updatingStatus === suggestion.id}
                            className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
                          >
                            {updatingStatus === suggestion.id ? (
                              <Spinner size="sm" />
                            ) : (
                              "En cours"
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between">
                <div className="text-sm text-slate-400">
                  Page {currentPage} sur {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-slate-800 text-slate-300 text-sm rounded hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-slate-800 text-slate-300 text-sm rounded hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
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
      </div>
    </div>
  );
}

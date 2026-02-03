"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Spinner from "@/components/Spinner";
import VerifiedBadge from "@/components/VerifiedBadge";
import { filterAllowedProfileFields } from "@/lib/profile";
import AdminHeader from "@/components/AdminHeader";

type User = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  is_verified: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Charger les utilisateurs
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("profiles")
          .select("id, username, display_name, is_verified, created_at, email")
          .order("created_at", { ascending: false });

        if (fetchError) {
          console.error("[Admin Users] Error loading users:", fetchError);
          setError("Erreur lors du chargement des utilisateurs.");
          return;
        }

        // Les emails peuvent être dans profiles.email si disponible
        const usersWithEmail = (data || []).map((profile: any) => ({
          id: profile.id,
          email: profile.email || null,
          username: profile.username,
          display_name: profile.display_name,
          is_verified: profile.is_verified || false,
          created_at: profile.created_at,
        }));

        setUsers(usersWithEmail);
      } catch (err) {
        console.error("[Admin Users] Unexpected error:", err);
        setError("Erreur inattendue lors du chargement des utilisateurs.");
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  // Toggle de vérification - utilise directement Supabase
  const handleToggleVerification = async (userId: string, currentVerified: boolean) => {
    setUpdatingUserId(userId);
    setError(null);

    try {
      const newVerifiedStatus = !currentVerified;

      // Mettre à jour directement via Supabase avec whitelist stricte
      // Les policies RLS bloqueront si l'utilisateur n'est pas admin
      const updatePayload = filterAllowedProfileFields({
        is_verified: newVerifiedStatus,
        updated_at: new Date().toISOString(),
      });
      
      console.log("[profiles update keys]", Object.keys(updatePayload));
      console.log("[Admin Users] Payload (filtered):", JSON.stringify(updatePayload, null, 2));
      
      const { error: updateError } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", userId);

      if (updateError) {
        console.error("[Admin Users] Error updating verification:", updateError);
        
        // Vérifier si c'est une erreur de permissions (RLS)
        if (
          updateError.message?.toLowerCase().includes("policy") ||
          updateError.message?.toLowerCase().includes("row-level security") ||
          updateError.code === "42501" ||
          updateError.message?.toLowerCase().includes("permission denied")
        ) {
          setToast({
            message: "Erreur : Vous n'avez pas les droits administrateur pour effectuer cette action.",
            type: "error",
          });
        } else {
          setToast({
            message: updateError.message || "Erreur lors de la mise à jour",
            type: "error",
          });
        }
        setUpdatingUserId(null);
        return;
      }

      // Mettre à jour l'état local
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                is_verified: newVerifiedStatus,
              }
            : user
        )
      );

      setToast({
        message: newVerifiedStatus
          ? "Compte certifié avec succès"
          : "Certification retirée",
        type: "success",
      });
    } catch (err) {
      console.error("[Admin Users] Error toggling verification:", err);
      setToast({
        message: "Erreur lors de la mise à jour",
        type: "error",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Filtrer les utilisateurs selon la recherche
  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      (user.email && user.email.toLowerCase().includes(query)) ||
      (user.username && user.username.toLowerCase().includes(query)) ||
      (user.display_name && user.display_name.toLowerCase().includes(query))
    );
  });

  // Masquer le toast après 3 secondes
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#020617] text-slate-50 flex flex-col overflow-hidden">
      <AdminHeader
        title="Gestion des utilisateurs"
        description="Certifier ou retirer la certification des comptes"
      />
      
      {/* Contenu défilable */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-6 min-h-0">

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 rounded-xl border border-white/10 p-4">
            <div className="text-sm text-slate-400 mb-1">Total utilisateurs</div>
            <div className="text-2xl font-bold text-white">{users.length}</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl border border-white/10 p-4">
            <div className="text-sm text-slate-400 mb-1">Comptes certifiés</div>
            <div className="text-2xl font-bold text-blue-400">
              {users.filter((u) => u.is_verified).length}
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-xl border border-white/10 p-4">
            <div className="text-sm text-slate-400 mb-1">Non certifiés</div>
            <div className="text-2xl font-bold text-slate-400">
              {users.filter((u) => !u.is_verified).length}
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`mb-4 rounded-lg px-4 py-3 ${
              toast.type === "success"
                ? "bg-green-500/10 border border-green-500/30 text-green-300"
                : "bg-red-500/10 border border-red-500/30 text-red-300"
            }`}
          >
            {toast.message}
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-300">
            {error}
          </div>
        )}

        {/* Barre de recherche */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Rechercher par email, nom d'utilisateur ou nom affiché..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg bg-slate-900/50 border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:border-bitebox focus:outline-none focus:ring-2 focus:ring-bitebox/20"
          />
        </div>

        {/* Liste des utilisateurs */}
        <div className="bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Date de création
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      {searchQuery ? "Aucun utilisateur trouvé" : "Aucun utilisateur"}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">
                            {user.display_name || user.username || "Sans nom"}
                          </span>
                          {user.is_verified && <VerifiedBadge />}
                        </div>
                        {user.username && (
                          <span className="text-xs text-slate-400">@{user.username}</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-slate-300">
                          {user.email ? (
                            user.email
                          ) : (
                            <span className="text-slate-500 italic">Non disponible</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.is_verified
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-slate-700/50 text-slate-400"
                          }`}
                        >
                          {user.is_verified ? "Certifié" : "Non certifié"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-slate-400">
                          {user.created_at
                            ? new Date(user.created_at).toLocaleDateString("fr-FR")
                            : "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => handleToggleVerification(user.id, user.is_verified)}
                            disabled={updatingUserId === user.id}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              user.is_verified
                                ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                                : "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                          >
                            {updatingUserId === user.id ? (
                              <Spinner size="sm" />
                            ) : user.is_verified ? (
                              "Retirer"
                            ) : (
                              "Certifier"
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

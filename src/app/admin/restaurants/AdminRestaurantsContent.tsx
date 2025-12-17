"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatRLSError } from "@/lib/errorMessages";
import { Restaurant, ViewMode } from "./types";
import RestaurantListPanel from "./RestaurantListPanel";
import RestaurantDetailsPanel from "./RestaurantDetailsPanel";

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminRestaurantsContent() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [supabaseUser, setSupabaseUser] = useState<{ id?: string; email?: string | null } | null>(null);

  // État pour la création
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoImageMode, setLogoImageMode] = useState<"upload" | "url">("upload");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // État pour l'édition
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editLogoImageMode, setEditLogoImageMode] = useState<"upload" | "url">("upload");
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchRestaurants();
    
    // Vérifier l'utilisateur Supabase au chargement
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("[AdminRestaurantsContent] Supabase user on load:", user);
      setSupabaseUser(user);
    };
    
    checkUser();
  }, []);

  // Sélectionner automatiquement la première enseigne au chargement
  useEffect(() => {
    if (restaurants.length > 0 && !selectedRestaurantId && !loading) {
      setSelectedRestaurantId(restaurants[0].id);
      setViewMode("overview");
    }
  }, [restaurants, loading]);

  // Nettoyer les URLs d'aperçu pour éviter les fuites mémoire
  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreview);
      }
      if (editLogoPreview && editLogoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(editLogoPreview);
      }
    };
  }, [logoPreview, editLogoPreview]);

  const fetchRestaurants = async () => {
    try {
      setError(null);
      setLoading(true);

      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[Admin] restaurants error", error);
        setError("Erreur lors du chargement des enseignes.");
        return;
      }

      setRestaurants((data || []) as Restaurant[]);
    } catch (err) {
      console.error("[Admin] restaurants unexpected", err);
      setError("Erreur inattendue lors du chargement des enseignes.");
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setName("");
    setDescription("");
    if (logoPreview && logoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreview);
    }
    setLogoFile(null);
    setLogoUrl("");
    setLogoImageMode("upload");
    setLogoPreview(null);
    setShowCreateForm(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Le nom de l'enseigne est obligatoire.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      let finalLogoUrl: string | null = null;

      // Mode upload : uploader le fichier
      if (logoImageMode === "upload" && logoFile) {
        const fileError = validateImageFile(logoFile);
        if (fileError) {
          setError(fileError);
          setSaving(false);
          return;
        }

        const path = `logos/${Date.now()}-${logoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("fastfood-images")
          .upload(path, logoFile);

        if (uploadError) {
          console.error("[Admin] upload logo error", uploadError);
          setError("Erreur lors de l'upload du logo.");
          setSaving(false);
          return;
        }

        const { data } = supabase.storage
          .from("fastfood-images")
          .getPublicUrl(path);
        finalLogoUrl = data.publicUrl;
      }
      // Mode URL : valider et utiliser l'URL
      else if (logoImageMode === "url" && logoUrl.trim()) {
        if (!validateImageUrl(logoUrl)) {
          setError(
            "URL invalide. L'URL doit commencer par http:// ou https:// et avoir une extension .png, .jpg, .jpeg ou .webp"
          );
          setSaving(false);
          return;
        }
        finalLogoUrl = logoUrl.trim();
      }

      // Générer un slug unique
      let slug = slugify(name);
      let insertAttempts = 0;
      const maxAttempts = 10;
      let insertError: any = null;
      let insertedData: any = null;

      // Tenter l'insert avec gestion de l'unicité du slug
      while (insertAttempts < maxAttempts) {
        // Construire le payload avec TOUS les champs NOT NULL
        const payload = {
          name: name.trim(),
          slug: slug,
          description: description?.trim() || null,
          logo_url: finalLogoUrl || null,
          // show_latest_additions ne doit PAS être envoyé (feature supprimée de l'admin)
        };

        // Logging pour diagnostiquer
        if (process.env.NODE_ENV !== "production") {
          console.log("[CreateRestaurant] payload", payload);
        }

        // Re-vérifier l'utilisateur juste avant l'insert
        const { data: { user: userBeforeInsert } } = await supabase.auth.getUser();
        console.log("[CreateRestaurant] Supabase user before insert:", userBeforeInsert);

        const { data, error } = await supabase
          .from("restaurants")
          .insert(payload)
          .select("id, name, slug")
          .single();

        // Logging de la réponse
        if (process.env.NODE_ENV !== "production") {
          console.log("[CreateRestaurant] error", error);
          console.log("[CreateRestaurant] response", { data, error });
        }

        if (error) {
          // Si erreur de contrainte unique sur slug, essayer avec un suffixe
          if (error.code === "23505" && error.message?.includes("slug")) {
            insertAttempts++;
            slug = `${slugify(name)}-${insertAttempts + 1}`;
            insertError = error;
            continue; // Réessayer avec un nouveau slug
          } else {
            // Autre erreur (RLS, validation, etc.)
            insertError = error;
            break;
          }
        } else {
          // Succès
          insertedData = data;
          insertError = null;
          break;
        }
      }

      // Gestion des erreurs avec affichage détaillé
      if (insertError) {
        const errorCode = insertError.code || "UNKNOWN";
        const errorMessage = insertError.message || "Erreur inconnue";
        const errorDetails = insertError.details || "";
        
        // Logger l'erreur technique pour le debug (toujours)
        console.error("[Admin] insert restaurant error", {
          code: errorCode,
          message: errorMessage,
          details: errorDetails,
          fullError: insertError,
        });

        // Gestion spéciale pour les erreurs RLS (42501)
        if (insertError.code === "42501" || errorMessage.includes("permission denied") || errorMessage.includes("RLS") || errorMessage.includes("row-level security")) {
          const userFriendlyMessage = await formatRLSError(insertError);
          setError(userFriendlyMessage);
          setSaving(false);
          return;
        }

        // Messages spécifiques pour les autres types d'erreur
        let errorDisplay = `Erreur ${errorCode}: ${errorMessage}`;
        if (errorDetails) {
          errorDisplay += ` (${errorDetails})`;
        }

        if (insertError.code === "23505") {
          errorDisplay = `Erreur d'unicité: ${errorMessage}. Code: ${errorCode}`;
        } else if (insertError.code === "23502") {
          errorDisplay = `Champ requis manquant: ${errorMessage}. Code: ${errorCode}`;
        }

        setError(errorDisplay);
        setSaving(false);
        return;
      }

      // Vérifier que data existe avant de continuer
      if (!insertedData || !insertedData.id) {
        const errorMsg = "Aucune donnée retournée (RLS ou insert non exécuté)";
        if (process.env.NODE_ENV !== "production") {
          console.error("[CreateRestaurant] no data returned", { insertedData });
        }
        setError(errorMsg);
        setSaving(false);
        return;
      }

      resetCreateForm();
      await fetchRestaurants();
      
      // Sélectionner la nouvelle enseigne créée
      setSelectedRestaurantId(insertedData.id);
      setViewMode("overview");
    } catch (err) {
      // Gestion des erreurs inattendues avec affichage détaillé
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      const errorCode = (err as any)?.code || "UNKNOWN";
      const errorDetails = (err as any)?.details || "";
      
      let errorDisplay = `Erreur ${errorCode}: ${errorMessage}`;
      if (errorDetails) {
        errorDisplay += ` (${errorDetails})`;
      }
      
      if (process.env.NODE_ENV !== "production") {
        console.error("[CreateRestaurant] unexpected error", {
          code: errorCode,
          message: errorMessage,
          details: errorDetails,
          fullError: err,
        });
      }
      
      setError(errorDisplay);
    } finally {
      setSaving(false);
    }
  };

  const startEditRestaurant = (restaurant: Restaurant) => {
    setEditingRestaurant(restaurant);
    setEditName(restaurant.name);
    setEditDescription(restaurant.description || "");
    setEditLogoFile(null);
    setEditLogoUrl("");
    setEditLogoImageMode("upload");
    setEditLogoPreview(restaurant.logo_url);
    setSelectedRestaurantId(restaurant.id);
    setViewMode("edit");
  };

  const cancelEditRestaurant = () => {
    setEditingRestaurant(null);
    setEditName("");
    setEditDescription("");
    if (editLogoPreview && editLogoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(editLogoPreview);
    }
    setEditLogoFile(null);
    setEditLogoUrl("");
    setEditLogoImageMode("upload");
    setEditLogoPreview(null);
    setViewMode("overview");
  };

  const handleUpdateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRestaurant) return;

    try {
      setError(null);

      if (!editName.trim()) {
        setError("Le nom de l'enseigne est obligatoire.");
        return;
      }

      let finalLogoUrl: string | null = editingRestaurant.logo_url ?? null;

      // Mode upload : uploader le fichier
      if (editLogoImageMode === "upload" && editLogoFile) {
        const fileError = validateImageFile(editLogoFile);
        if (fileError) {
          setError(fileError);
          return;
        }

        const path = `logos/${editingRestaurant.id}/${Date.now()}-${editLogoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("fastfood-images")
          .upload(path, editLogoFile);

        if (uploadError) {
          console.error("[Admin] upload new logo error", uploadError);
          setError("Erreur lors de l'upload du nouveau logo.");
          return;
        }

        const { data } = supabase.storage
          .from("fastfood-images")
          .getPublicUrl(path);
        finalLogoUrl = data.publicUrl;
      }
      // Mode URL : valider et utiliser l'URL
      else if (editLogoImageMode === "url" && editLogoUrl.trim()) {
        if (!validateImageUrl(editLogoUrl)) {
          setError(
            "URL invalide. L'URL doit commencer par http:// ou https:// et avoir une extension .png, .jpg, .jpeg ou .webp"
          );
          return;
        }
        finalLogoUrl = editLogoUrl.trim();
      }

      const slug = slugify(editName);

      const { error: updateError } = await supabase
        .from("restaurants")
        .update({
          name: editName,
          description: editDescription || null,
          logo_url: finalLogoUrl,
          slug,
        })
        .eq("id", editingRestaurant.id);

      if (updateError) {
        console.error("[Admin] update restaurant error", updateError);
        
        // Gestion spéciale pour les erreurs RLS (42501)
        if (updateError.code === "42501" || updateError.message?.toLowerCase().includes("permission denied") || updateError.message?.toLowerCase().includes("RLS") || updateError.message?.toLowerCase().includes("row-level security")) {
          const userFriendlyMessage = await formatRLSError(updateError);
          setError(userFriendlyMessage);
          return;
        }
        
        setError("Erreur lors de la mise à jour de l'enseigne.");
        return;
      }

      cancelEditRestaurant();
      await fetchRestaurants();
    } catch (err) {
      console.error("[Admin] update restaurant unexpected", err);
      setError("Erreur inattendue lors de la mise à jour de l'enseigne.");
    }
  };

  const handleDelete = async (restaurant: Restaurant) => {
    if (!confirm(`Supprimer l'enseigne "${restaurant.name}" ?`)) return;

    try {
      setError(null);

      const { error: deleteDishesError } = await supabase
        .from("dishes")
        .delete()
        .eq("restaurant_id", restaurant.id);

      if (deleteDishesError) {
        console.error("[Admin] delete dishes error", deleteDishesError);
        setError("Impossible de supprimer les plats avant l'enseigne.");
        return;
      }

      const { error } = await supabase
        .from("restaurants")
        .delete()
        .eq("id", restaurant.id);

      if (error) {
        console.error("[Admin] delete restaurant error", error);
        
        // Gestion spéciale pour les erreurs RLS (42501)
        if (error.code === "42501" || error.message?.toLowerCase().includes("permission denied") || error.message?.toLowerCase().includes("RLS") || error.message?.toLowerCase().includes("row-level security")) {
          const userFriendlyMessage = await formatRLSError(error);
          setError(userFriendlyMessage);
          return;
        }
        
        setError("Erreur lors de la suppression de l'enseigne.");
        return;
      }

      // Si l'enseigne supprimée était sélectionnée, sélectionner la suivante ou aucune
      if (selectedRestaurantId === restaurant.id) {
        const remaining = restaurants.filter((r) => r.id !== restaurant.id);
        if (remaining.length > 0) {
          setSelectedRestaurantId(remaining[0].id);
          setViewMode("overview");
        } else {
          setSelectedRestaurantId(null);
          setViewMode("overview");
        }
      }

      if (editingRestaurant?.id === restaurant.id) {
        cancelEditRestaurant();
      }

      await fetchRestaurants();
    } catch (err) {
      console.error("[Admin] delete restaurant unexpected", err);
      setError("Erreur inattendue lors de la suppression de l'enseigne.");
    }
  };

  const handleSelectRestaurant = (restaurant: Restaurant) => {
    setSelectedRestaurantId(restaurant.id);
    setViewMode("overview");
    cancelEditRestaurant();
  };

  const handleManageMenu = (restaurant: Restaurant) => {
    setSelectedRestaurantId(restaurant.id);
    setViewMode("menu");
    cancelEditRestaurant();
  };

  const handleCreateNew = () => {
    resetCreateForm();
    setShowCreateForm(true);
    setSelectedRestaurantId(null);
    cancelEditRestaurant();
  };

  const validateImageUrl = (url: string): boolean => {
    if (!url.trim()) return true; // URL vide est valide (optionnel)

    // Vérifier que l'URL commence par http ou https
    if (!url.match(/^https?:\/\//i)) {
      return false;
    }

    // Vérifier l'extension de l'image
    const validExtensions = [".png", ".jpg", ".jpeg", ".webp"];
    const urlLower = url.toLowerCase();
    const hasValidExtension = validExtensions.some((ext) =>
      urlLower.includes(ext)
    );

    return hasValidExtension;
  };

  const validateImageFile = (file: File | null): string | null => {
    if (!file) return null;

    // Vérifier la taille (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return "L'image est trop lourde. Taille maximale : 5MB.";
    }

    // Vérifier le type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return "Format d'image non accepté. Formats acceptés : PNG, JPG, JPEG, WEBP.";
    }

    return null;
  };

  const renderLogoInput = (
    mode: "upload" | "url",
    setMode: (m: "upload" | "url") => void,
    file: File | null,
    setFile: (f: File | null) => void,
    url: string,
    setUrl: (u: string) => void,
    preview: string | null,
    setPreview: (p: string | null) => void
  ) => (
    <div className="space-y-2">
      <div className="flex gap-2 border-b border-slate-700">
        <button
          type="button"
          onClick={() => {
            if (preview && preview.startsWith("blob:")) {
              URL.revokeObjectURL(preview);
            }
            setMode("upload");
            setUrl("");
            setPreview(null);
          }}
          className={`px-3 py-1.5 text-xs font-medium transition ${
            mode === "upload"
              ? "text-bitebox border-b-2 border-bitebox"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Télécharger un fichier
        </button>
        <button
          type="button"
          onClick={() => {
            if (preview && preview.startsWith("blob:")) {
              URL.revokeObjectURL(preview);
            }
            setMode("url");
            setFile(null);
            setPreview(null);
          }}
          className={`px-3 py-1.5 text-xs font-medium transition ${
            mode === "url"
              ? "text-bitebox border-b-2 border-bitebox"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Entrer une URL
        </button>
      </div>

      {mode === "upload" && (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={(e) => {
              const newFile = e.target.files?.[0] ?? null;
              if (preview && preview.startsWith("blob:")) {
                URL.revokeObjectURL(preview);
              }
              setFile(newFile);
              setUrl("");
              if (newFile) {
                const newPreview = URL.createObjectURL(newFile);
                setPreview(newPreview);
              } else {
                setPreview(null);
              }
            }}
            className="text-xs text-slate-300"
          />
          <p className="text-[11px] text-slate-500">
            Formats acceptés : PNG, JPG, JPEG, WEBP (max 5MB)
          </p>
        </div>
      )}

      {mode === "url" && (
        <div className="space-y-2">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              const newUrl = e.target.value;
              setUrl(newUrl);
              setFile(null);
              if (newUrl && validateImageUrl(newUrl)) {
                setPreview(newUrl);
              } else {
                setPreview(null);
              }
            }}
            placeholder="https://exemple.com/image.png"
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
          />
          <p className="text-[11px] text-slate-500">
            URL commençant par http:// ou https:// avec extension .png, .jpg,
            .jpeg ou .webp
          </p>
        </div>
      )}

      {preview && (
        <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-700">
          <p className="text-xs text-slate-400 mb-2">Aperçu :</p>
          <img
            src={preview}
            alt="Aperçu logo"
            className="max-w-full h-32 object-contain rounded"
            onError={() => setPreview(null)}
          />
        </div>
      )}
    </div>
  );

  const selectedRestaurant = restaurants.find(
    (r) => r.id === selectedRestaurantId
  ) || null;

  return (
    <div className="fixed inset-x-0 top-[60px] bottom-0 flex flex-col bg-slate-950 text-slate-50 overflow-hidden">
      {/* Badge utilisateur Supabase */}
      <div className="flex-shrink-0 px-6 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700">
            <span className="text-xs text-slate-400">Supabase user:</span>
            <span className="text-xs font-medium text-slate-200">
              {supabaseUser?.email || "NONE"}
            </span>
            {supabaseUser?.id && (
              <>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs text-slate-400 font-mono">
                  {supabaseUser.id}
                </span>
              </>
            )}
          </div>
          {supabaseUser?.id && (
            <button
              onClick={async () => {
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user?.id) {
                    await navigator.clipboard.writeText(user.id);
                    // Optionnel: afficher un toast ou feedback visuel
                  }
                } catch (err) {
                  console.error("Error copying UID:", err);
                }
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-md hover:bg-slate-700 hover:border-slate-600 transition-colors"
              title="Copier l'UID dans le presse-papiers"
            >
              Copy my Supabase UID
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
      {/* Sidebar gauche - Liste des enseignes */}
      <div className="w-80 flex-shrink-0 h-full overflow-hidden flex flex-col">
        <RestaurantListPanel
          restaurants={restaurants}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedRestaurantId={selectedRestaurantId}
          onSelectRestaurant={handleSelectRestaurant}
          onCreateNew={handleCreateNew}
          loading={loading}
        />
      </div>

      {/* Panel droite - Détails/Édition/Carte ou Création */}
      {showCreateForm ? (
        <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0 p-6">
            <div className="bg-slate-900/80 rounded-2xl p-6 shadow-lg border border-slate-800/60 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Ajouter une nouvelle enseigne</h2>
                <button
                  onClick={resetCreateForm}
                  className="text-xs text-slate-400 hover:text-slate-100"
                >
                  ✕ Fermer
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Nom de l'enseigne</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                    placeholder="Ex : Black & White Burger"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300">
                    Description (optionnel)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                    rows={3}
                    placeholder="Quelques mots sur l'enseigne..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-300">Logo (optionnel)</label>
                  {renderLogoInput(
                    logoImageMode,
                    setLogoImageMode,
                    logoFile,
                    setLogoFile,
                    logoUrl,
                    setLogoUrl,
                    logoPreview,
                    setLogoPreview
                  )}
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-md bg-bitebox px-4 py-2 text-sm font-semibold text-white shadow hover:bg-bitebox-dark disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? "Création en cours..." : "Créer l'enseigne"}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 h-full overflow-hidden">
          <RestaurantDetailsPanel
          selectedRestaurant={selectedRestaurant}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          editingRestaurant={editingRestaurant}
          setEditingRestaurant={setEditingRestaurant}
          editName={editName}
          setEditName={setEditName}
          editDescription={editDescription}
          setEditDescription={setEditDescription}
          editLogoFile={editLogoFile}
          setEditLogoFile={setEditLogoFile}
          editLogoUrl={editLogoUrl}
          setEditLogoUrl={setEditLogoUrl}
          editLogoImageMode={editLogoImageMode}
          setEditLogoImageMode={setEditLogoImageMode}
          editLogoPreview={editLogoPreview}
          setEditLogoPreview={setEditLogoPreview}
          onUpdate={handleUpdateRestaurant}
          onCancelEdit={cancelEditRestaurant}
          validateImageUrl={validateImageUrl}
          validateImageFile={validateImageFile}
          error={error}
          onError={setError}
        />
        </div>
      )}
      </div>
    </div>
  );
}

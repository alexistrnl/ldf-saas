"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Restaurant } from "./types";
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

type ViewMode = "details" | "edit" | "create";

export default function AdminRestaurantsContent() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("details");

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
  }, []);

  // Sélectionner automatiquement la première enseigne au chargement
  useEffect(() => {
    if (restaurants.length > 0 && !selectedRestaurantId && !loading) {
      setSelectedRestaurantId(restaurants[0].id);
      setViewMode("details");
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

      const slug = slugify(name);

      const { error: insertError } = await supabase.from("restaurants").insert({
        name,
        description: description || null,
        logo_url: finalLogoUrl,
        slug,
      });

      if (insertError) {
        console.error("[Admin] insert restaurant error", insertError);
        setError("Erreur lors de la création de l'enseigne.");
        setSaving(false);
        return;
      }

      resetCreateForm();
      await fetchRestaurants();
      
      // Sélectionner la nouvelle enseigne créée
      const { data: newRestaurants } = await supabase
        .from("restaurants")
        .select("*")
        .eq("slug", slug)
        .single();
      
      if (newRestaurants) {
        setSelectedRestaurantId((newRestaurants as Restaurant).id);
        setViewMode("details");
      }
    } catch (err) {
      console.error("[Admin] create restaurant unexpected", err);
      setError("Erreur inattendue lors de la création de l'enseigne.");
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
    setViewMode("edit");
    setSelectedRestaurantId(restaurant.id);
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
    setViewMode("details");
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
        setError("Erreur lors de la suppression de l'enseigne.");
        return;
      }

      // Si l'enseigne supprimée était sélectionnée, sélectionner la suivante ou aucune
      if (selectedRestaurantId === restaurant.id) {
        const remaining = restaurants.filter((r) => r.id !== restaurant.id);
        if (remaining.length > 0) {
          setSelectedRestaurantId(remaining[0].id);
          setViewMode("details");
        } else {
          setSelectedRestaurantId(null);
          setViewMode("details");
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
    setViewMode("details");
    cancelEditRestaurant();
  };

  const handleManageMenu = (restaurant: Restaurant) => {
    window.location.href = `/admin/restaurants?manage=${restaurant.id}`;
  };

  const handleCreateNew = () => {
    resetCreateForm();
    setViewMode("create");
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

  const selectedRestaurant = restaurants.find(
    (r) => r.id === selectedRestaurantId
  ) || null;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 overflow-hidden">
      {/* Sidebar gauche - Liste des enseignes */}
      <div className="w-80 flex-shrink-0">
        <RestaurantListPanel
          restaurants={restaurants}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedRestaurantId={selectedRestaurantId}
          onSelectRestaurant={handleSelectRestaurant}
          onEditRestaurant={startEditRestaurant}
          onDeleteRestaurant={handleDelete}
          onManageMenu={handleManageMenu}
          onCreateNew={handleCreateNew}
          loading={loading}
        />
      </div>

      {/* Panel droite - Détails/Édition/Création */}
      <RestaurantDetailsPanel
        selectedRestaurant={selectedRestaurant}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
        logoFile={logoFile}
        setLogoFile={setLogoFile}
        logoUrl={logoUrl}
        setLogoUrl={setLogoUrl}
        logoImageMode={logoImageMode}
        setLogoImageMode={setLogoImageMode}
        logoPreview={logoPreview}
        setLogoPreview={setLogoPreview}
        saving={saving}
        onCreate={handleCreate}
        onResetCreateForm={resetCreateForm}
        editingRestaurant={editingRestaurant}
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
      />
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Spinner from "@/components/Spinner";

type Restaurant = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  description: string | null;
};

type Dish = {
  id: string;
  restaurant_id: string;
  name: string;
  image_url: string | null;
  description: string | null;
  is_signature: boolean;
  is_limited_edition: boolean;
  position: number | null;
  category_id: string | null;
};

type DishCategory = {
  id: string;
  restaurant_id: string;
  name: string;
  order_index: number;
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // création
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoImageMode, setLogoImageMode] = useState<"upload" | "url">("upload");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // édition restaurant
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editLogoImageMode, setEditLogoImageMode] = useState<"upload" | "url">("upload");
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);

  // gestion des plats
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loadingDishes, setLoadingDishes] = useState(false);

  // gestion des sections de menu
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<DishCategory | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishImageFile, setDishImageFile] = useState<File | null>(null);
  const [dishImageUrl, setDishImageUrl] = useState("");
  const [dishImageMode, setDishImageMode] = useState<"upload" | "url">("upload");
  const [dishImagePreview, setDishImagePreview] = useState<string | null>(null);
  const [dishIsSignature, setDishIsSignature] = useState(false);
  const [dishIsLimitedEdition, setDishIsLimitedEdition] = useState(false);
  const [dishCategoryId, setDishCategoryId] = useState<string | null>(null);

  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [editDishName, setEditDishName] = useState("");
  const [editDishDescription, setEditDishDescription] = useState("");
  const [editDishImageFile, setEditDishImageFile] = useState<File | null>(null);
  const [editDishImageUrl, setEditDishImageUrl] = useState("");
  const [editDishImageMode, setEditDishImageMode] = useState<"upload" | "url">("upload");
  const [editDishImagePreview, setEditDishImagePreview] = useState<string | null>(null);
  const [editDishIsSignature, setEditDishIsSignature] = useState(false);
  const [editDishIsLimitedEdition, setEditDishIsLimitedEdition] = useState(false);
  const [editDishCategoryId, setEditDishCategoryId] = useState<string | null>(null);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  // Nettoyer les URLs d'aperçu pour éviter les fuites mémoire
  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
      if (editLogoPreview && editLogoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(editLogoPreview);
      }
      if (dishImagePreview && dishImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(dishImagePreview);
      }
      if (editDishImagePreview && editDishImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(editDishImagePreview);
      }
    };
  }, [logoPreview, editLogoPreview, dishImagePreview, editDishImagePreview]);

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

  const fetchDishes = async (restaurant: Restaurant) => {
    try {
      setError(null);
      setLoadingDishes(true);

      const { data, error } = await supabase
        .from("dishes")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("position", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

      if (error) {
        console.error("[Admin] dishes error", error);
        setError("Erreur lors du chargement des plats.");
        return;
      }

      const typed = (data || []) as Dish[];
      const sorted = [...typed].sort((a, b) => {
        const posA = a.position ?? Number.MAX_SAFE_INTEGER;
        const posB = b.position ?? Number.MAX_SAFE_INTEGER;
        if (posA !== posB) return posA - posB;
        return a.name.localeCompare(b.name);
      });
      setDishes(sorted);
    } catch (err) {
      console.error("[Admin] dishes unexpected", err);
      setError("Erreur inattendue lors du chargement des plats.");
    } finally {
      setLoadingDishes(false);
    }
  };

  const resetCreateForm = () => {
    setName("");
    setDescription("");
    if (logoPreview && logoPreview.startsWith('blob:')) {
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
        const { error: uploadError } = await supabase
          .storage
          .from("fastfood-images")
          .upload(path, logoFile);

        if (uploadError) {
          console.error("[Admin] upload logo error", uploadError);
          setError("Erreur lors de l'upload du logo.");
          setSaving(false);
          return;
        }

        const { data } = supabase.storage.from("fastfood-images").getPublicUrl(path);
        finalLogoUrl = data.publicUrl;
      }
      // Mode URL : valider et utiliser l'URL
      else if (logoImageMode === "url" && logoUrl.trim()) {
        if (!validateImageUrl(logoUrl)) {
          setError("URL invalide. L'URL doit commencer par http:// ou https:// et avoir une extension .png, .jpg, .jpeg ou .webp");
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
      fetchRestaurants();
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
  };

  const cancelEditRestaurant = () => {
    setEditingRestaurant(null);
    setEditName("");
    setEditDescription("");
    if (editLogoPreview && editLogoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(editLogoPreview);
    }
    setEditLogoFile(null);
    setEditLogoUrl("");
    setEditLogoImageMode("upload");
    setEditLogoPreview(null);
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
        const { error: uploadError } = await supabase
          .storage
          .from("fastfood-images")
          .upload(path, editLogoFile);

        if (uploadError) {
          console.error("[Admin] upload new logo error", uploadError);
          setError("Erreur lors de l'upload du nouveau logo.");
          return;
        }

        const { data } = supabase.storage.from("fastfood-images").getPublicUrl(path);
        finalLogoUrl = data.publicUrl;
      }
      // Mode URL : valider et utiliser l'URL
      else if (editLogoImageMode === "url" && editLogoUrl.trim()) {
        if (!validateImageUrl(editLogoUrl)) {
          setError("URL invalide. L'URL doit commencer par http:// ou https:// et avoir une extension .png, .jpg, .jpeg ou .webp");
          return;
        }
        finalLogoUrl = editLogoUrl.trim();
      }
      // Si on est en mode URL mais que l'URL est vide, on garde l'ancienne
      else if (editLogoImageMode === "url" && !editLogoUrl.trim()) {
        // Garder l'URL existante
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
      fetchRestaurants();
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
        setError("Impossible de supprimer les plats avant l’enseigne.");
        return;
      }

      const { error } = await supabase
        .from("restaurants")
        .delete()
        .eq("id", restaurant.id);

      if (error) {
        console.error("[Admin] delete restaurant error", error);
        setError("Erreur lors de la suppression de l’enseigne.");
        return;
      }

      if (selectedRestaurant?.id === restaurant.id) {
        setSelectedRestaurant(null);
        setDishes([]);
      }

      if (editingRestaurant?.id === restaurant.id) {
        cancelEditRestaurant();
      }

      setRestaurants((prev) => prev.filter((r) => r.id !== restaurant.id));
    } catch (err) {
      console.error("[Admin] delete restaurant unexpected", err);
      setError("Erreur inattendue lors de la suppression de l’enseigne.");
    }
  };

  const handleSelectRestaurant = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setDishName("");
    setDishDescription("");
    if (dishImagePreview && dishImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(dishImagePreview);
    }
    setDishImageFile(null);
    setDishImageUrl("");
    setDishImageMode("upload");
    setDishImagePreview(null);
    setDishIsSignature(false);
    setDishIsLimitedEdition(false);
    setDishCategoryId(null);
    setEditingDish(null);
    setShowCategoryForm(false);
    setNewCategoryName("");
    setCategoryError(null);
    fetchDishes(restaurant);
    fetchCategories(restaurant);
  };

  const handleCloseDishes = () => {
    setSelectedRestaurant(null);
    setDishes([]);
    setCategories([]);
    setEditingDish(null);
    setShowCategoryForm(false);
  };

  // Fonctions de gestion des sections de menu
  const fetchCategories = async (restaurant: Restaurant) => {
    try {
      setLoadingCategories(true);
      const { data, error } = await supabase
        .from("dish_categories")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("order_index", { ascending: true });

      if (error) {
        console.error("[Admin] categories error", error);
        setError("Erreur lors du chargement des sections.");
        return;
      }

      setCategories((data || []) as DishCategory[]);
    } catch (err) {
      console.error("[Admin] categories unexpected", err);
      setError("Erreur inattendue lors du chargement des sections.");
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("[Admin] handleCreateCategory appelé");
    console.log("[Admin] selectedRestaurant:", selectedRestaurant);
    console.log("[Admin] newCategoryName:", newCategoryName);
    
    if (!selectedRestaurant) {
      console.error("[Admin] Pas de restaurant sélectionné");
      setCategoryError("Aucun restaurant sélectionné.");
      return;
    }
    
    if (!newCategoryName.trim()) {
      console.log("[Admin] Nom de catégorie vide, on ignore");
      return;
    }

    try {
      setCategoryError(null);
      setError(null);

      // Calculer le prochain order_index de manière plus robuste
      const nextOrderIndex =
        categories.length === 0
          ? 0
          : (categories.reduce((max, c) => Math.max(max, c.order_index ?? 0), 0) ?? 0) + 1;

      console.log("[Admin] Restaurant ID:", selectedRestaurant.id);
      console.log("[Admin] Nom de la catégorie:", newCategoryName.trim());
      console.log("[Admin] Order index calculé:", nextOrderIndex);
      console.log("[Admin] Catégories existantes:", categories);

      const { data, error: insertError } = await supabase
        .from("dish_categories")
        .insert({
          restaurant_id: selectedRestaurant.id,
          name: newCategoryName.trim(),
          order_index: nextOrderIndex,
        })
        .select("*")
        .single();

      console.log("[Admin] Résultat Supabase - data:", data);
      console.log("[Admin] Résultat Supabase - error:", insertError);

      if (insertError) {
        console.error("[Admin] Erreur création catégorie :", insertError);
        setCategoryError(insertError.message || "Erreur lors de la création de la section.");
        return;
      }

      // Ajouter la nouvelle catégorie au state
      if (data) {
        console.log("[Admin] Catégorie créée avec succès, ajout au state");
        setCategories((prev) => [...prev, data as DishCategory]);
        setNewCategoryName("");
        setShowCategoryForm(false);
        setCategoryError(null);
      } else {
        console.error("[Admin] Aucune donnée retournée par Supabase");
        setCategoryError("Aucune donnée retournée après la création.");
      }
    } catch (err) {
      console.error("[Admin] Erreur inattendue création catégorie :", err);
      setCategoryError("Une erreur inattendue est survenue lors de la création de la section.");
    }
  };

  const startEditCategory = (category: DishCategory) => {
    setEditingCategory(category);
    setEditCategoryName(category.name);
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
    setEditCategoryName("");
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editCategoryName.trim()) return;

    try {
      setError(null);

      const { error: updateError } = await supabase
        .from("dish_categories")
        .update({ name: editCategoryName.trim() })
        .eq("id", editingCategory.id);

      if (updateError) {
        console.error("[Admin] update category error", updateError);
        setError("Erreur lors de la mise à jour de la section.");
        return;
      }

      cancelEditCategory();
      if (selectedRestaurant) {
        fetchCategories(selectedRestaurant);
      }
    } catch (err) {
      console.error("[Admin] update category unexpected", err);
      setError("Erreur inattendue lors de la mise à jour de la section.");
    }
  };

  const handleDeleteCategory = async (category: DishCategory) => {
    if (!selectedRestaurant) return;

    // Vérifier si la section contient des plats
    const dishesInCategory = dishes.filter((d) => d.category_id === category.id);
    if (dishesInCategory.length > 0) {
      setError(
        `Impossible de supprimer la section "${category.name}" car elle contient ${dishesInCategory.length} plat(s). Déplacez d'abord les plats vers une autre section.`
      );
      return;
    }

    if (!confirm(`Supprimer la section "${category.name}" ?`)) return;

    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from("dish_categories")
        .delete()
        .eq("id", category.id);

      if (deleteError) {
        console.error("[Admin] delete category error", deleteError);
        setError("Erreur lors de la suppression de la section.");
        return;
      }

      if (selectedRestaurant) {
        fetchCategories(selectedRestaurant);
      }
    } catch (err) {
      console.error("[Admin] delete category unexpected", err);
      setError("Erreur inattendue lors de la suppression de la section.");
    }
  };

  const moveCategoryUp = async (category: DishCategory) => {
    if (!selectedRestaurant) return;
    const index = categories.findIndex((c) => c.id === category.id);
    if (index <= 0) return;
    const previous = categories[index - 1];

    try {
      const { error: err1 } = await supabase
        .from("dish_categories")
        .update({ order_index: previous.order_index })
        .eq("id", category.id);
      const { error: err2 } = await supabase
        .from("dish_categories")
        .update({ order_index: category.order_index })
        .eq("id", previous.id);

      if (err1 || err2) {
        console.error("[Admin] move category up error", err1 || err2);
        setError("Erreur lors du changement d'ordre de la section.");
        return;
      }

      fetchCategories(selectedRestaurant);
    } catch (err) {
      console.error("[Admin] moveCategoryUp unexpected", err);
      setError("Erreur inattendue lors du changement d'ordre de la section.");
    }
  };

  const moveCategoryDown = async (category: DishCategory) => {
    if (!selectedRestaurant) return;
    const index = categories.findIndex((c) => c.id === category.id);
    if (index === -1 || index >= categories.length - 1) return;
    const next = categories[index + 1];

    try {
      const { error: err1 } = await supabase
        .from("dish_categories")
        .update({ order_index: next.order_index })
        .eq("id", category.id);
      const { error: err2 } = await supabase
        .from("dish_categories")
        .update({ order_index: category.order_index })
        .eq("id", next.id);

      if (err1 || err2) {
        console.error("[Admin] move category down error", err1 || err2);
        setError("Erreur lors du changement d'ordre de la section.");
        return;
      }

      fetchCategories(selectedRestaurant);
    } catch (err) {
      console.error("[Admin] moveCategoryDown unexpected", err);
      setError("Erreur inattendue lors du changement d'ordre de la section.");
    }
  };

  // Fonction pour changer la catégorie d'un plat
  const handleChangeDishCategory = async (dish: Dish, newCategoryId: string | null) => {
    if (!selectedRestaurant) return;

    try {
      setError(null);

      const { error: updateError } = await supabase
        .from("dishes")
        .update({ category_id: newCategoryId })
        .eq("id", dish.id);

      if (updateError) {
        console.error("[Admin] update dish category error", updateError);
        setError("Erreur lors de la modification de la section du plat.");
        return;
      }

      // Mettre à jour le state local
      setDishes((prev) =>
        prev.map((d) => (d.id === dish.id ? { ...d, category_id: newCategoryId } : d))
      );
    } catch (err) {
      console.error("[Admin] changeDishCategory unexpected", err);
      setError("Erreur inattendue lors de la modification de la section du plat.");
    }
  };

  const handleAddDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestaurant) return;

    try {
      setError(null);

      if (!dishName.trim()) {
        setError("Le nom du plat est obligatoire.");
        return;
      }

      let finalImageUrl: string | null = null;

      // Mode upload : uploader le fichier
      if (dishImageMode === "upload" && dishImageFile) {
        const fileError = validateImageFile(dishImageFile);
        if (fileError) {
          setError(fileError);
          return;
        }

        const path = `dishes/${selectedRestaurant.id}/${Date.now()}-${dishImageFile.name}`;
        const { error: uploadError } = await supabase
          .storage
          .from("fastfood-images")
          .upload(path, dishImageFile);

        if (uploadError) {
          console.error("[Admin] upload dish image error", uploadError);
          setError("Erreur lors de l'upload de l'image du plat.");
          return;
        }

        const { data } = supabase.storage.from("fastfood-images").getPublicUrl(path);
        finalImageUrl = data.publicUrl;
      }
      // Mode URL : valider et utiliser l'URL
      else if (dishImageMode === "url" && dishImageUrl.trim()) {
        if (!validateImageUrl(dishImageUrl)) {
          setError("URL invalide. L'URL doit commencer par http:// ou https:// et avoir une extension .png, .jpg, .jpeg ou .webp");
          return;
        }
        finalImageUrl = dishImageUrl.trim();
      }

      const nextPosition =
        dishes.length === 0
          ? 0
          : Math.max(...dishes.map((d) => d.position ?? 0)) + 1;

      const { error: insertError } = await supabase.from("dishes").insert({
        restaurant_id: selectedRestaurant.id,
        name: dishName,
        description: dishDescription || null,
        image_url: finalImageUrl,
        is_signature: dishIsSignature,
        is_limited_edition: dishIsLimitedEdition,
        position: nextPosition,
        category_id: dishCategoryId || null,
      });

      if (insertError) {
        console.error("[Admin] insert dish error", insertError);
        setError("Erreur lors de l'ajout du plat.");
        return;
      }

      setDishName("");
      setDishDescription("");
      if (dishImagePreview && dishImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(dishImagePreview);
      }
      setDishImageFile(null);
      setDishImageUrl("");
      setDishImageMode("upload");
      setDishImagePreview(null);
      setDishIsSignature(false);
      setDishIsLimitedEdition(false);
      setDishCategoryId(null);

      fetchDishes(selectedRestaurant);
    } catch (err) {
      console.error("[Admin] add dish unexpected", err);
      setError("Erreur inattendue lors de l'ajout du plat.");
    }
  };

  const startEditDish = (dish: Dish) => {
    setEditingDish(dish);
    setEditDishName(dish.name);
    setEditDishDescription(dish.description || "");
    setEditDishIsSignature(dish.is_signature);
    setEditDishIsLimitedEdition(dish.is_limited_edition ?? false);
    setEditDishCategoryId(dish.category_id);
    setEditDishImageFile(null);
    setEditDishImageUrl("");
    setEditDishImageMode("upload");
    setEditDishImagePreview(dish.image_url);
  };

  const cancelEditDish = () => {
    setEditingDish(null);
    setEditDishName("");
    setEditDishDescription("");
    setEditDishIsSignature(false);
    setEditDishIsLimitedEdition(false);
    if (editDishImagePreview && editDishImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(editDishImagePreview);
    }
    setEditDishImageFile(null);
    setEditDishImageUrl("");
    setEditDishImageMode("upload");
    setEditDishImagePreview(null);
  };

  const handleUpdateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDish || !selectedRestaurant) return;

    try {
      if (!editDishName.trim()) {
        setError("Le nom du plat est obligatoire.");
        return;
      }

      let finalImageUrl: string | null = editingDish.image_url ?? null;

      // Mode upload : uploader le fichier
      if (editDishImageMode === "upload" && editDishImageFile) {
        const fileError = validateImageFile(editDishImageFile);
        if (fileError) {
          setError(fileError);
          return;
        }

        const path = `dishes/${selectedRestaurant.id}/${Date.now()}-${editDishImageFile.name}`;
        const { error: uploadError } = await supabase
          .storage
          .from("fastfood-images")
          .upload(path, editDishImageFile);

        if (uploadError) {
          console.error("[Admin] upload new dish image error", uploadError);
          setError("Erreur lors de l'upload de la nouvelle image.");
          return;
        }

        const { data } = supabase.storage.from("fastfood-images").getPublicUrl(path);
        finalImageUrl = data.publicUrl;
      }
      // Mode URL : valider et utiliser l'URL
      else if (editDishImageMode === "url" && editDishImageUrl.trim()) {
        if (!validateImageUrl(editDishImageUrl)) {
          setError("URL invalide. L'URL doit commencer par http:// ou https:// et avoir une extension .png, .jpg, .jpeg ou .webp");
          return;
        }
        finalImageUrl = editDishImageUrl.trim();
      }
      // Si on est en mode URL mais que l'URL est vide, on garde l'ancienne
      else if (editDishImageMode === "url" && !editDishImageUrl.trim()) {
        // Garder l'URL existante
      }

      const { error: updateError } = await supabase
        .from("dishes")
        .update({
          name: editDishName,
          description: editDishDescription || null,
          image_url: finalImageUrl,
          is_signature: editDishIsSignature,
          is_limited_edition: editDishIsLimitedEdition,
          category_id: editDishCategoryId || null,
        })
        .eq("id", editingDish.id);

      if (updateError) {
        console.error("[Admin] update dish error", updateError);
        setError("Erreur lors de la mise à jour du plat.");
        return;
      }

      cancelEditDish();
      fetchDishes(selectedRestaurant);
    } catch (err) {
      console.error("[Admin] update dish unexpected", err);
      setError("Erreur inattendue lors de la mise à jour du plat.");
    }
  };

  const handleDeleteDish = async (dish: Dish) => {
    if (!confirm(`Supprimer le plat "${dish.name}" ?`)) return;
    if (!selectedRestaurant) return;

    try {
      const { error } = await supabase.from("dishes").delete().eq("id", dish.id);

      if (error) {
        console.error("[Admin] delete dish error", error);
        setError("Erreur lors de la suppression du plat.");
        return;
      }

      fetchDishes(selectedRestaurant);
    } catch (err) {
      console.error("[Admin] delete dish unexpected", err);
      setError("Erreur inattendue lors de la suppression du plat.");
    }
  };

  const moveDishUp = async (dish: Dish) => {
    if (!selectedRestaurant) return;
    const index = dishes.findIndex((d) => d.id === dish.id);
    if (index <= 0) return;
    const previous = dishes[index - 1];
    const currentPosition = dish.position ?? index;
    const previousPosition = previous.position ?? index - 1;

    try {
      const { error: err1 } = await supabase
        .from("dishes")
        .update({ position: previousPosition })
        .eq("id", dish.id);
      const { error: err2 } = await supabase
        .from("dishes")
        .update({ position: currentPosition })
        .eq("id", previous.id);

      if (err1 || err2) {
        console.error("[Admin] move dish up error", err1 || err2);
        setError("Erreur lors du changement d’ordre du plat.");
        return;
      }

      fetchDishes(selectedRestaurant);
    } catch (err) {
      console.error("[Admin] moveDishUp unexpected", err);
      setError("Erreur inattendue lors du changement d’ordre du plat.");
    }
  };

  const moveDishDown = async (dish: Dish) => {
    if (!selectedRestaurant) return;
    const index = dishes.findIndex((d) => d.id === dish.id);
    if (index === -1 || index >= dishes.length - 1) return;
    const next = dishes[index + 1];
    const currentPosition = dish.position ?? index;
    const nextPosition = next.position ?? index + 1;

    try {
      const { error: err1 } = await supabase
        .from("dishes")
        .update({ position: nextPosition })
        .eq("id", dish.id);
      const { error: err2 } = await supabase
        .from("dishes")
        .update({ position: currentPosition })
        .eq("id", next.id);

      if (err1 || err2) {
        console.error("[Admin] move dish down error", err1 || err2);
        setError("Erreur lors du changement d'ordre du plat.");
        return;
      }

      fetchDishes(selectedRestaurant);
    } catch (err) {
      console.error("[Admin] moveDishDown unexpected", err);
      setError("Erreur inattendue lors du changement d'ordre du plat.");
    }
  };

  // Fonctions de validation
  const validateImageUrl = (url: string): boolean => {
    if (!url.trim()) return true; // URL vide est valide (optionnel)
    
    // Vérifier que l'URL commence par http ou https
    if (!url.match(/^https?:\/\//i)) {
      return false;
    }

    // Vérifier l'extension de l'image
    const validExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    const urlLower = url.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => urlLower.includes(ext));
    
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
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return "Format d'image non accepté. Formats acceptés : PNG, JPG, JPEG, WEBP.";
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10">
        <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl font-bold">Administration des enseignes</h1>
          <p className="text-sm text-slate-300 mt-1">
            Ajoute, liste, modifie et gère la carte de chaque enseigne.
          </p>
        </header>

        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Création */}
        <section className="bg-slate-900/80 rounded-2xl p-5 shadow-lg border border-slate-800/60 space-y-4">
          <h2 className="text-lg font-semibold">Ajouter une nouvelle enseigne</h2>

          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Nom de l’enseigne</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                placeholder="Ex : Black & White Burger"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">Description (optionnel)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                rows={3}
                placeholder="Quelques mots sur l’enseigne..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-300">Logo (optionnel)</label>
              
              {/* Tabs pour choisir entre upload et URL */}
              <div className="flex gap-2 border-b border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      if (logoPreview && logoPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(logoPreview);
                      }
                      setLogoImageMode("upload");
                      setLogoUrl("");
                      setLogoPreview(null);
                    }}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    logoImageMode === "upload"
                      ? "text-bitebox border-b-2 border-bitebox"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Télécharger un fichier
                </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (logoPreview && logoPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(logoPreview);
                      }
                      setLogoImageMode("url");
                      setLogoFile(null);
                      setLogoPreview(null);
                    }}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    logoImageMode === "url"
                      ? "text-bitebox border-b-2 border-bitebox"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Entrer une URL
                </button>
              </div>

              {/* Champ upload */}
              {logoImageMode === "upload" && (
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      // Nettoyer l'ancienne URL blob si elle existe
                      if (logoPreview && logoPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(logoPreview);
                      }
                      setLogoFile(file);
                      setLogoUrl("");
                      if (file) {
                        const preview = URL.createObjectURL(file);
                        setLogoPreview(preview);
                      } else {
                        setLogoPreview(null);
                      }
                    }}
                    className="text-xs text-slate-300"
                  />
                  <p className="text-[11px] text-slate-500">
                    Formats acceptés : PNG, JPG, JPEG, WEBP (max 5MB)
                  </p>
                </div>
              )}

              {/* Champ URL */}
              {logoImageMode === "url" && (
                <div className="space-y-2">
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => {
                      const url = e.target.value;
                      setLogoUrl(url);
                      setLogoFile(null);
                      if (url && validateImageUrl(url)) {
                        setLogoPreview(url);
                      } else {
                        setLogoPreview(null);
                      }
                    }}
                    placeholder="https://exemple.com/image.png"
                    className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                  />
                  <p className="text-[11px] text-slate-500">
                    URL commençant par http:// ou https:// avec extension .png, .jpg, .jpeg ou .webp
                  </p>
                </div>
              )}

              {/* Aperçu de l'image */}
              {logoPreview && (
                <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">Aperçu :</p>
                  <img
                    src={logoPreview}
                    alt="Aperçu logo"
                    className="max-w-full h-32 object-contain rounded"
                    onError={() => setLogoPreview(null)}
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md bg-bitebox px-4 py-2 text-sm font-semibold text-white shadow hover:bg-bitebox-dark disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Création en cours..." : "Créer l’enseigne"}
            </button>
          </form>
        </section>

        {/* Liste */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Enseignes existantes</h2>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : restaurants.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune enseigne pour l’instant.</p>
          ) : (
            <div className="space-y-2">
              {restaurants.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/70 rounded-xl px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    {r.logo_url && (
                      <img
                        src={r.logo_url}
                        alt={r.name}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="text-sm font-semibold">{r.name}</p>
                      {r.slug && (
                        <p className="text-[11px] text-slate-400">
                          /restaurants/{r.slug}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleSelectRestaurant(r)}
                      className="text-xs rounded-md border border-slate-600 px-3 py-1 hover:bg-slate-800"
                    >
                      Gérer la carte
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditRestaurant(r)}
                      className="text-xs rounded-md border border-bitebox/60 px-3 py-1 hover:bg-bitebox/10"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      className="text-xs rounded-md border border-red-500/60 px-3 py-1 text-red-300 hover:bg-red-500/10"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Bloc édition */}
        {editingRestaurant && (
          <section className="bg-slate-900/80 rounded-2xl p-5 shadow-lg border border-slate-700/70 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Modifier l’enseigne : {editingRestaurant.name}
              </h2>
              <button
                type="button"
                onClick={cancelEditRestaurant}
                className="text-xs text-slate-400 hover:text-slate-100"
              >
                Annuler
              </button>
            </div>

            <form onSubmit={handleUpdateRestaurant} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-300">Nom de l’enseigne</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">Description (optionnel)</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-300">Nouveau logo (optionnel)</label>
                
                {/* Tabs pour choisir entre upload et URL */}
                <div className="flex gap-2 border-b border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      if (editLogoPreview && editLogoPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(editLogoPreview);
                      }
                      setEditLogoImageMode("upload");
                      setEditLogoUrl("");
                      setEditLogoPreview(editingRestaurant?.logo_url ?? null);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium transition ${
                      editLogoImageMode === "upload"
                        ? "text-bitebox border-b-2 border-bitebox"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Télécharger un fichier
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (editLogoPreview && editLogoPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(editLogoPreview);
                      }
                      setEditLogoImageMode("url");
                      setEditLogoFile(null);
                      setEditLogoPreview(editingRestaurant?.logo_url ?? null);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium transition ${
                      editLogoImageMode === "url"
                        ? "text-bitebox border-b-2 border-bitebox"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Entrer une URL
                  </button>
                </div>

                {/* Champ upload */}
                {editLogoImageMode === "upload" && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        // Nettoyer l'ancienne URL blob si elle existe
                        if (editLogoPreview && editLogoPreview.startsWith('blob:')) {
                          URL.revokeObjectURL(editLogoPreview);
                        }
                        setEditLogoFile(file);
                        setEditLogoUrl("");
                        if (file) {
                          const preview = URL.createObjectURL(file);
                          setEditLogoPreview(preview);
                        } else {
                          setEditLogoPreview(editingRestaurant?.logo_url ?? null);
                        }
                      }}
                      className="text-xs text-slate-300"
                    />
                    <p className="text-[11px] text-slate-500">
                      Formats acceptés : PNG, JPG, JPEG, WEBP (max 5MB). Laisse vide pour conserver le logo actuel.
                    </p>
                  </div>
                )}

                {/* Champ URL */}
                {editLogoImageMode === "url" && (
                  <div className="space-y-2">
                    <input
                      type="url"
                      value={editLogoUrl}
                      onChange={(e) => {
                        const url = e.target.value;
                        setEditLogoUrl(url);
                        setEditLogoFile(null);
                        if (url && validateImageUrl(url)) {
                          setEditLogoPreview(url);
                        } else if (!url) {
                          setEditLogoPreview(editingRestaurant?.logo_url ?? null);
                        } else {
                          setEditLogoPreview(null);
                        }
                      }}
                      placeholder="https://exemple.com/image.png"
                      className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                    />
                    <p className="text-[11px] text-slate-500">
                      URL commençant par http:// ou https:// avec extension .png, .jpg, .jpeg ou .webp. Laisse vide pour conserver le logo actuel.
                    </p>
                  </div>
                )}

                {/* Aperçu de l'image */}
                {editLogoPreview && (
                  <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 mb-2">Aperçu :</p>
                    <img
                      src={editLogoPreview}
                      alt="Aperçu logo"
                      className="max-w-full h-32 object-contain rounded"
                      onError={() => setEditLogoPreview(editingRestaurant?.logo_url ?? null)}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black shadow hover:bg-emerald-400 transition"
                >
                  Enregistrer les modifications
                </button>
                <button
                  type="button"
                  onClick={cancelEditRestaurant}
                  className="text-xs text-slate-300 hover:text-slate-100"
                >
                  Annuler
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Carte */}
        {selectedRestaurant && (
          <section className="bg-slate-900/80 rounded-2xl p-5 shadow-lg border border-slate-800/60 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Carte de : {selectedRestaurant.name}
              </h2>
              <button
                type="button"
                onClick={handleCloseDishes}
                className="text-xs text-slate-400 hover:text-slate-100"
              >
                Fermer
              </button>
            </div>

            {/* Organisation de la carte - Sections */}
            <div className="border-t border-slate-800 pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-semibold">Organisation de la carte</h3>
                {!showCategoryForm && (
                  <button
                    type="button"
                    onClick={() => setShowCategoryForm(true)}
                    className="text-xs rounded-md border border-bitebox/60 px-3 py-1.5 hover:bg-bitebox/10 text-bitebox"
                  >
                    ➕ Ajouter une section
                  </button>
                )}
              </div>

              {/* Formulaire d'ajout de section */}
              {showCategoryForm && (
                <form onSubmit={handleCreateCategory} className="bg-slate-950/70 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => {
                        setNewCategoryName(e.target.value);
                        setCategoryError(null);
                      }}
                      placeholder="Nom de la section (ex: Burgers)"
                      className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 rounded-md bg-bitebox text-white text-xs font-semibold hover:bg-bitebox-dark"
                    >
                      Créer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryForm(false);
                        setNewCategoryName("");
                        setCategoryError(null);
                      }}
                      className="px-3 py-2 rounded-md border border-slate-600 text-slate-300 text-xs hover:bg-slate-800"
                    >
                      Annuler
                    </button>
                  </div>
                  {categoryError && (
                    <p className="mt-2 text-sm text-red-400">
                      {categoryError}
                    </p>
                  )}
                </form>
              )}

              {/* Liste des sections */}
              {loadingCategories ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" />
                </div>
              ) : categories.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Aucune section créée. Les plats seront affichés dans un bloc unique.
                </p>
              ) : (
                <div className="space-y-2">
                  {categories.map((category) => {
                    const dishesCount = dishes.filter((d) => d.category_id === category.id).length;
                    return (
                      <div
                        key={category.id}
                        className="flex items-center justify-between gap-3 bg-slate-950/70 rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => moveCategoryUp(category)}
                              disabled={categories.indexOf(category) === 0}
                              className="text-[10px] border border-slate-600 rounded px-1.5 py-0.5 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveCategoryDown(category)}
                              disabled={categories.indexOf(category) === categories.length - 1}
                              className="text-[10px] border border-slate-600 rounded px-1.5 py-0.5 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              ↓
                            </button>
                          </div>
                          {editingCategory?.id === category.id ? (
                            <form
                              onSubmit={handleUpdateCategory}
                              className="flex items-center gap-2 flex-1"
                            >
                              <input
                                type="text"
                                value={editCategoryName}
                                onChange={(e) => setEditCategoryName(e.target.value)}
                                className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs outline-none focus:border-bitebox"
                                autoFocus
                              />
                              <button
                                type="submit"
                                className="px-2 py-1 rounded text-xs bg-emerald-500 text-black hover:bg-emerald-400"
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditCategory}
                                className="px-2 py-1 rounded text-xs border border-slate-600 hover:bg-slate-800"
                              >
                                ✕
                              </button>
                            </form>
                          ) : (
                            <>
                              <span className="text-sm font-medium">{category.name}</span>
                              <span className="text-xs text-slate-400">
                                ({dishesCount} plat{dishesCount !== 1 ? "s" : ""})
                              </span>
                            </>
                          )}
                        </div>
                        {editingCategory?.id !== category.id && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEditCategory(category)}
                              className="text-[10px] rounded border border-bitebox/60 px-2 py-1 hover:bg-bitebox/10"
                            >
                              Renommer
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(category)}
                              className="text-[10px] rounded border border-red-500/60 px-2 py-1 text-red-300 hover:bg-red-500/10"
                            >
                              Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Liste des plats groupés par catégorie */}
            {loadingDishes ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : dishes.length === 0 ? (
              <p className="text-sm text-slate-400">
                Aucun plat enregistré pour cette enseigne.
              </p>
            ) : (
              <div className="space-y-6 border-t border-slate-800 pt-4">
                {/* Plats groupés par catégorie */}
                {categories.map((category) => {
                  const categoryDishes = dishes.filter((d) => d.category_id === category.id);
                  if (categoryDishes.length === 0) return null;

                  return (
                    <div key={category.id} className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
                        {category.name}
                      </h3>
                      <div className="space-y-2">
                        {categoryDishes.map((dish) => (
                          <div
                            key={dish.id}
                            className="bg-slate-950/70 rounded-xl px-3 py-3 space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1">
                                {dish.image_url && (
                                  <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-[#0d0d12]">
                                    <img
                                      src={dish.image_url}
                                      alt={dish.name}
                                      className="absolute inset-0 w-full h-full object-cover object-center scale-90"
                                    />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <p className="text-sm font-semibold">{dish.name}</p>
                                  {dish.description && (
                                    <p className="text-[11px] text-slate-400">
                                      {dish.description}
                                    </p>
                                  )}
                                  {dish.is_signature && (
                                    <span className="inline-flex items-center rounded-full bg-bitebox/90 text-white text-[9px] font-semibold px-2 py-[1px] mt-1">
                                      Plat signature
                                    </span>
                                  )}
                                  {dish.is_limited_edition && (
                                    <span className="inline-flex items-center rounded-full bg-amber-500/90 text-white text-[9px] font-semibold px-2 py-[1px] mt-1">
                                      Édition limitée
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                                {/* Select pour changer la catégorie */}
                                <select
                                  value={dish.category_id || ""}
                                  onChange={(e) =>
                                    handleChangeDishCategory(dish, e.target.value || null)
                                  }
                                  className="text-[11px] rounded-md bg-slate-900 border border-slate-700 px-2 py-1 outline-none focus:border-bitebox"
                                >
                                  <option value="">Aucune section</option>
                                  {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => moveDishUp(dish)}
                                  className="text-[11px] border border-slate-600 rounded px-2 py-[1px] hover:bg-slate-800"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveDishDown(dish)}
                                  className="text-[11px] border border-slate-600 rounded px-2 py-[1px] hover:bg-slate-800"
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditDish(dish)}
                                  className="text-[11px] rounded-md border border-bitebox/60 px-3 py-1 hover:bg-bitebox/10"
                                >
                                  Modifier
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDish(dish)}
                                  className="text-[11px] rounded-md border border-red-500/60 px-3 py-1 text-red-300 hover:bg-red-500/10"
                                >
                                  Supprimer
                                </button>
                              </div>
                            </div>

                            {editingDish?.id === dish.id && (
                              <form onSubmit={handleUpdateDish} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-800 pt-3">
                                <div className="space-y-1">
                                  <label className="text-xs text-slate-300">Nom du plat</label>
                                  <input
                                    type="text"
                                    value={editDishName}
                                    onChange={(e) => setEditDishName(e.target.value)}
                                    className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs text-slate-300">
                                    Description (optionnel)
                                  </label>
                                  <input
                                    type="text"
                                    value={editDishDescription}
                                    onChange={(e) => setEditDishDescription(e.target.value)}
                                    className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <label className="text-xs text-slate-300">
                                    Nouvelle image (optionnel)
                                  </label>
                                  
                                  {/* Tabs pour choisir entre upload et URL */}
                                  <div className="flex gap-2 border-b border-slate-700">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (editDishImagePreview && editDishImagePreview.startsWith('blob:')) {
                                          URL.revokeObjectURL(editDishImagePreview);
                                        }
                                        setEditDishImageMode("upload");
                                        setEditDishImageUrl("");
                                        setEditDishImagePreview(editingDish?.image_url ?? null);
                                      }}
                                      className={`px-3 py-1.5 text-xs font-medium transition ${
                                        editDishImageMode === "upload"
                                          ? "text-bitebox border-b-2 border-bitebox"
                                          : "text-slate-400 hover:text-slate-200"
                                      }`}
                                    >
                                      Télécharger un fichier
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (editDishImagePreview && editDishImagePreview.startsWith('blob:')) {
                                          URL.revokeObjectURL(editDishImagePreview);
                                        }
                                        setEditDishImageMode("url");
                                        setEditDishImageFile(null);
                                        setEditDishImagePreview(editingDish?.image_url ?? null);
                                      }}
                                      className={`px-3 py-1.5 text-xs font-medium transition ${
                                        editDishImageMode === "url"
                                          ? "text-bitebox border-b-2 border-bitebox"
                                          : "text-slate-400 hover:text-slate-200"
                                      }`}
                                    >
                                      Entrer une URL
                                    </button>
                                  </div>

                                  {/* Champ upload */}
                                  {editDishImageMode === "upload" && (
                                    <div className="space-y-2">
                                      <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/jpg,image/webp"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0] ?? null;
                                          // Nettoyer l'ancienne URL blob si elle existe
                                          if (editDishImagePreview && editDishImagePreview.startsWith('blob:')) {
                                            URL.revokeObjectURL(editDishImagePreview);
                                          }
                                          setEditDishImageFile(file);
                                          setEditDishImageUrl("");
                                          if (file) {
                                            const preview = URL.createObjectURL(file);
                                            setEditDishImagePreview(preview);
                                          } else {
                                            setEditDishImagePreview(editingDish?.image_url ?? null);
                                          }
                                        }}
                                        className="text-xs text-slate-300"
                                      />
                                      <p className="text-[11px] text-slate-500">
                                        Formats acceptés : PNG, JPG, JPEG, WEBP (max 5MB). Laisse vide pour conserver l'image actuelle.
                                      </p>
                                    </div>
                                  )}

                                  {/* Champ URL */}
                                  {editDishImageMode === "url" && (
                                    <div className="space-y-2">
                                      <input
                                        type="url"
                                        value={editDishImageUrl}
                                        onChange={(e) => {
                                          const url = e.target.value;
                                          setEditDishImageUrl(url);
                                          setEditDishImageFile(null);
                                          if (url && validateImageUrl(url)) {
                                            setEditDishImagePreview(url);
                                          } else if (!url) {
                                            setEditDishImagePreview(editingDish?.image_url ?? null);
                                          } else {
                                            setEditDishImagePreview(null);
                                          }
                                        }}
                                        placeholder="https://exemple.com/image.png"
                                        className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                                      />
                                      <p className="text-[11px] text-slate-500">
                                        URL commençant par http:// ou https:// avec extension .png, .jpg, .jpeg ou .webp. Laisse vide pour conserver l'image actuelle.
                                      </p>
                                    </div>
                                  )}

                                  {/* Aperçu de l'image */}
                                  {editDishImagePreview && (
                                    <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-700">
                                      <p className="text-xs text-slate-400 mb-2">Aperçu :</p>
                                      <div className="relative h-32 w-full overflow-hidden rounded-xl bg-[#0d0d12]">
                                        <img
                                          src={editDishImagePreview}
                                          alt="Aperçu plat"
                                          className="absolute inset-0 w-full h-full object-cover object-center scale-90"
                                          onError={() => setEditDishImagePreview(editingDish?.image_url ?? null)}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <div className="space-y-1">
                                    <label className="text-xs text-slate-300">Section (optionnel)</label>
                                    <select
                                      value={editDishCategoryId || ""}
                                      onChange={(e) => setEditDishCategoryId(e.target.value || null)}
                                      className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                                    >
                                      <option value="">Aucune section</option>
                                      {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                          {cat.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <label className="flex items-center gap-2 text-xs text-slate-300">
                                    <input
                                      type="checkbox"
                                      checked={editDishIsSignature}
                                      onChange={(e) => setEditDishIsSignature(e.target.checked)}
                                      className="h-3 w-3"
                                    />
                                    Plat signature
                                  </label>
                                  <div className="flex flex-col gap-1">
                                    <label className="flex items-center gap-2 text-xs text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={editDishIsLimitedEdition}
                                        onChange={(e) => setEditDishIsLimitedEdition(e.target.checked)}
                                        className="h-3 w-3"
                                      />
                                      Édition limitée
                                    </label>
                                    <p className="text-[10px] text-slate-500 ml-5">
                                      Plat disponible pour une durée limitée / collab spéciale, peut ne plus être au menu plus tard.
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="submit"
                                      className="inline-flex items-center justify-center rounded-md bg-bitebox px-4 py-2 text-xs font-semibold text-white shadow hover:bg-bitebox-dark transition"
                                    >
                                      Enregistrer
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditDish}
                                      className="text-[11px] text-slate-300 hover:text-slate-100"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                </div>
                              </form>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Plats sans catégorie */}
                {(() => {
                  const dishesWithoutCategory = dishes.filter((d) => !d.category_id);
                  if (dishesWithoutCategory.length === 0) return null;

                  return (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
                        Autres plats
                      </h3>
                      <div className="space-y-2">
                        {dishesWithoutCategory.map((dish) => (
                          <div
                            key={dish.id}
                            className="bg-slate-950/70 rounded-xl px-3 py-3 space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1">
                                {dish.image_url && (
                                  <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-[#0d0d12]">
                                    <img
                                      src={dish.image_url}
                                      alt={dish.name}
                                      className="absolute inset-0 w-full h-full object-cover object-center scale-90"
                                    />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <p className="text-sm font-semibold">{dish.name}</p>
                                  {dish.description && (
                                    <p className="text-[11px] text-slate-400">
                                      {dish.description}
                                    </p>
                                  )}
                                  {dish.is_signature && (
                                    <span className="inline-flex items-center rounded-full bg-bitebox/90 text-white text-[9px] font-semibold px-2 py-[1px] mt-1">
                                      Plat signature
                                    </span>
                                  )}
                                  {dish.is_limited_edition && (
                                    <span className="inline-flex items-center rounded-full bg-amber-500/90 text-white text-[9px] font-semibold px-2 py-[1px] mt-1">
                                      Édition limitée
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                                {/* Select pour changer la catégorie */}
                                <select
                                  value={dish.category_id || ""}
                                  onChange={(e) =>
                                    handleChangeDishCategory(dish, e.target.value || null)
                                  }
                                  className="text-[11px] rounded-md bg-slate-900 border border-slate-700 px-2 py-1 outline-none focus:border-bitebox"
                                >
                                  <option value="">Aucune section</option>
                                  {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => moveDishUp(dish)}
                                  className="text-[11px] border border-slate-600 rounded px-2 py-[1px] hover:bg-slate-800"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveDishDown(dish)}
                                  className="text-[11px] border border-slate-600 rounded px-2 py-[1px] hover:bg-slate-800"
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditDish(dish)}
                                  className="text-[11px] rounded-md border border-bitebox/60 px-3 py-1 hover:bg-bitebox/10"
                                >
                                  Modifier
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDish(dish)}
                                  className="text-[11px] rounded-md border border-red-500/60 px-3 py-1 text-red-300 hover:bg-red-500/10"
                                >
                                  Supprimer
                                </button>
                              </div>
                            </div>

                            {editingDish?.id === dish.id && (
                              <form onSubmit={handleUpdateDish} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-800 pt-3">
                                <div className="space-y-1">
                                  <label className="text-xs text-slate-300">Nom du plat</label>
                                  <input
                                    type="text"
                                    value={editDishName}
                                    onChange={(e) => setEditDishName(e.target.value)}
                                    className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs text-slate-300">
                                    Description (optionnel)
                                  </label>
                                  <input
                                    type="text"
                                    value={editDishDescription}
                                    onChange={(e) => setEditDishDescription(e.target.value)}
                                    className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <label className="text-xs text-slate-300">
                                    Nouvelle image (optionnel)
                                  </label>
                                  
                                  {/* Tabs pour choisir entre upload et URL */}
                                  <div className="flex gap-2 border-b border-slate-700">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (editDishImagePreview && editDishImagePreview.startsWith('blob:')) {
                                          URL.revokeObjectURL(editDishImagePreview);
                                        }
                                        setEditDishImageMode("upload");
                                        setEditDishImageUrl("");
                                        setEditDishImagePreview(editingDish?.image_url ?? null);
                                      }}
                                      className={`px-3 py-1.5 text-xs font-medium transition ${
                                        editDishImageMode === "upload"
                                          ? "text-bitebox border-b-2 border-bitebox"
                                          : "text-slate-400 hover:text-slate-200"
                                      }`}
                                    >
                                      Télécharger un fichier
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (editDishImagePreview && editDishImagePreview.startsWith('blob:')) {
                                          URL.revokeObjectURL(editDishImagePreview);
                                        }
                                        setEditDishImageMode("url");
                                        setEditDishImageFile(null);
                                        setEditDishImagePreview(editingDish?.image_url ?? null);
                                      }}
                                      className={`px-3 py-1.5 text-xs font-medium transition ${
                                        editDishImageMode === "url"
                                          ? "text-bitebox border-b-2 border-bitebox"
                                          : "text-slate-400 hover:text-slate-200"
                                      }`}
                                    >
                                      Entrer une URL
                                    </button>
                                  </div>

                                  {/* Champ upload */}
                                  {editDishImageMode === "upload" && (
                                    <div className="space-y-2">
                                      <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/jpg,image/webp"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0] ?? null;
                                          // Nettoyer l'ancienne URL blob si elle existe
                                          if (editDishImagePreview && editDishImagePreview.startsWith('blob:')) {
                                            URL.revokeObjectURL(editDishImagePreview);
                                          }
                                          setEditDishImageFile(file);
                                          setEditDishImageUrl("");
                                          if (file) {
                                            const preview = URL.createObjectURL(file);
                                            setEditDishImagePreview(preview);
                                          } else {
                                            setEditDishImagePreview(editingDish?.image_url ?? null);
                                          }
                                        }}
                                        className="text-xs text-slate-300"
                                      />
                                      <p className="text-[11px] text-slate-500">
                                        Formats acceptés : PNG, JPG, JPEG, WEBP (max 5MB). Laisse vide pour conserver l'image actuelle.
                                      </p>
                                    </div>
                                  )}

                                  {/* Champ URL */}
                                  {editDishImageMode === "url" && (
                                    <div className="space-y-2">
                                      <input
                                        type="url"
                                        value={editDishImageUrl}
                                        onChange={(e) => {
                                          const url = e.target.value;
                                          setEditDishImageUrl(url);
                                          setEditDishImageFile(null);
                                          if (url && validateImageUrl(url)) {
                                            setEditDishImagePreview(url);
                                          } else if (!url) {
                                            setEditDishImagePreview(editingDish?.image_url ?? null);
                                          } else {
                                            setEditDishImagePreview(null);
                                          }
                                        }}
                                        placeholder="https://exemple.com/image.png"
                                        className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                                      />
                                      <p className="text-[11px] text-slate-500">
                                        URL commençant par http:// ou https:// avec extension .png, .jpg, .jpeg ou .webp. Laisse vide pour conserver l'image actuelle.
                                      </p>
                                    </div>
                                  )}

                                  {/* Aperçu de l'image */}
                                  {editDishImagePreview && (
                                    <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-700">
                                      <p className="text-xs text-slate-400 mb-2">Aperçu :</p>
                                      <div className="relative h-32 w-full overflow-hidden rounded-xl bg-[#0d0d12]">
                                        <img
                                          src={editDishImagePreview}
                                          alt="Aperçu plat"
                                          className="absolute inset-0 w-full h-full object-cover object-center scale-90"
                                          onError={() => setEditDishImagePreview(editingDish?.image_url ?? null)}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <div className="space-y-1">
                                    <label className="text-xs text-slate-300">Section (optionnel)</label>
                                    <select
                                      value={editDishCategoryId || ""}
                                      onChange={(e) => setEditDishCategoryId(e.target.value || null)}
                                      className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                                    >
                                      <option value="">Aucune section</option>
                                      {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                          {cat.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <label className="flex items-center gap-2 text-xs text-slate-300">
                                    <input
                                      type="checkbox"
                                      checked={editDishIsSignature}
                                      onChange={(e) => setEditDishIsSignature(e.target.checked)}
                                      className="h-3 w-3"
                                    />
                                    Plat signature
                                  </label>
                                  <div className="flex flex-col gap-1">
                                    <label className="flex items-center gap-2 text-xs text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={editDishIsLimitedEdition}
                                        onChange={(e) => setEditDishIsLimitedEdition(e.target.checked)}
                                        className="h-3 w-3"
                                      />
                                      Édition limitée
                                    </label>
                                    <p className="text-[10px] text-slate-500 ml-5">
                                      Plat disponible pour une durée limitée / collab spéciale, peut ne plus être au menu plus tard.
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="submit"
                                      className="inline-flex items-center justify-center rounded-md bg-bitebox px-4 py-2 text-xs font-semibold text-white shadow hover:bg-bitebox-dark transition"
                                    >
                                      Enregistrer
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditDish}
                                      className="text-[11px] text-slate-300 hover:text-slate-100"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                </div>
                              </form>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Ajout de plat */}
            <form onSubmit={handleAddDish} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-800 pt-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-300">Nom du plat</label>
                <input
                  type="text"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                  placeholder="Ex : Whopper"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">Description (optionnel)</label>
                <input
                  type="text"
                  value={dishDescription}
                  onChange={(e) => setDishDescription(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                  placeholder="Burger signature..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-300">Image du plat (optionnel)</label>
                
                {/* Tabs pour choisir entre upload et URL */}
                <div className="flex gap-2 border-b border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      if (dishImagePreview && dishImagePreview.startsWith('blob:')) {
                        URL.revokeObjectURL(dishImagePreview);
                      }
                      setDishImageMode("upload");
                      setDishImageUrl("");
                      setDishImagePreview(null);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium transition ${
                      dishImageMode === "upload"
                        ? "text-bitebox border-b-2 border-bitebox"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Télécharger un fichier
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (dishImagePreview && dishImagePreview.startsWith('blob:')) {
                        URL.revokeObjectURL(dishImagePreview);
                      }
                      setDishImageMode("url");
                      setDishImageFile(null);
                      setDishImagePreview(null);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium transition ${
                      dishImageMode === "url"
                        ? "text-bitebox border-b-2 border-bitebox"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Entrer une URL
                  </button>
                </div>

                {/* Champ upload */}
                {dishImageMode === "upload" && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        // Nettoyer l'ancienne URL blob si elle existe
                        if (dishImagePreview && dishImagePreview.startsWith('blob:')) {
                          URL.revokeObjectURL(dishImagePreview);
                        }
                        setDishImageFile(file);
                        setDishImageUrl("");
                        if (file) {
                          const preview = URL.createObjectURL(file);
                          setDishImagePreview(preview);
                        } else {
                          setDishImagePreview(null);
                        }
                      }}
                      className="text-xs text-slate-300"
                    />
                    <p className="text-[11px] text-slate-500">
                      Formats acceptés : PNG, JPG, JPEG, WEBP (max 5MB)
                    </p>
                  </div>
                )}

                {/* Champ URL */}
                {dishImageMode === "url" && (
                  <div className="space-y-2">
                    <input
                      type="url"
                      value={dishImageUrl}
                      onChange={(e) => {
                        const url = e.target.value;
                        setDishImageUrl(url);
                        setDishImageFile(null);
                        if (url && validateImageUrl(url)) {
                          setDishImagePreview(url);
                        } else {
                          setDishImagePreview(null);
                        }
                      }}
                      placeholder="https://exemple.com/image.png"
                      className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                    />
                    <p className="text-[11px] text-slate-500">
                      URL commençant par http:// ou https:// avec extension .png, .jpg, .jpeg ou .webp
                    </p>
                  </div>
                )}

                {/* Aperçu de l'image */}
                {dishImagePreview && (
                  <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 mb-2">Aperçu :</p>
                    <div className="relative h-32 w-full overflow-hidden rounded-xl bg-[#0d0d12]">
                      <img
                        src={dishImagePreview}
                        alt="Aperçu plat"
                        className="absolute inset-0 w-full h-full object-cover object-center scale-95"
                        onError={() => setDishImagePreview(null)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Section (optionnel)</label>
                  <select
                    value={dishCategoryId || ""}
                    onChange={(e) => setDishCategoryId(e.target.value || null)}
                    className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                  >
                    <option value="">Aucune section</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={dishIsSignature}
                    onChange={(e) => setDishIsSignature(e.target.checked)}
                    className="h-3 w-3"
                  />
                  Plat signature
                </label>
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={dishIsLimitedEdition}
                      onChange={(e) => setDishIsLimitedEdition(e.target.checked)}
                      className="h-3 w-3"
                    />
                    Édition limitée
                  </label>
                  <p className="text-[10px] text-slate-500 ml-5">
                    Plat disponible pour une durée limitée / collab spéciale, peut ne plus être au menu plus tard.
                  </p>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-black shadow hover:bg-emerald-400 transition"
                >
                  Ajouter le plat
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}


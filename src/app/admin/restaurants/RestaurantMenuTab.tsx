"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Restaurant, Dish, DishCategory } from "./types";

type RestaurantMenuTabProps = {
  restaurant: Restaurant;
  onError: (error: string | null) => void;
};

export default function RestaurantMenuTab({
  restaurant,
  onError,
}: RestaurantMenuTabProps) {
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingDishes, setLoadingDishes] = useState(false);

  // État pour créer une section
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // État pour éditer une section
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState<string>("");
  const [isSavingSectionName, setIsSavingSectionName] = useState(false);

  // État pour créer un plat
  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishImageUrl, setDishImageUrl] = useState("");
  const [dishImagePreview, setDishImagePreview] = useState<string | null>(null);
  const [dishImageError, setDishImageError] = useState<string | null>(null);
  const [dishIsSignature, setDishIsSignature] = useState(false);
  const [dishIsLimitedEdition, setDishIsLimitedEdition] = useState(false);
  const [dishCategoryId, setDishCategoryId] = useState<string | null>(null);
  const [showDishForm, setShowDishForm] = useState(false);

  // État pour éditer un plat
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [editDishName, setEditDishName] = useState("");
  const [editDishDescription, setEditDishDescription] = useState("");
  const [editDishImageUrl, setEditDishImageUrl] = useState("");
  const [editDishImagePreview, setEditDishImagePreview] = useState<string | null>(null);
  const [editDishImageError, setEditDishImageError] = useState<string | null>(null);
  const [editDishIsSignature, setEditDishIsSignature] = useState(false);
  const [editDishIsLimitedEdition, setEditDishIsLimitedEdition] = useState(false);
  const [editDishCategoryId, setEditDishCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (restaurant) {
      fetchCategories();
      fetchDishes();
    }
  }, [restaurant]);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const { data, error } = await supabase
        .from("dish_categories")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("order_index", { ascending: true });

      if (error) {
        console.error("[Admin] categories error", error);
        onError("Erreur lors du chargement des sections.");
        return;
      }

      setCategories((data || []) as DishCategory[]);
    } catch (err) {
      console.error("[Admin] categories unexpected", err);
      onError("Erreur inattendue lors du chargement des sections.");
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchDishes = async () => {
    try {
      setLoadingDishes(true);
      const { data, error } = await supabase
        .from("dishes")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("position", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

      if (error) {
        console.error("[Admin] dishes error", error);
        onError("Erreur lors du chargement des plats.");
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
      onError("Erreur inattendue lors du chargement des plats.");
    } finally {
      setLoadingDishes(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setCategoryError("Le nom de la section ne peut pas être vide.");
      return;
    }

    const existingCategory = categories.find(
      (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existingCategory) {
      setCategoryError("Une section avec ce nom existe déjà.");
      return;
    }

    try {
      setCategoryError(null);
      onError(null);

      const nextOrderIndex =
        categories.length === 0
          ? 0
          : (categories.reduce((max, c) => Math.max(max, c.order_index ?? 0), 0) ?? 0) + 1;

      const { data, error: insertError } = await supabase
        .from("dish_categories")
        .insert({
          restaurant_id: restaurant.id,
          name: trimmedName,
          order_index: nextOrderIndex,
        })
        .select("*")
        .single();

      if (insertError) {
        console.error("[Admin] Erreur création catégorie :", insertError);
        const errorMessage = insertError.message || "Erreur lors de la création de la section.";
        setCategoryError(errorMessage);
        onError(errorMessage);
        return;
      }

      if (data) {
        setCategories((prev) => [...prev, data as DishCategory].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
        setNewCategoryName("");
        setShowCategoryForm(false);
        setCategoryError(null);
      }
    } catch (err: any) {
      console.error("[Admin] Erreur inattendue création catégorie :", err);
      const errorMessage = err?.message || "Une erreur inattendue est survenue lors de la création de la section.";
      setCategoryError(errorMessage);
      onError(errorMessage);
    }
  };

  const handleSaveSectionName = async (sectionId: string) => {
    const newName = editingSectionName.trim();
    if (!newName) {
      setCategoryError("Le nom de la section ne peut pas être vide.");
      return;
    }

    try {
      setIsSavingSectionName(true);
      setCategoryError(null);
      onError(null);

      const { data, error } = await supabase
        .from("dish_categories")
        .update({ name: newName })
        .eq("id", sectionId)
        .eq("restaurant_id", restaurant.id)
        .select("*");

      if (error) {
        console.error("[Admin] Erreur update section name", error);
        const errorMessage = error.message || "Erreur lors de la sauvegarde du nom de la section.";
        setCategoryError(errorMessage);
        onError(errorMessage);
        return;
      }

      if (!Array.isArray(data) || data.length === 0) {
        setCategoryError("Aucune ligne n'a été mise à jour.");
        return;
      }

      await fetchCategories();
      setEditingSectionId(null);
      setEditingSectionName("");
    } catch (e: any) {
      console.error("[Admin] Exception handleSaveSectionName", e);
      const errorMessage = e?.message || "Une erreur inattendue est survenue lors de la sauvegarde.";
      setCategoryError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsSavingSectionName(false);
    }
  };

  const handleDeleteCategory = async (category: DishCategory) => {
    const dishesInCategory = dishes.filter((d) => d.category_id === category.id);
    if (dishesInCategory.length > 0) {
      onError(
        `Impossible de supprimer la section "${category.name}" car elle contient ${dishesInCategory.length} plat(s). Déplacez d'abord les plats vers une autre section.`
      );
      return;
    }

    if (!confirm(`Supprimer la section "${category.name}" ?`)) return;

    try {
      onError(null);

      const { error: deleteError } = await supabase
        .from("dish_categories")
        .delete()
        .eq("id", category.id);

      if (deleteError) {
        console.error("[Admin] delete category error", deleteError);
        onError("Erreur lors de la suppression de la section.");
        return;
      }

      await fetchCategories();
    } catch (err) {
      console.error("[Admin] delete category unexpected", err);
      onError("Erreur inattendue lors de la suppression de la section.");
    }
  };

  const handleMoveSection = async (categoryId: string, direction: "up" | "down") => {
    const currentIndex = categories.findIndex((c) => c.id === categoryId);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;

    const newSections = [...categories];
    const [moved] = newSections.splice(currentIndex, 1);
    newSections.splice(newIndex, 0, moved);

    setCategories(newSections);

    try {
      onError(null);

      const updatePromises = newSections.map((section, index) =>
        supabase
          .from("dish_categories")
          .update({ order_index: index })
          .eq("id", section.id)
          .eq("restaurant_id", restaurant.id)
      );

      const results = await Promise.all(updatePromises);
      const hasError = results.some((result) => result.error);
      if (hasError) {
        onError("Erreur lors du changement d'ordre de la section.");
        await fetchCategories();
        return;
      }
    } catch (err) {
      console.error("[Admin] handleMoveSection unexpected", err);
      onError("Erreur inattendue lors du changement d'ordre de la section.");
      await fetchCategories();
    }
  };

  const handleAddDish = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      onError(null);
      setDishImageError(null);

      if (!dishName.trim()) {
        onError("Le nom du plat est obligatoire.");
        return;
      }

      let finalImageUrl: string | null = null;
      if (dishImageUrl.trim()) {
        const trimmedUrl = dishImageUrl.trim();
        if (!/^https?:\/\//i.test(trimmedUrl)) {
          setDishImageError("L'URL de l'image doit commencer par http:// ou https://");
          return;
        }
        finalImageUrl = trimmedUrl;
      }

      const nextPosition =
        dishes.length === 0
          ? 0
          : Math.max(...dishes.map((d) => d.position ?? 0)) + 1;

      const payload = {
        restaurant_id: restaurant.id,
        name: dishName.trim(),
        description: dishDescription.trim() || null,
        image_url: finalImageUrl,
        is_signature: dishIsSignature,
        is_limited_edition: dishIsLimitedEdition,
        position: nextPosition,
        category_id: dishCategoryId || null,
      };

      const { error: insertError } = await supabase
        .from("dishes")
        .insert(payload)
        .select()
        .single();

      if (insertError) {
        console.error("Erreur lors de l'ajout du plat :", insertError);
        onError(`Impossible d'ajouter le plat. ${insertError.message || "Vérifie les infos et réessaie."}`);
        return;
      }

      setDishName("");
      setDishDescription("");
      setDishImageUrl("");
      setDishImagePreview(null);
      setDishImageError(null);
      setDishIsSignature(false);
      setDishIsLimitedEdition(false);
      setDishCategoryId(null);
      setShowDishForm(false);

      await fetchDishes();
    } catch (err) {
      console.error("Erreur ajout plat", err);
      onError("Erreur inattendue lors de l'ajout du plat.");
    }
  };

  const startEditDish = (dish: Dish) => {
    setEditingDish(dish);
    setEditDishName(dish.name);
    setEditDishDescription(dish.description || "");
    setEditDishIsSignature(dish.is_signature);
    setEditDishIsLimitedEdition(dish.is_limited_edition ?? false);
    setEditDishCategoryId(dish.category_id);
    setEditDishImageUrl(dish.image_url || "");
    setEditDishImagePreview(dish.image_url);
  };

  const cancelEditDish = () => {
    setEditingDish(null);
    setEditDishName("");
    setEditDishDescription("");
    setEditDishIsSignature(false);
    setEditDishIsLimitedEdition(false);
    setEditDishImageUrl("");
    setEditDishImagePreview(null);
    setEditDishImageError(null);
    setEditDishCategoryId(null);
  };

  const handleUpdateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDish) return;

    try {
      onError(null);
      setEditDishImageError(null);

      if (!editDishName.trim()) {
        onError("Le nom du plat est obligatoire.");
        return;
      }

      let finalImageUrl: string | null = editingDish.image_url ?? null;
      if (editDishImageUrl.trim()) {
        const trimmedUrl = editDishImageUrl.trim();
        if (!/^https?:\/\//i.test(trimmedUrl)) {
          setEditDishImageError("L'URL de l'image doit commencer par http:// ou https://");
          return;
        }
        finalImageUrl = trimmedUrl;
      }

      const payload = {
        name: editDishName.trim(),
        description: editDishDescription.trim() || null,
        image_url: finalImageUrl,
        is_signature: editDishIsSignature,
        is_limited_edition: editDishIsLimitedEdition,
        category_id: editDishCategoryId || null,
      };

      const { error: updateError } = await supabase
        .from("dishes")
        .update(payload)
        .eq("id", editingDish.id)
        .select()
        .single();

      if (updateError) {
        console.error("Erreur lors de la mise à jour du plat :", updateError);
        onError(`Impossible de mettre à jour le plat. ${updateError.message || "Vérifie les infos et réessaie."}`);
        return;
      }

      cancelEditDish();
      await fetchDishes();
    } catch (err) {
      console.error("Erreur mise à jour plat", err);
      onError("Erreur inattendue lors de la mise à jour du plat.");
    }
  };

  const handleDeleteDish = async (dish: Dish) => {
    const ok = window.confirm(`Voulez-vous vraiment supprimer le plat "${dish.name}" ?`);
    if (!ok) return;

    try {
      onError(null);

      const { error } = await supabase
        .from("dishes")
        .delete()
        .eq("id", dish.id)
        .eq("restaurant_id", restaurant.id);

      if (error) {
        console.error("[Admin] delete dish error", error);
        onError(error.message || "Impossible de supprimer ce plat.");
        return;
      }

      setDishes((prev) => prev.filter((d) => d.id !== dish.id));

      if (editingDish?.id === dish.id) {
        cancelEditDish();
      }
    } catch (err) {
      console.error("[Admin] delete dish unexpected", err);
      onError("Erreur inattendue lors de la suppression du plat.");
    }
  };

  const moveDishUp = async (dish: Dish) => {
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
        onError("Erreur lors du changement d'ordre du plat.");
        return;
      }

      await fetchDishes();
    } catch (err) {
      console.error("[Admin] moveDishUp unexpected", err);
      onError("Erreur inattendue lors du changement d'ordre du plat.");
    }
  };

  const moveDishDown = async (dish: Dish) => {
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
        onError("Erreur lors du changement d'ordre du plat.");
        return;
      }

      await fetchDishes();
    } catch (err) {
      console.error("[Admin] moveDishDown unexpected", err);
      onError("Erreur inattendue lors du changement d'ordre du plat.");
    }
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "Aucune section";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "Section inconnue";
  };

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 overflow-hidden">
      {/* Sections */}
      <div className="flex-[0_1_45%] flex flex-col bg-slate-900/80 rounded-2xl border border-slate-800/60 min-h-0 overflow-hidden">
        <div className="flex-shrink-0 p-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Sections de menu</h3>
            {!showCategoryForm && (
              <button
                onClick={() => setShowCategoryForm(true)}
                className="px-3 py-1.5 text-sm bg-bitebox text-white rounded-lg hover:bg-bitebox-dark transition"
              >
                + Ajouter une section
              </button>
            )}
          </div>

          {categoryError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/40 rounded-lg text-sm text-red-300">
              {categoryError}
            </div>
          )}

          {showCategoryForm && (
            <form onSubmit={handleCreateCategory} className="mb-4 p-4 bg-slate-950/70 rounded-lg space-y-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nom de la section"
                className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-sm text-white outline-none focus:border-bitebox"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-bitebox text-white rounded-lg hover:bg-bitebox-dark transition"
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
                  className="px-4 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
          {loadingCategories ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune section pour l'instant.</p>
          ) : (
            <div className="space-y-2">
              {categories.map((category, index) => (
              <div
                key={category.id}
                className="flex items-center gap-2 p-3 bg-slate-950/70 rounded-lg border border-slate-800"
              >
                <div className="flex-1">
                  {editingSectionId === category.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingSectionName}
                        onChange={(e) => setEditingSectionName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleSaveSectionName(category.id);
                          } else if (e.key === "Escape") {
                            setEditingSectionId(null);
                            setEditingSectionName("");
                          }
                        }}
                        className="flex-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-sm text-white outline-none focus:border-bitebox"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveSectionName(category.id)}
                        disabled={isSavingSectionName}
                        className="px-2 py-1 text-xs bg-bitebox text-white rounded hover:bg-bitebox-dark disabled:opacity-50"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => {
                          setEditingSectionId(null);
                          setEditingSectionName("");
                        }}
                        className="px-2 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-600"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{category.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveSection(category.id, "up")}
                          disabled={index === 0}
                          className="p-1 text-xs disabled:opacity-30"
                          title="Monter"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleMoveSection(category.id, "down")}
                          disabled={index === categories.length - 1}
                          className="p-1 text-xs disabled:opacity-30"
                          title="Descendre"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => {
                            setEditingSectionId(category.id);
                            setEditingSectionName(category.name);
                          }}
                          className="px-2 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-600"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category)}
                          className="px-2 py-1 text-xs bg-red-500/80 text-white rounded hover:bg-red-500"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            </div>
          )}
        </div>
      </div>

      {/* Plats */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-900/80 rounded-2xl border border-slate-800/60 overflow-hidden">
        <div className="flex-shrink-0 p-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Plats</h3>
            {!showDishForm && !editingDish && (
              <button
                onClick={() => setShowDishForm(true)}
                className="px-3 py-1.5 text-sm bg-bitebox text-white rounded-lg hover:bg-bitebox-dark transition"
              >
                + Ajouter un plat
              </button>
            )}
          </div>

          {dishImageError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/40 rounded-lg text-sm text-red-300">
              {dishImageError}
            </div>
          )}

          {showDishForm && (
          <form onSubmit={handleAddDish} className="mb-6 p-4 bg-slate-950/70 rounded-lg space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nom du plat *</label>
              <input
                type="text"
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-sm text-white outline-none focus:border-bitebox"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={dishDescription}
                onChange={(e) => setDishDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-sm text-white outline-none focus:border-bitebox"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">URL de l'image</label>
              <input
                type="url"
                value={dishImageUrl}
                onChange={(e) => {
                  const url = e.target.value;
                  setDishImageUrl(url);
                  if (url && /^https?:\/\//i.test(url.trim())) {
                    setDishImagePreview(url.trim());
                  } else {
                    setDishImagePreview(null);
                  }
                }}
                placeholder="https://exemple.com/image.png"
                className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-sm text-white outline-none focus:border-bitebox"
              />
              {dishImagePreview && (
                <div className="mt-2">
                  <img
                    src={dishImagePreview}
                    alt="Aperçu"
                    className="h-32 object-contain rounded"
                    onError={() => setDishImagePreview(null)}
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Section</label>
              <select
                value={dishCategoryId || ""}
                onChange={(e) => setDishCategoryId(e.target.value || null)}
                className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-sm text-white outline-none focus:border-bitebox"
              >
                <option value="">Aucune section</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={dishIsSignature}
                  onChange={(e) => setDishIsSignature(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 text-bitebox focus:ring-bitebox"
                />
                <span>Plat signature</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={dishIsLimitedEdition}
                  onChange={(e) => setDishIsLimitedEdition(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 text-amber-500 focus:ring-amber-500"
                />
                <span>Édition limitée</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-bitebox text-white rounded-lg hover:bg-bitebox-dark transition"
              >
                Ajouter
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDishForm(false);
                  setDishName("");
                  setDishDescription("");
                  setDishImageUrl("");
                  setDishImagePreview(null);
                  setDishCategoryId(null);
                  setDishIsSignature(false);
                  setDishIsLimitedEdition(false);
                }}
                className="px-4 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {editingDish && (
          <form onSubmit={handleUpdateDish} className="mb-6 p-4 bg-slate-950/70 rounded-lg space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nom du plat *</label>
              <input
                type="text"
                value={editDishName}
                onChange={(e) => setEditDishName(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-sm text-white outline-none focus:border-bitebox"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={editDishDescription}
                onChange={(e) => setEditDishDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-sm text-white outline-none focus:border-bitebox"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">URL de l'image</label>
              <input
                type="url"
                value={editDishImageUrl}
                onChange={(e) => {
                  const url = e.target.value;
                  setEditDishImageUrl(url);
                  if (url && /^https?:\/\//i.test(url.trim())) {
                    setEditDishImagePreview(url.trim());
                  } else {
                    setEditDishImagePreview(null);
                  }
                }}
                placeholder="https://exemple.com/image.png"
                className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-sm text-white outline-none focus:border-bitebox"
              />
              {editDishImagePreview && (
                <div className="mt-2">
                  <img
                    src={editDishImagePreview}
                    alt="Aperçu"
                    className="h-32 object-contain rounded"
                    onError={() => setEditDishImagePreview(null)}
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Section</label>
              <select
                value={editDishCategoryId || ""}
                onChange={(e) => setEditDishCategoryId(e.target.value || null)}
                className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-sm text-white outline-none focus:border-bitebox"
              >
                <option value="">Aucune section</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={editDishIsSignature}
                  onChange={(e) => setEditDishIsSignature(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 text-bitebox focus:ring-bitebox"
                />
                <span>Plat signature</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={editDishIsLimitedEdition}
                  onChange={(e) => setEditDishIsLimitedEdition(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 text-amber-500 focus:ring-amber-500"
                />
                <span>Édition limitée</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-bitebox text-white rounded-lg hover:bg-bitebox-dark transition"
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={cancelEditDish}
                className="px-4 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {loadingDishes ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : dishes.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun plat pour l'instant.</p>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
            <div className="space-y-3">
            {dishes.map((dish, index) => (
              <div
                key={dish.id}
                className="flex items-start gap-4 p-4 bg-slate-950/70 rounded-lg border border-slate-800"
              >
                {dish.image_url && (
                  <img
                    src={dish.image_url}
                    alt={dish.name}
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold">{dish.name}</h4>
                      {dish.description && (
                        <p className="text-xs text-slate-400 mt-1">{dish.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-slate-500">
                          {getCategoryName(dish.category_id)}
                        </span>
                        {dish.is_signature && (
                          <span className="text-xs px-2 py-0.5 bg-bitebox/90 text-white rounded-full">
                            Signature
                          </span>
                        )}
                        {dish.is_limited_edition && (
                          <span className="text-xs px-2 py-0.5 bg-amber-500/90 text-white rounded-full">
                            Édition limitée
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => moveDishUp(dish)}
                        disabled={index === 0}
                        className="p-1 text-xs disabled:opacity-30"
                        title="Monter"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveDishDown(dish)}
                        disabled={index === dishes.length - 1}
                        className="p-1 text-xs disabled:opacity-30"
                        title="Descendre"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => startEditDish(dish)}
                        className="px-2 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-600"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteDish(dish)}
                        className="px-2 py-1 text-xs bg-red-500/80 text-white rounded hover:bg-red-500"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Restaurant, Dish, DishCategory } from "./types";
import DishImage from "@/components/DishImage";

type RestaurantMenuTabProps = {
  restaurant: Restaurant;
  onError: (error: string | null) => void;
};

export default function RestaurantMenuTab({
  restaurant,
  onError,
}: RestaurantMenuTabProps) {
  const router = useRouter();
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
  const [brokenImageUrls, setBrokenImageUrls] = useState<Set<string>>(new Set());
  const [editDishIsSignature, setEditDishIsSignature] = useState(false);
  const [editDishIsLimitedEdition, setEditDishIsLimitedEdition] = useState(false);
  const [editDishCategoryId, setEditDishCategoryId] = useState<string | null>(null);

  // État pour la modal de confirmation de suppression
  const [dishToDelete, setDishToDelete] = useState<Dish | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // État pour le panneau de debug de suppression
  const [deleteDebug, setDeleteDebug] = useState<{
    status: "idle" | "deleting" | "success" | "failed" | "zero-rows";
    table: string;
    dishId: string | null;
    count: number | null;
    error: { code: string | null; message: string | null } | null;
    data: Array<{ id: string }> | null;
  }>({
    status: "idle",
    table: "dishes",
    dishId: null,
    count: null,
    error: null,
    data: null,
  });

  useEffect(() => {
    if (restaurant) {
      fetchCategories();
      fetchDishes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant]);

  // Gestion de la touche ESC pour fermer la modale
  useEffect(() => {
    if (!dishToDelete) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        setDishToDelete(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [dishToDelete, isDeleting]);

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

  // SOURCE DES PLATS AFFICHÉS DANS L'ADMIN
  // Table: "dishes" (table Supabase directe, pas une view ni RPC)
  // Colonnes utilisées: * (toutes), principales: id, restaurant_id, name, image_url, description, is_signature, is_limited_edition, position, category_id
  // Clé primaire: "id" (string/UUID)
  // Filtre: restaurant_id = restaurant.id
  // Tri: position ASC, puis name ASC
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

      // Log du premier élément pour vérifier la source (dev only)
      if (data && data.length > 0) {
        console.log("[ADMIN] dishes source", { table: "dishes", sample: data[0] });
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

  // Ouvrir la modal de confirmation de suppression
  const openDeleteConfirm = (dish: Dish) => {
    setDishToDelete(dish);
    // Réinitialiser le debug
    setDeleteDebug({
      status: "idle",
      table: "dishes",
      dishId: dish.id,
      count: null,
      error: null,
      data: null,
    });
  };

  // Fermer la modal de confirmation
  const closeDeleteConfirm = () => {
    if (!isDeleting) {
      setDishToDelete(null);
    }
  };

  // Handler unique pour confirmer et exécuter la suppression
  // SUPPRESSION VÉRIFIABLE : utilise la même table que fetchDishes ("dishes") avec clé primaire "id"
  const handleConfirmDelete = async () => {
    console.log("[ADMIN] Confirm delete clicked", { dishId: dishToDelete?.id });

    if (!dishToDelete?.id) {
      console.warn("[ADMIN] handleConfirmDelete: no dishToDelete");
      onError("Aucun plat sélectionné pour la suppression.");
      return;
    }

    const dishId = dishToDelete.id;
    setIsDeleting(true);
    onError(null);
    setSuccessMessage(null);

    // Mettre à jour le debug : status = "deleting"
    setDeleteDebug({
      status: "deleting",
      table: "dishes",
      dishId,
      count: null,
      error: null,
      data: null,
    });

    try {
      // Suppression vérifiable : même table que fetchDishes, avec preuve (count: 'exact' + select)
      // Table: "dishes" (identique à fetchDishes)
      // Clé primaire: "id"
      const { data, error, count } = await supabase
        .from("dishes")
        .delete({ count: "exact" })
        .eq("id", dishId)
        .eq("restaurant_id", restaurant.id)
        .select("id");

      // Log complet pour diagnostic (impossible de mentir)
      console.log("[ADMIN] delete result", { 
        table: "dishes", 
        pk: "id", 
        value: dishId, 
        error, 
        count, 
        data 
      });

      // Condition STRICTE 1: Si error => status="failed" + afficher message UI "Suppression impossible"
      if (error) {
        console.error("[ADMIN] delete error", error);
        const errorMessage = `Suppression impossible: ${error.message || "Erreur lors de la suppression du plat."}`;
        onError(errorMessage);
        
        // Mettre à jour le debug : status = "failed"
        setDeleteDebug({
          status: "failed",
          table: "dishes",
          dishId,
          count: null,
          error: {
            code: error.code || null,
            message: error.message || null,
          },
          data: null,
        });
        
        // La modale reste ouverte mais utilisable (Annuler marche)
        return;
      }

      // Condition STRICTE 2: Si count === 0 (ou data vide) => status="zero-rows" + afficher "0 ligne supprimée (mauvais id / droits RLS)"
      // count peut être null/undefined si count: 'exact' n'est pas supporté, donc on vérifie aussi data
      const hasData = data && data.length > 0;
      const hasCount = count !== null && count !== undefined;
      const isCountZero = hasCount && count === 0;

      if (isCountZero || (!hasData && !hasCount)) {
        console.warn("[ADMIN] Delete returned 0 rows", { dishId, count, data, hasData, hasCount });
        const errorMessage = "0 ligne supprimée (mauvais id / droits RLS)";
        onError(errorMessage);
        
        // Mettre à jour le debug : status = "zero-rows"
        setDeleteDebug({
          status: "zero-rows",
          table: "dishes",
          dishId,
          count: count ?? 0,
          error: null,
          data: data || [],
        });
        
        // La modale reste ouverte mais utilisable (Annuler marche)
        return;
      }

      // Condition STRICTE 3: Seulement si count > 0 => status="success", fermer modale + retirer du state + refetch
      if (hasCount && count > 0) {
        console.log("[ADMIN] Dish deleted successfully", { dishId, count, deletedId: data?.[0]?.id });

        // Mettre à jour le debug : status = "success"
        setDeleteDebug({
          status: "success",
          table: "dishes",
          dishId,
          count,
          error: null,
          data: data || [],
        });

        // Retirer du state local (optimistic update)
        setDishes((prev) => prev.filter((d) => d.id !== dishId));

        // Fermer la modale après succès
        setDishToDelete(null);

        // Annuler l'édition si le plat supprimé était en cours d'édition
        if (editingDish?.id === dishId) {
          cancelEditDish();
        }

        // Afficher message de succès
        setSuccessMessage("Plat supprimé avec succès");

        // Masquer le message de succès après 3 secondes
        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);

        // Resync: relancer EXACTEMENT la même fonction fetch qu'en A (fetchDishes)
        await fetchDishes();

        // Refresh de la page pour garantir la persistance
        router.refresh();
      } else if (hasData && !hasCount) {
        // Fallback: si data existe mais count n'est pas disponible (ancienne version Supabase)
        console.log("[ADMIN] Dish deleted successfully (count unavailable, using data)", { dishId, deletedId: data[0]?.id });

        // Mettre à jour le debug : status = "success" (avec data mais sans count)
        setDeleteDebug({
          status: "success",
          table: "dishes",
          dishId,
          count: null,
          error: null,
          data: data || [],
        });

        // Retirer du state local (optimistic update)
        setDishes((prev) => prev.filter((d) => d.id !== dishId));

        // Fermer la modale après succès
        setDishToDelete(null);

        // Annuler l'édition si le plat supprimé était en cours d'édition
        if (editingDish?.id === dishId) {
          cancelEditDish();
        }

        // Afficher message de succès
        setSuccessMessage("Plat supprimé avec succès");

        // Masquer le message de succès après 3 secondes
        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);

        // Resync: relancer EXACTEMENT la même fonction fetch qu'en A (fetchDishes)
        await fetchDishes();

        // Refresh de la page pour garantir la persistance
        router.refresh();
      } else {
        // Cas inattendu : ni count ni data ne confirment la suppression
        console.warn("[ADMIN] Delete status unclear", { dishId, count, data });
        onError("Impossible de confirmer la suppression. Vérifiez les logs.");
        
        // Mettre à jour le debug : status = "failed"
        setDeleteDebug({
          status: "failed",
          table: "dishes",
          dishId,
          count,
          error: { code: null, message: "Status unclear" },
          data: data || null,
        });
        
        // La modale reste ouverte mais utilisable (Annuler marche)
      }
    } catch (err) {
      console.error("[ADMIN] Delete failed", err);
      const errorMessage = err instanceof Error ? err.message : "Erreur inattendue lors de la suppression du plat.";
      onError(errorMessage);
      
      // Mettre à jour le debug : status = "failed"
      setDeleteDebug({
        status: "failed",
        table: "dishes",
        dishId,
        count: null,
        error: {
          code: null,
          message: errorMessage,
        },
        data: null,
      });
      
      // La modale reste ouverte mais utilisable (Annuler marche)
    } finally {
      setIsDeleting(false);
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

  const getCategoryName = (categoryId: string | null): string => {
    if (!categoryId) return "Sans section";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "Section inconnue";
  };

  // Grouper et trier les plats par section
  const getGroupedDishes = () => {
    // Trier les sections par order_index
    const sortedCategories = [...categories].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    
    // Créer un map de plats groupés par section
    const grouped = new Map<string | null, Dish[]>();
    
    // Initialiser toutes les sections (y compris "Sans section")
    sortedCategories.forEach((cat) => {
      grouped.set(cat.id, []);
    });
    grouped.set(null, []); // Plats sans section
    
    // Grouper les plats
    dishes.forEach((dish) => {
      const sectionId = dish.category_id || null;
      const sectionDishes = grouped.get(sectionId) || [];
      sectionDishes.push(dish);
      grouped.set(sectionId, sectionDishes);
    });
    
    // Trier les plats dans chaque section
    grouped.forEach((sectionDishes, sectionId) => {
      sectionDishes.sort((a, b) => {
        // D'abord par position
        const posA = a.position ?? Number.MAX_SAFE_INTEGER;
        const posB = b.position ?? Number.MAX_SAFE_INTEGER;
        if (posA !== posB) return posA - posB;
        // Sinon par nom
        return a.name.localeCompare(b.name);
      });
    });
    
    // Retourner sous forme d'array avec metadata
    const result: Array<{
      categoryId: string | null;
      categoryName: string;
      dishes: Dish[];
    }> = [];
    
    // D'abord les sections triées
    sortedCategories.forEach((cat) => {
      const sectionDishes = grouped.get(cat.id) || [];
      if (sectionDishes.length > 0 || categories.length === 0) {
        result.push({
          categoryId: cat.id,
          categoryName: cat.name,
          dishes: sectionDishes,
        });
      }
    });
    
    // Puis les plats sans section
    const noSectionDishes = grouped.get(null) || [];
    if (noSectionDishes.length > 0) {
      result.push({
        categoryId: null,
        categoryName: "Sans section",
        dishes: noSectionDishes,
      });
    }
    
    return result;
  };

  const groupedDishes = getGroupedDishes();


  return (
    <div className="h-full min-h-0 overflow-hidden flex gap-6">
      {/* Sections - Colonne gauche */}
      <div className="w-[360px] flex flex-col min-h-0 overflow-hidden bg-slate-900/80 rounded-2xl border border-slate-800/60">
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

      {/* Plats - Colonne droite */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-900/80 rounded-2xl border border-slate-800/60">
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

          {successMessage && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/40 rounded-lg text-sm text-green-300">
              {successMessage}
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
                    <DishImage
                      src={dishImagePreview}
                      alt="Aperçu"
                      className="max-w-xs"
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
                    <DishImage
                      src={editDishImagePreview}
                      alt="Aperçu"
                      className="max-w-xs"
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
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loadingDishes ? (
            <p className="text-sm text-slate-400 px-6 py-4">Chargement...</p>
          ) : groupedDishes.length === 0 ? (
            <p className="text-sm text-slate-400 px-6 py-4">Aucun plat pour l'instant.</p>
          ) : (
            <div className="px-6 pb-6 space-y-6">
              {groupedDishes.map((sectionGroup) => (
                <div key={sectionGroup.categoryId || "no-section"} className="space-y-3">
                  {/* En-tête de section */}
                  <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm py-2 -mx-6 px-6 border-b border-slate-700/50">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-semibold text-white">
                        {sectionGroup.categoryName}
                      </h4>
                      <span className="text-xs text-slate-400">
                        {sectionGroup.dishes.length} {sectionGroup.dishes.length === 1 ? "plat" : "plats"}
                      </span>
                    </div>
                  </div>

                  {/* Liste des plats de cette section */}
                  <div className="space-y-2">
                    {sectionGroup.dishes.map((dish, dishIndex) => {
                      const sectionDishes = sectionGroup.dishes;
                      const dishIndexInSection = dishIndex;
                      return (
                        <div
                          key={dish.id}
                          className="flex items-center gap-3 p-3 bg-slate-950/70 rounded-lg border border-slate-800 hover:border-slate-700 transition"
                        >
                          <div className="relative flex-shrink-0">
                            <DishImage
                              src={dish.image_url}
                              alt={dish.name}
                              size="small"
                              className="flex-shrink-0"
                              onImageError={(url) => {
                                if (url) {
                                  setBrokenImageUrls((prev) => new Set(prev).add(url));
                                }
                              }}
                            />
                            {((!dish.image_url || dish.image_url.trim() === "") || brokenImageUrls.has(dish.image_url || "")) && (
                              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-slate-950 z-10 shadow-lg">
                                <span className="text-white text-xs font-bold">!</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h5 className="text-sm font-medium text-white truncate">
                                    {dish.name}
                                  </h5>
                                  {((!dish.image_url || dish.image_url.trim() === "") || brokenImageUrls.has(dish.image_url || "")) && (
                                    <span className="text-xs text-red-400 font-semibold" title="Image manquante ou cassée - Ce plat ne sera pas affiché dans la carte">
                                      ⚠️
                                    </span>
                                  )}
                                </div>
                                {dish.description && (
                                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                                    {dish.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  {dish.is_signature && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-bitebox/90 text-white rounded">
                                      Signature
                                    </span>
                                  )}
                                  {dish.is_limited_edition && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/90 text-white rounded">
                                      Édition limitée
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => moveDishUp(dish)}
                                  disabled={dishIndexInSection === 0}
                                  className="p-1 text-xs text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                                  title="Monter dans la section"
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => moveDishDown(dish)}
                                  disabled={dishIndexInSection === sectionDishes.length - 1}
                                  className="p-1 text-xs text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                                  title="Descendre dans la section"
                                >
                                  ↓
                                </button>
                                <button
                                  onClick={() => startEditDish(dish)}
                                  className="px-2 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-600"
                                  title="Modifier"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => openDeleteConfirm(dish)}
                                  className="px-2 py-1 text-xs bg-red-500/80 text-white rounded hover:bg-red-500"
                                  title="Supprimer"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmation de suppression */}
      {dishToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            // Fermer au clic sur l'overlay (pas sur le contenu)
            if (e.target === e.currentTarget && !isDeleting) {
              closeDeleteConfirm();
            }
          }}
        >
          <div 
            className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-md w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">
              Confirmer la suppression
            </h3>
            <p className="text-sm text-slate-300 mb-6">
              Voulez-vous vraiment supprimer le plat <strong className="text-white">"{dishToDelete.name}"</strong> ?
              Cette action est irréversible.
            </p>

            {/* Panneau de debug */}
            <div className="mb-4 p-3 bg-slate-950/70 rounded-lg border border-slate-700/50">
              <div className="text-xs font-mono text-slate-400 space-y-1">
                <div>Table: <span className="text-slate-300">{deleteDebug.table}</span></div>
                <div>dishId: <span className="text-slate-300">{deleteDebug.dishId || "—"}</span></div>
                <div>status: <span className={`font-semibold ${
                  deleteDebug.status === "idle" ? "text-slate-400" :
                  deleteDebug.status === "deleting" ? "text-yellow-400" :
                  deleteDebug.status === "success" ? "text-green-400" :
                  deleteDebug.status === "failed" ? "text-red-400" :
                  "text-orange-400"
                }`}>{deleteDebug.status}</span></div>
                <div>count: <span className="text-slate-300">{deleteDebug.count !== null ? deleteDebug.count : "—"}</span></div>
                <div>error: <span className="text-slate-300">
                  {deleteDebug.error ? (
                    <>
                      {deleteDebug.error.code && <span className="text-red-400">{deleteDebug.error.code}</span>}
                      {deleteDebug.error.code && deleteDebug.error.message && " "}
                      {deleteDebug.error.message && <span>{deleteDebug.error.message}</span>}
                    </>
                  ) : "—"}
                </span></div>
                <div>data: <span className="text-slate-300">
                  {deleteDebug.data ? (
                    deleteDebug.data.length > 0 ? (
                      <span className="text-green-400">[{deleteDebug.data.map(d => d.id).join(", ")}]</span>
                    ) : (
                      <span className="text-orange-400">[]</span>
                    )
                  ) : "—"}
                </span></div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Suppression...</span>
                  </>
                ) : (
                  "Valider la suppression"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

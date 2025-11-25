"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
  position: number | null;
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
  const [saving, setSaving] = useState(false);

  // édition restaurant
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);

  // gestion des plats
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loadingDishes, setLoadingDishes] = useState(false);

  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishImageFile, setDishImageFile] = useState<File | null>(null);
  const [dishIsSignature, setDishIsSignature] = useState(false);

  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [editDishName, setEditDishName] = useState("");
  const [editDishDescription, setEditDishDescription] = useState("");
  const [editDishImageFile, setEditDishImageFile] = useState<File | null>(null);
  const [editDishIsSignature, setEditDishIsSignature] = useState(false);

  useEffect(() => {
    fetchRestaurants();
  }, []);

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
    setLogoFile(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Le nom de l’enseigne est obligatoire.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      let logoUrl: string | null = null;

      if (logoFile) {
        const path = `logos/${Date.now()}-${logoFile.name}`;
        const { error: uploadError } = await supabase
          .storage
          .from("fastfood-images")
          .upload(path, logoFile);

        if (uploadError) {
          console.error("[Admin] upload logo error", uploadError);
          setError("Erreur lors de l’upload du logo.");
          setSaving(false);
          return;
        }

        const { data } = supabase.storage.from("fastfood-images").getPublicUrl(path);
        logoUrl = data.publicUrl;
      }

      const slug = slugify(name);

      const { error: insertError } = await supabase.from("restaurants").insert({
        name,
        description: description || null,
        logo_url: logoUrl,
        slug,
      });

      if (insertError) {
        console.error("[Admin] insert restaurant error", insertError);
        setError("Erreur lors de la création de l’enseigne.");
        setSaving(false);
        return;
      }

      resetCreateForm();
      fetchRestaurants();
    } catch (err) {
      console.error("[Admin] create restaurant unexpected", err);
      setError("Erreur inattendue lors de la création de l’enseigne.");
    } finally {
      setSaving(false);
    }
  };

  const startEditRestaurant = (restaurant: Restaurant) => {
    setEditingRestaurant(restaurant);
    setEditName(restaurant.name);
    setEditDescription(restaurant.description || "");
    setEditLogoFile(null);
  };

  const cancelEditRestaurant = () => {
    setEditingRestaurant(null);
    setEditName("");
    setEditDescription("");
    setEditLogoFile(null);
  };

  const handleUpdateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRestaurant) return;

    try {
      setError(null);

      if (!editName.trim()) {
        setError("Le nom de l’enseigne est obligatoire.");
        return;
      }

      let logoUrl: string | null = editingRestaurant.logo_url ?? null;

      if (editLogoFile) {
        const path = `logos/${editingRestaurant.id}/${Date.now()}-${editLogoFile.name}`;
        const { error: uploadError } = await supabase
          .storage
          .from("fastfood-images")
          .upload(path, editLogoFile);

        if (uploadError) {
          console.error("[Admin] upload new logo error", uploadError);
          setError("Erreur lors de l’upload du nouveau logo.");
          return;
        }

        const { data } = supabase.storage.from("fastfood-images").getPublicUrl(path);
        logoUrl = data.publicUrl;
      }

      const slug = slugify(editName);

      const { error: updateError } = await supabase
        .from("restaurants")
        .update({
          name: editName,
          description: editDescription || null,
          logo_url: logoUrl,
          slug,
        })
        .eq("id", editingRestaurant.id);

      if (updateError) {
        console.error("[Admin] update restaurant error", updateError);
        setError("Erreur lors de la mise à jour de l’enseigne.");
        return;
      }

      cancelEditRestaurant();
      fetchRestaurants();
    } catch (err) {
      console.error("[Admin] update restaurant unexpected", err);
      setError("Erreur inattendue lors de la mise à jour de l’enseigne.");
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
    setDishImageFile(null);
    setDishIsSignature(false);
    setEditingDish(null);
    fetchDishes(restaurant);
  };

  const handleCloseDishes = () => {
    setSelectedRestaurant(null);
    setDishes([]);
    setEditingDish(null);
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

      let imageUrl: string | null = null;

      if (dishImageFile) {
        const path = `dishes/${selectedRestaurant.id}/${Date.now()}-${dishImageFile.name}`;
        const { error: uploadError } = await supabase
          .storage
          .from("fastfood-images")
          .upload(path, dishImageFile);

        if (uploadError) {
          console.error("[Admin] upload dish image error", uploadError);
          setError("Erreur lors de l’upload de l’image du plat.");
          return;
        }

        const { data } = supabase.storage.from("fastfood-images").getPublicUrl(path);
        imageUrl = data.publicUrl;
      }

      const nextPosition =
        dishes.length === 0
          ? 0
          : Math.max(...dishes.map((d) => d.position ?? 0)) + 1;

      const { error: insertError } = await supabase.from("dishes").insert({
        restaurant_id: selectedRestaurant.id,
        name: dishName,
        description: dishDescription || null,
        image_url: imageUrl,
        is_signature: dishIsSignature,
        position: nextPosition,
      });

      if (insertError) {
        console.error("[Admin] insert dish error", insertError);
        setError("Erreur lors de l’ajout du plat.");
        return;
      }

      setDishName("");
      setDishDescription("");
      setDishImageFile(null);
      setDishIsSignature(false);

      fetchDishes(selectedRestaurant);
    } catch (err) {
      console.error("[Admin] add dish unexpected", err);
      setError("Erreur inattendue lors de l’ajout du plat.");
    }
  };

  const startEditDish = (dish: Dish) => {
    setEditingDish(dish);
    setEditDishName(dish.name);
    setEditDishDescription(dish.description || "");
    setEditDishIsSignature(dish.is_signature);
    setEditDishImageFile(null);
  };

  const cancelEditDish = () => {
    setEditingDish(null);
    setEditDishName("");
    setEditDishDescription("");
    setEditDishIsSignature(false);
    setEditDishImageFile(null);
  };

  const handleUpdateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDish || !selectedRestaurant) return;

    try {
      if (!editDishName.trim()) {
        setError("Le nom du plat est obligatoire.");
        return;
      }

      let imageUrl: string | null = editingDish.image_url ?? null;

      if (editDishImageFile) {
        const path = `dishes/${selectedRestaurant.id}/${Date.now()}-${editDishImageFile.name}`;
        const { error: uploadError } = await supabase
          .storage
          .from("fastfood-images")
          .upload(path, editDishImageFile);

        if (uploadError) {
          console.error("[Admin] upload new dish image error", uploadError);
          setError("Erreur lors de l’upload de la nouvelle image.");
          return;
        }

        const { data } = supabase.storage.from("fastfood-images").getPublicUrl(path);
        imageUrl = data.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("dishes")
        .update({
          name: editDishName,
          description: editDishDescription || null,
          image_url: imageUrl,
          is_signature: editDishIsSignature,
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
        setError("Erreur lors du changement d’ordre du plat.");
        return;
      }

      fetchDishes(selectedRestaurant);
    } catch (err) {
      console.error("[Admin] moveDishDown unexpected", err);
      setError("Erreur inattendue lors du changement d’ordre du plat.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10">
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
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-amber-500"
                placeholder="Ex : Black & White Burger"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">Description (optionnel)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-amber-500"
                rows={3}
                placeholder="Quelques mots sur l’enseigne..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">Logo (upload image – optionnel)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                className="text-xs text-slate-300"
              />
              <p className="text-[11px] text-slate-500">
                Laisse vide si tu veux ajouter le logo plus tard.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black shadow hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Création en cours..." : "Créer l’enseigne"}
            </button>
          </form>
        </section>

        {/* Liste */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Enseignes existantes</h2>

          {loading ? (
            <p className="text-sm text-slate-400">Chargement des enseignes...</p>
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
                      className="text-xs rounded-md border border-amber-500/60 px-3 py-1 hover:bg-amber-500/10"
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
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">Description (optionnel)</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  rows={3}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">Nouveau logo (optionnel)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditLogoFile(e.target.files?.[0] ?? null)}
                  className="text-xs text-slate-300"
                />
                <p className="text-[11px] text-slate-500">
                  Laisse vide pour conserver le logo actuel.
                </p>
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

            {loadingDishes ? (
              <p className="text-sm text-slate-400">Chargement des plats...</p>
            ) : dishes.length === 0 ? (
              <p className="text-sm text-slate-400">
                Aucun plat enregistré pour cette enseigne.
              </p>
            ) : (
              <div className="space-y-2">
                {dishes.map((dish) => (
                  <div
                    key={dish.id}
                    className="bg-slate-950/70 rounded-xl px-3 py-3 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {dish.image_url && (
                          <img
                            src={dish.image_url}
                            alt={dish.name}
                            className="h-12 w-12 rounded object-cover"
                          />
                        )}
                        <div>
                          <p className="text-sm font-semibold">{dish.name}</p>
                          {dish.description && (
                            <p className="text-[11px] text-slate-400">
                              {dish.description}
                            </p>
                          )}
                          {dish.is_signature && (
                            <span className="inline-flex items-center rounded-full bg-amber-500/90 text-black text-[9px] font-semibold px-2 py-[1px] mt-1">
                              Plat signature
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center">
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
                          className="text-[11px] rounded-md border border-amber-500/60 px-3 py-1 hover:bg-amber-500/10"
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
                            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-amber-500"
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
                            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-slate-300">
                            Nouvelle image (optionnel)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setEditDishImageFile(e.target.files?.[0] ?? null)}
                            className="text-xs text-slate-300"
                          />
                          <p className="text-[11px] text-slate-500">
                            Laisse vide pour conserver l’image actuelle.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={editDishIsSignature}
                              onChange={(e) => setEditDishIsSignature(e.target.checked)}
                              className="h-3 w-3"
                            />
                            Plat signature
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-black shadow hover:bg-amber-400 transition"
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
            )}

            {/* Ajout de plat */}
            <form onSubmit={handleAddDish} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-800 pt-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-300">Nom du plat</label>
                <input
                  type="text"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  placeholder="Ex : Whopper"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">Description (optionnel)</label>
                <input
                  type="text"
                  value={dishDescription}
                  onChange={(e) => setDishDescription(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  placeholder="Burger signature..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">Image du plat (optionnel)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDishImageFile(e.target.files?.[0] ?? null)}
                  className="text-xs text-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={dishIsSignature}
                    onChange={(e) => setDishIsSignature(e.target.checked)}
                    className="h-3 w-3"
                  />
                  Plat signature
                </label>
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
    </main>
  );
}


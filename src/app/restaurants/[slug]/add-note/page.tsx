"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AddNoteWizard from "@/components/AddNoteWizard";

export default function AddNotePage() {
  const params = useParams<{ slug: string }>();
  const [restaurant, setRestaurant] = useState<{
    id: string;
    name: string;
    slug: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Charger le restaurant par slug pour pré-sélection
  useEffect(() => {
    const loadRestaurant = async () => {
      if (!params?.slug) {
        setLoading(false);
        return;
      }

      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name, slug")
        .eq("slug", params.slug)
        .single();

      if (!restaurantError && restaurantData) {
        setRestaurant({
          id: restaurantData.id,
          name: restaurantData.name,
          slug: restaurantData.slug,
        });
      }
      setLoading(false);
    };

    loadRestaurant();
  }, [params?.slug]);

  if (loading) {
    return null; // Le wizard gère son propre état de chargement
  }

  return (
    <AddNoteWizard
      presetRestaurantId={restaurant?.id || null}
      presetRestaurantName={restaurant?.name || null}
      presetRestaurantSlug={restaurant?.slug || null}
    />
  );
}


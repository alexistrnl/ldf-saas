export type Restaurant = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  description: string | null;
  show_latest_additions: boolean;
};

export type Dish = {
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

export type DishCategory = {
  id: string;
  restaurant_id: string;
  name: string;
  order_index: number;
};

export type ViewMode = "overview" | "edit" | "menu";


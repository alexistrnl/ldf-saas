"use client";

import { Restaurant } from "./types";

type RestaurantListPanelProps = {
  restaurants: Restaurant[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedRestaurantId: string | null;
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onCreateNew: () => void;
  loading?: boolean;
};

export default function RestaurantListPanel({
  restaurants,
  searchQuery,
  onSearchChange,
  selectedRestaurantId,
  onSelectRestaurant,
  onCreateNew,
  loading = false,
}: RestaurantListPanelProps) {
  // Filtrer les restaurants selon la recherche
  const filteredRestaurants = restaurants.filter((r) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(query) ||
      r.slug?.toLowerCase().includes(query) ||
      false
    );
  });

  return (
    <div className="flex flex-col h-full bg-slate-900/50 border-r border-slate-800/70 overflow-hidden">
      {/* Header avec bouton Nouvelle enseigne */}
      <div className="p-4 border-b border-slate-800/70">
        <button
          onClick={onCreateNew}
          className="w-full px-4 py-2 bg-bitebox text-white font-semibold rounded-lg hover:bg-bitebox-dark transition-colors text-sm"
        >
          + Nouvelle enseigne
        </button>
      </div>

      {/* Champ de recherche */}
      <div className="p-4 border-b border-slate-800/70">
        <input
          type="text"
          placeholder="Rechercher une enseigne..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-bitebox focus:border-transparent"
        />
      </div>

      {/* Liste scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-slate-400">Chargement...</p>
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-slate-400">
              {searchQuery
                ? "Aucune enseigne trouvée"
                : "Aucune enseigne pour l'instant"}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredRestaurants.map((restaurant) => {
              const isSelected = selectedRestaurantId === restaurant.id;
              return (
                <div
                  key={restaurant.id}
                  onClick={() => onSelectRestaurant(restaurant)}
                  className={`
                    p-3 rounded-lg cursor-pointer transition-all
                    ${
                      isSelected
                        ? "bg-bitebox/20 border border-bitebox/50"
                        : "bg-slate-800/30 hover:bg-slate-800/50 border border-transparent"
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    {restaurant.logo_url ? (
                      <img
                        src={restaurant.logo_url}
                        alt={restaurant.name}
                        className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-slate-400">📷</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {restaurant.name}
                      </p>
                      {restaurant.slug && (
                        <p className="text-xs text-slate-400 truncate">
                          /{restaurant.slug}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


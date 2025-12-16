"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Restaurant, ViewMode } from "./types";
import RestaurantMenuTab from "./RestaurantMenuTab";

type LogoInputProps = {
  mode: "upload" | "url";
  setMode: (m: "upload" | "url") => void;
  file: File | null;
  setFile: (f: File | null) => void;
  url: string;
  setUrl: (u: string) => void;
  preview: string | null;
  setPreview: (p: string | null) => void;
  validateImageUrl: (url: string) => boolean;
};

function LogoInput({
  mode,
  setMode,
  file,
  setFile,
  url,
  setUrl,
  preview,
  setPreview,
  validateImageUrl,
}: LogoInputProps) {
  return (
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
}

type RestaurantDetailsPanelProps = {
  selectedRestaurant: Restaurant | null;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  editingRestaurant: Restaurant | null;
  setEditingRestaurant: (restaurant: Restaurant | null) => void;
  editName: string;
  setEditName: (name: string) => void;
  editDescription: string;
  setEditDescription: (description: string) => void;
  editLogoFile: File | null;
  setEditLogoFile: (file: File | null) => void;
  editLogoUrl: string;
  setEditLogoUrl: (url: string) => void;
  editLogoImageMode: "upload" | "url";
  setEditLogoImageMode: (mode: "upload" | "url") => void;
  editLogoPreview: string | null;
  setEditLogoPreview: (preview: string | null) => void;
  onUpdate: (e: React.FormEvent) => void;
  onCancelEdit: () => void;
  validateImageUrl: (url: string) => boolean;
  validateImageFile: (file: File | null) => string | null;
  error: string | null;
  onError: (error: string | null) => void;
  onToggleShowLatestAdditions: (restaurantId: string, value: boolean) => Promise<void>;
  onSuccess: (message: string) => void;
  successMessage: string | null;
};

export default function RestaurantDetailsPanel({
  selectedRestaurant,
  viewMode,
  onViewModeChange,
  editingRestaurant,
  setEditingRestaurant,
  editName,
  setEditName,
  editDescription,
  setEditDescription,
  editLogoFile,
  setEditLogoFile,
  editLogoUrl,
  setEditLogoUrl,
  editLogoImageMode,
  setEditLogoImageMode,
  editLogoPreview,
  setEditLogoPreview,
  onUpdate,
  onCancelEdit,
  validateImageUrl,
  validateImageFile,
  error,
  onError,
  onToggleShowLatestAdditions,
  onSuccess,
  successMessage,
}: RestaurantDetailsPanelProps) {
  const router = useRouter();

  useEffect(() => {
    if (viewMode === "edit" && selectedRestaurant && !editingRestaurant) {
      setEditingRestaurant(selectedRestaurant);
      setEditName(selectedRestaurant.name);
      setEditDescription(selectedRestaurant.description || "");
      setEditLogoFile(null);
      setEditLogoUrl("");
      setEditLogoImageMode("upload");
      setEditLogoPreview(selectedRestaurant.logo_url);
    } else if (viewMode !== "edit" && editingRestaurant) {
      setEditingRestaurant(null);
    }
  }, [viewMode, selectedRestaurant, editingRestaurant, setEditingRestaurant, setEditName, setEditDescription, setEditLogoFile, setEditLogoUrl, setEditLogoImageMode, setEditLogoPreview]);

  const currentMode: ViewMode = viewMode;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {selectedRestaurant && (
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <button
                onClick={() => onViewModeChange("overview")}
                className={`px-4 py-2 text-sm font-medium transition ${
                  currentMode === "overview"
                    ? "text-bitebox border-b-2 border-bitebox"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Aperçu
              </button>
              <button
                onClick={() => {
                  if (selectedRestaurant) {
                    setEditingRestaurant(selectedRestaurant);
                    setEditName(selectedRestaurant.name);
                    setEditDescription(selectedRestaurant.description || "");
                    setEditLogoFile(null);
                    setEditLogoUrl("");
                    setEditLogoImageMode("upload");
                    setEditLogoPreview(selectedRestaurant.logo_url);
                    onViewModeChange("edit");
                  }
                }}
                className={`px-4 py-2 text-sm font-medium transition ${
                  currentMode === "edit"
                    ? "text-bitebox border-b-2 border-bitebox"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Modifier
              </button>
              <button
                onClick={() => {
                  onViewModeChange("menu");
                }}
                className={`px-4 py-2 text-sm font-medium transition ${
                  currentMode === "menu"
                    ? "text-bitebox border-b-2 border-bitebox"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Carte
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {currentMode === "menu" && selectedRestaurant ? (
          <div className="h-full">
            <RestaurantMenuTab restaurant={selectedRestaurant} onError={onError} />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/40 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="rounded-md bg-green-500/10 border border-green-500/40 px-3 py-2 text-sm text-green-300">
                {successMessage}
              </div>
            )}

            {currentMode === "edit" && !selectedRestaurant && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <p className="text-lg text-slate-400">Sélectionne une enseigne</p>
                  <p className="text-sm text-slate-500">
                    Choisis une enseigne dans la liste à gauche pour la modifier
                  </p>
                </div>
              </div>
            )}

            {currentMode === "edit" && selectedRestaurant && editingRestaurant && (
              <div className="bg-slate-900/80 rounded-2xl p-6 shadow-lg border border-slate-700/70 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    Modifier l'enseigne : {editingRestaurant.name}
                  </h2>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="text-xs text-slate-400 hover:text-slate-100"
                  >
                    Annuler
                  </button>
                </div>

                <form onSubmit={onUpdate} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">Nom de l'enseigne</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">
                      Description (optionnel)
                    </label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-bitebox"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-slate-300">Logo (optionnel)</label>
                    <LogoInput
                      mode={editLogoImageMode}
                      setMode={setEditLogoImageMode}
                      file={editLogoFile}
                      setFile={setEditLogoFile}
                      url={editLogoUrl}
                      setUrl={setEditLogoUrl}
                      preview={editLogoPreview}
                      setPreview={setEditLogoPreview}
                      validateImageUrl={validateImageUrl}
                    />
                  </div>

                  {/* Toggle Afficher Derniers ajouts */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <label className="text-xs text-slate-300 font-medium">
                          Afficher "Derniers ajouts"
                        </label>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Active/désactive l'affichage du bloc Derniers ajouts sur la page publique.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!editingRestaurant) return;
                          const newValue = !(editingRestaurant.show_latest_additions ?? true);
                          await onToggleShowLatestAdditions(editingRestaurant.id, newValue);
                        }}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-bitebox focus:ring-offset-2 ${
                          (editingRestaurant.show_latest_additions ?? true)
                            ? "bg-bitebox"
                            : "bg-slate-600"
                        }`}
                        role="switch"
                        aria-checked={editingRestaurant.show_latest_additions ?? true}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            (editingRestaurant.show_latest_additions ?? true)
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-bitebox px-4 py-2 text-sm font-semibold text-white shadow hover:bg-bitebox-dark"
                  >
                    Enregistrer les modifications
                  </button>
                </form>
              </div>
            )}

            {currentMode === "overview" && !selectedRestaurant && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <p className="text-lg text-slate-400">Sélectionne une enseigne</p>
                  <p className="text-sm text-slate-500">
                    Choisis une enseigne dans la liste à gauche pour voir ses détails
                  </p>
                </div>
              </div>
            )}

            {currentMode === "overview" && selectedRestaurant && (
              <div className="bg-slate-900/80 rounded-2xl p-6 shadow-lg border border-slate-800/60 space-y-4">
                <div className="flex items-start gap-4">
                  {selectedRestaurant.logo_url && (
                    <img
                      src={selectedRestaurant.logo_url}
                      alt={selectedRestaurant.name}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold">{selectedRestaurant.name}</h2>
                    {selectedRestaurant.slug && (
                      <p className="text-sm text-slate-400 mt-1">
                        /restaurants/{selectedRestaurant.slug}
                      </p>
                    )}
                    {selectedRestaurant.description && (
                      <p className="text-sm text-slate-300 mt-2">
                        {selectedRestaurant.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Toggle Afficher Derniers ajouts */}
                <div className="pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-slate-200">
                        Afficher "Derniers ajouts"
                      </label>
                      <p className="text-xs text-slate-400 mt-1">
                        Active/désactive l'affichage du bloc Derniers ajouts sur la page publique.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedRestaurant) return;
                        const newValue = !(selectedRestaurant.show_latest_additions ?? true);
                        await onToggleShowLatestAdditions(selectedRestaurant.id, newValue);
                      }}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-bitebox focus:ring-offset-2 ${
                        (selectedRestaurant.show_latest_additions ?? true)
                          ? "bg-bitebox"
                          : "bg-slate-600"
                      }`}
                      role="switch"
                      aria-checked={selectedRestaurant.show_latest_additions ?? true}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          (selectedRestaurant.show_latest_additions ?? true)
                            ? "translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-slate-800">
                  <button
                    onClick={() => {
                      router.push(`/restaurants/${selectedRestaurant.slug}`);
                    }}
                    className="px-4 py-2 text-sm rounded-lg border border-slate-700 hover:bg-slate-800 transition"
                  >
                    Voir la page publique
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Restaurant } from "./types";

type ViewMode = "details" | "edit" | "create";

type RestaurantDetailsPanelProps = {
  selectedRestaurant: Restaurant | null;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  // Props pour la création
  name: string;
  setName: (name: string) => void;
  description: string;
  setDescription: (description: string) => void;
  logoFile: File | null;
  setLogoFile: (file: File | null) => void;
  logoUrl: string;
  setLogoUrl: (url: string) => void;
  logoImageMode: "upload" | "url";
  setLogoImageMode: (mode: "upload" | "url") => void;
  logoPreview: string | null;
  setLogoPreview: (preview: string | null) => void;
  saving: boolean;
  onCreate: (e: React.FormEvent) => void;
  onResetCreateForm: () => void;
  // Props pour l'édition
  editingRestaurant: Restaurant | null;
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
  // Validation
  validateImageUrl: (url: string) => boolean;
  validateImageFile: (file: File | null) => string | null;
  error: string | null;
};

export default function RestaurantDetailsPanel({
  selectedRestaurant,
  viewMode,
  onViewModeChange,
  name,
  setName,
  description,
  setDescription,
  logoFile,
  setLogoFile,
  logoUrl,
  setLogoUrl,
  logoImageMode,
  setLogoImageMode,
  logoPreview,
  setLogoPreview,
  saving,
  onCreate,
  onResetCreateForm,
  editingRestaurant,
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
}: RestaurantDetailsPanelProps) {
  const router = useRouter();

  // Déterminer le mode d'affichage actuel
  const currentMode: ViewMode =
    viewMode === "create"
      ? "create"
      : editingRestaurant
      ? "edit"
      : selectedRestaurant
      ? "details"
      : "details";

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

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-950 overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header avec onglets */}
        <div className="flex items-center justify-between border-b border-slate-800">
          <div className="flex gap-4">
            {selectedRestaurant && (
              <>
                <button
                  onClick={() => onViewModeChange("details")}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    currentMode === "details"
                      ? "text-bitebox border-b-2 border-bitebox"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Détails
                </button>
                <button
                  onClick={() => {
                    onViewModeChange("edit");
                  }}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    currentMode === "edit"
                      ? "text-bitebox border-b-2 border-bitebox"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Modifier
                </button>
              </>
            )}
            <button
              onClick={() => {
                onResetCreateForm();
                onViewModeChange("create");
              }}
              className={`px-4 py-2 text-sm font-medium transition ${
                currentMode === "create"
                  ? "text-bitebox border-b-2 border-bitebox"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Créer
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Contenu selon le mode */}
        {currentMode === "create" && (
          <div className="bg-slate-900/80 rounded-2xl p-6 shadow-lg border border-slate-800/60 space-y-4">
            <h2 className="text-lg font-semibold">Ajouter une nouvelle enseigne</h2>

            <form onSubmit={onCreate} className="space-y-4">
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
        )}

        {currentMode === "edit" && editingRestaurant && (
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
                {renderLogoInput(
                  editLogoImageMode,
                  setEditLogoImageMode,
                  editLogoFile,
                  setEditLogoFile,
                  editLogoUrl,
                  setEditLogoUrl,
                  editLogoPreview,
                  setEditLogoPreview
                )}
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

        {currentMode === "details" && !selectedRestaurant && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <p className="text-lg text-slate-400">Sélectionne une enseigne</p>
              <p className="text-sm text-slate-500">
                Choisis une enseigne dans la liste à gauche pour voir ses détails
              </p>
            </div>
          </div>
        )}

        {currentMode === "details" && selectedRestaurant && (
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

            <div className="flex gap-2 pt-4 border-t border-slate-800">
              <button
                onClick={() => {
                  router.push(`/restaurants/${selectedRestaurant.slug}`);
                }}
                className="px-4 py-2 text-sm rounded-lg border border-slate-700 hover:bg-slate-800 transition"
              >
                Voir la page publique
              </button>
              <button
                onClick={() => {
                  // Rediriger vers la page admin avec le paramètre manage
                  window.location.href = `/admin/restaurants?manage=${selectedRestaurant.id}`;
                }}
                className="px-4 py-2 text-sm rounded-lg bg-bitebox text-white hover:bg-bitebox-dark transition"
              >
                Gérer la carte
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


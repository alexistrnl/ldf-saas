"use client";

import { useState, useRef, useEffect } from "react";

type DishImageProps = {
  src: string | null;
  alt: string;
  className?: string;
  size?: "default" | "small" | "mini";
  onImageError?: (src: string | null) => void;
};

type DisplayMode = "cover" | "contain";

/**
 * Détecte si une URL pointe vers une image PNG
 * @param url URL de l'image
 * @returns true si l'URL contient .png (insensible à la casse, gère les query params)
 */
function isPngUrl(url: string): boolean {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  // Détecter .png même avec query params (ex: image.png?v=123 ou .png?width=...)
  const urlWithoutQuery = urlLower.split("?")[0];
  return urlWithoutQuery.endsWith(".png") || urlLower.includes(".png");
}

/**
 * Détecte si l'URL contient des keywords typiques d'images packshot
 */
function isPackshotUrl(url: string): boolean {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  return (
    urlLower.includes("transparent") ||
    urlLower.includes("packshot") ||
    urlLower.includes("product") ||
    urlLower.includes("isolated")
  );
}

/**
 * Composant universel pour afficher les images de plats
 * 
 * Détection automatique du mode d'affichage :
 * - Par défaut: mode "cover" (remplit le cadre)
 * - Si PNG ou packshot: mode "contain" (affiche l'image complète sans rognage)
 * - Post-load: vérifie le ratio et ajuste si nécessaire
 */
export default function DishImage({
  src,
  alt,
  className = "",
  size = "default",
  onImageError,
}: DishImageProps) {
  const [imageError, setImageError] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("cover");
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Détection initiale basée sur l'URL
  useEffect(() => {
    if (!src) {
      setDisplayMode("cover");
      return;
    }

    // Si PNG ou packshot détecté, passer en mode contain
    if (isPngUrl(src) || isPackshotUrl(src)) {
      setDisplayMode("contain");
    } else {
      setDisplayMode("cover");
    }
  }, [src]);

  // Vérification post-load du ratio de l'image
  const handleImageLoad = () => {
    if (!imgRef.current) return;

    const img = imgRef.current;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    if (naturalWidth === 0 || naturalHeight === 0) return;

    const imageRatio = naturalWidth / naturalHeight;
    const containerRatio = 4 / 3; // aspect-[4/3] du conteneur

    // Si ratio extrême (trop large ou trop haut), basculer en contain
    // Ratio extrême = plus de 2x différent du ratio du conteneur
    const isExtremeRatio =
      imageRatio > containerRatio * 2 || imageRatio < containerRatio / 2;

    if (isExtremeRatio && displayMode === "cover") {
      setDisplayMode("contain");
    }

    setImageLoaded(true);
  };

  // Hauteur selon la taille
  const heightClass =
    size === "small"
      ? "h-20"
      : size === "mini"
      ? "h-16"
      : "h-[160px] sm:h-[180px]";

  // Placeholder si pas d'URL ou image cassée
  if (!src || imageError) {
    return (
      <div
        className={`${heightClass} w-full rounded-lg overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm flex items-center justify-center border border-white/5 ${className}`}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-2xl opacity-60">🍽️</span>
          <span className="text-xs text-slate-500">Pas d'image</span>
        </div>
      </div>
    );
  }

  const isContainMode = displayMode === "contain";
  const scale = isContainMode ? 1.08 : 1; // Légère scale en contain pour éviter "tout petit"
  
  // Padding adapté selon la taille
  const paddingClass = isContainMode
    ? size === "default"
      ? "p-3"
      : size === "small"
      ? "p-2"
      : "p-1.5"
    : "";

  return (
    <div
      className={`${heightClass} w-full rounded-lg overflow-hidden bg-white/5 backdrop-blur-sm relative border border-white/5 ${className}`}
    >
      <div
        className={`w-full h-full flex items-center justify-center ${paddingClass}`}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          onError={() => {
            setImageError(true);
            if (onImageError && src) {
              onImageError(src);
            }
          }}
          onLoad={handleImageLoad}
          className={`transition-all duration-300 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          style={{
            width: isContainMode ? "auto" : "100%",
            height: isContainMode ? "auto" : "100%",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: isContainMode ? "contain" : "cover",
            objectPosition: "center",
            transform: `scale(${scale})`,
            filter: isContainMode
              ? "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))"
              : "none",
          }}
        />
      </div>
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

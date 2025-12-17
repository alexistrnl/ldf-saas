"use client";

import { useState } from "react";

type DishImageProps = {
  imageUrl: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
  size?: "default" | "small" | "tiny" | "mini";
};

/**
 * Détecte si une URL pointe vers une image PNG
 * @param url URL de l'image
 * @returns true si l'URL contient .png (insensible à la casse, gère les query params)
 */
function isPngImage(url: string): boolean {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  // Détecter .png même avec query params (ex: image.png?v=123)
  return urlLower.includes('.png');
}

/**
 * Composant unifié pour afficher les images de plats
 * 
 * Règles d'affichage automatiques basées sur le format :
 * 
 * 1️⃣ Images PNG (fond blanc / produit détouré) :
 *    - object-fit: contain
 *    - object-position: center
 *    - padding interne (10-14px) pour éviter l'effet "image perdue dans un cadre"
 *    - Objectif : voir l'intégralité du plat sans trop de marge, bien centré
 * 
 * 2️⃣ Autres formats (jpg, jpeg, webp, etc.) :
 *    - object-fit: cover
 *    - object-position: center
 *    - pas de padding, image bord à bord
 *    - Objectif : image pleine, immersive, bord à bord
 */
export default function DishImage({
  imageUrl,
  alt,
  className = "",
  containerClassName = "",
  size = "default",
}: DishImageProps) {
  const [imageError, setImageError] = useState(false);

  // Tailles prédéfinies avec ratio stable
  const sizeClasses = {
    default: "w-full aspect-[4/3] rounded-xl",
    small: "w-20 h-20 rounded-lg",
    tiny: "w-12 h-12 rounded-lg",
    mini: "w-16 h-16 rounded-lg",
  };

  const containerClass = `relative overflow-hidden bg-slate-900/60 ${sizeClasses[size]} ${containerClassName}`;

  // Placeholder si pas d'URL ou image cassée
  if (!imageUrl || imageError) {
    return (
      <div className={`${containerClass} flex items-center justify-center bg-slate-800`}>
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg">🍽️</span>
          <span className="text-xs text-slate-500">Pas d'image</span>
        </div>
      </div>
    );
  }

  // Détection automatique du format à partir de l'URL
  const isPng = isPngImage(imageUrl);

  // Styles selon le format
  // PNG : contain + padding interne pour éviter l'effet "image perdue dans un cadre"
  // Autres : cover pour remplir complètement le cadre (bord à bord)
  const imageClass = isPng
    ? "w-full h-full object-contain object-center"
    : "w-full h-full object-cover object-center";

  // Padding interne pour les PNG (adapté selon la taille)
  // Objectif : éviter l'effet "image perdue dans un cadre" tout en gardant le plat entier visible
  const paddingClass = isPng
    ? size === "default"
      ? "p-[14px]" // 14px pour les grandes images (dans la plage 10-14px demandée)
      : size === "small"
      ? "p-2" // 8px pour les moyennes
      : "p-1" // 4px pour les petites
    : "";

  return (
    <div className={containerClass}>
      <div className={`w-full h-full ${paddingClass} flex items-center justify-center`}>
        <img
          src={imageUrl}
          alt={alt}
          className={`${imageClass} ${className}`}
          onError={() => setImageError(true)}
        />
      </div>
    </div>
  );
}


"use client";

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
 * @returns true si l'URL se termine par .png (insensible à la casse)
 */
function isPngImage(url: string): boolean {
  if (!url) return false;
  // Extraire le chemin sans paramètres de requête ni fragments
  const path = url.split('?')[0].split('#')[0];
  return path.toLowerCase().endsWith('.png');
}

/**
 * Composant unifié pour afficher les images de plats
 * 
 * Règles d'affichage automatiques basées sur le format :
 * 
 * 1️⃣ Images PNG :
 *    - object-fit: contain
 *    - scale: 0.9-0.95 (dézoom léger)
 *    - object-position: center
 *    - Objectif : voir l'intégralité du plat sans qu'il soit collé ou coupé
 * 
 * 2️⃣ Autres formats (jpg, jpeg, webp, etc.) :
 *    - object-fit: cover
 *    - scale: 1
 *    - object-position: center
 *    - Objectif : image pleine, immersive, bord à bord
 */
export default function DishImage({
  imageUrl,
  alt,
  className = "",
  containerClassName = "",
  size = "default",
}: DishImageProps) {
  // Tailles prédéfinies
  const sizeClasses = {
    default: "w-full aspect-[4/3] rounded-xl",
    small: "w-20 h-20 rounded-lg",
    tiny: "w-12 h-12 rounded-lg",
    mini: "w-16 h-16 rounded-lg",
  };

  const containerClass = `relative overflow-hidden bg-slate-900/60 ${sizeClasses[size]} ${containerClassName}`;

  if (!imageUrl) {
    return (
      <div className={`${containerClass} flex items-center justify-center`}>
        <span className="text-xs text-slate-500">Pas d'image</span>
      </div>
    );
  }

  // Détection automatique du format à partir de l'URL
  const isPng = isPngImage(imageUrl);

  // Styles selon le format
  // PNG : contain + scale pour voir l'intégralité sans couper
  // Autres : cover pour remplir complètement le cadre
  const imageClass = isPng
    ? "w-full h-full object-contain object-center scale-[0.92]"
    : "w-full h-full object-cover object-center";

  return (
    <div className={containerClass}>
      <img
        src={imageUrl}
        alt={alt}
        className={`${imageClass} ${className}`}
      />
    </div>
  );
}


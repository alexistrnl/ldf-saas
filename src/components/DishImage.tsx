"use client";

type DishImageProps = {
  imageUrl: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
  size?: "default" | "small" | "tiny" | "mini";
};

/**
 * Composant unifié pour afficher les images de plats
 * Règle unique : toutes les images se comportent comme un cover
 * - remplissent entièrement leur conteneur
 * - centrées horizontalement et verticalement
 * - crop autorisé si nécessaire
 * - aucun fond blanc visible autour
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

  return (
    <div className={containerClass}>
      <img
        src={imageUrl}
        alt={alt}
        className={`w-full h-full object-cover object-center ${className}`}
      />
    </div>
  );
}


/**
 * Retourne les classes Tailwind d'accent basées sur l'avatar de l'utilisateur
 * 
 * Utilise des classes hardcodées pour éviter la purge Tailwind
 */

export type AvatarVariant = "violet" | "bleu" | "orange" | "rouge" | "vert";

export type AvatarTheme = {
  text: string;        // Classe pour le texte (ex: text-violet-400)
  textHover: string;   // Classe pour le texte au hover
  bgSoft: string;      // Classe pour un background subtil (ex: bg-violet-500/10)
  border: string;      // Classe pour les bordures (ex: border-violet-500/30)
  borderLeft: string;  // Classe pour la bordure gauche accentuée (ex: border-l-violet-500/60)
  ring: string;        // Classe pour les rings (ex: ring-violet-500/30)
  buttonOutline: string; // Classe pour les boutons outline
  buttonFilled: string;  // Classe pour les boutons filled
  borderSoft: string;   // Classe pour bordures très subtiles (/20)
  borderExtraSoft: string; // Classe pour bordures ultra subtiles (/15)
  ringSoft: string;     // Classe pour rings très subtils (/10)
};

/**
 * Mapping des classes Tailwind par variante d'avatar
 * IMPORTANT: Classes hardcodées pour éviter la purge Tailwind
 */
const THEME_MAP: Record<AvatarVariant, AvatarTheme> = {
  violet: {
    text: "text-violet-400",
    textHover: "hover:text-violet-300",
    bgSoft: "bg-violet-500/10",
    border: "border-violet-500/30",
    borderLeft: "border-l-violet-500/60",
    ring: "ring-violet-500/30",
    buttonOutline: "border-violet-500/50 text-violet-400 hover:bg-violet-500/10",
    buttonFilled: "bg-violet-500 text-white hover:bg-violet-600",
    borderSoft: "border-violet-500/20",
    borderExtraSoft: "border-violet-500/15",
    ringSoft: "ring-violet-500/10",
  },
  bleu: {
    text: "text-blue-400",
    textHover: "hover:text-blue-300",
    bgSoft: "bg-blue-500/10",
    border: "border-blue-500/30",
    borderLeft: "border-l-blue-500/60",
    ring: "ring-blue-500/30",
    buttonOutline: "border-blue-500/50 text-blue-400 hover:bg-blue-500/10",
    buttonFilled: "bg-blue-500 text-white hover:bg-blue-600",
    borderSoft: "border-blue-500/20",
    borderExtraSoft: "border-blue-500/15",
    ringSoft: "ring-blue-500/10",
  },
  orange: {
    text: "text-orange-400",
    textHover: "hover:text-orange-300",
    bgSoft: "bg-orange-500/10",
    border: "border-orange-500/30",
    borderLeft: "border-l-orange-500/60",
    ring: "ring-orange-500/30",
    buttonOutline: "border-orange-500/50 text-orange-400 hover:bg-orange-500/10",
    buttonFilled: "bg-orange-500 text-white hover:bg-orange-600",
    borderSoft: "border-orange-500/20",
    borderExtraSoft: "border-orange-500/15",
    ringSoft: "ring-orange-500/10",
  },
  rouge: {
    text: "text-red-400",
    textHover: "hover:text-red-300",
    bgSoft: "bg-red-500/10",
    border: "border-red-500/30",
    borderLeft: "border-l-red-500/60",
    ring: "ring-red-500/30",
    buttonOutline: "border-red-500/50 text-red-400 hover:bg-red-500/10",
    buttonFilled: "bg-red-500 text-white hover:bg-red-600",
    borderSoft: "border-red-500/20",
    borderExtraSoft: "border-red-500/15",
    ringSoft: "ring-red-500/10",
  },
  vert: {
    text: "text-emerald-400",
    textHover: "hover:text-emerald-300",
    bgSoft: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    borderLeft: "border-l-emerald-500/60",
    ring: "ring-emerald-500/30",
    buttonOutline: "border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10",
    buttonFilled: "bg-emerald-500 text-white hover:bg-emerald-600",
    borderSoft: "border-emerald-500/20",
    borderExtraSoft: "border-emerald-500/15",
    ringSoft: "ring-emerald-500/10",
  },
};

/**
 * Déduit la variante d'avatar depuis avatar_url ou avatar_variant
 */
function getAvatarVariant(avatarUrl: string | null | undefined, avatarVariant?: string | null): AvatarVariant {
  // Si avatar_variant est fourni et valide, l'utiliser
  if (avatarVariant && avatarVariant in THEME_MAP) {
    return avatarVariant as AvatarVariant;
  }

  // Sinon, déduire depuis avatar_url
  if (!avatarUrl) return "violet";

  const urlLower = avatarUrl.toLowerCase();
  
  if (urlLower.includes("bleu")) return "bleu";
  if (urlLower.includes("orange")) return "orange";
  if (urlLower.includes("rouge")) return "rouge";
  if (urlLower.includes("vert")) return "vert";
  if (urlLower.includes("violet")) return "violet";

  // Fallback
  return "violet";
}

/**
 * Retourne le thème d'accent basé sur l'avatar
 * 
 * @param avatarUrl - URL de l'avatar
 * @param avatarVariant - Variante explicite (optionnel)
 * @returns Objet avec les classes Tailwind d'accent
 */
export function getAvatarAccentTheme(
  avatarUrl: string | null | undefined,
  avatarVariant?: string | null
): AvatarTheme {
  const variant = getAvatarVariant(avatarUrl, avatarVariant);
  return THEME_MAP[variant];
}


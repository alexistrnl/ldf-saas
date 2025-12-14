/**
 * Retourne les classes Tailwind d'accent basées sur l'avatar de l'utilisateur
 * 
 * Utilise des classes hardcodées pour éviter la purge Tailwind
 */

export type AvatarVariant = "red" | "violet" | "blue" | "green" | "pink";

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

export type AccentStyles = {
  border: string;      // Classe border pour les accents
  ring: string;        // Classe ring pour les accents
  shadow: string;       // Classe shadow pour les accents (optionnel)
};

/**
 * Mapping des classes Tailwind par variante d'avatar
 * IMPORTANT: Classes hardcodées pour éviter la purge Tailwind
 */
const THEME_MAP: Record<AvatarVariant, AvatarTheme> = {
  red: {
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
  blue: {
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
  green: {
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
  pink: {
    text: "text-pink-400",
    textHover: "hover:text-pink-300",
    bgSoft: "bg-pink-500/10",
    border: "border-pink-500/30",
    borderLeft: "border-l-pink-500/60",
    ring: "ring-pink-500/30",
    buttonOutline: "border-pink-500/50 text-pink-400 hover:bg-pink-500/10",
    buttonFilled: "bg-pink-500 text-white hover:bg-pink-600",
    borderSoft: "border-pink-500/20",
    borderExtraSoft: "border-pink-500/15",
    ringSoft: "ring-pink-500/10",
  },
};

/**
 * Mapping des styles d'accent pour les cartes (border + ring + shadow)
 */
const ACCENT_STYLES_MAP: Record<AvatarVariant, AccentStyles> = {
  red: {
    border: "border-red-500/30",
    ring: "ring-1 ring-red-400/20",
    shadow: "", // Pas de shadow arbitraire pour éviter les problèmes Tailwind
  },
  violet: {
    border: "border-violet-500/30",
    ring: "ring-1 ring-violet-400/20",
    shadow: "",
  },
  blue: {
    border: "border-blue-500/30",
    ring: "ring-1 ring-blue-400/20",
    shadow: "",
  },
  green: {
    border: "border-emerald-500/30",
    ring: "ring-1 ring-emerald-400/20",
    shadow: "",
  },
  pink: {
    border: "border-pink-500/30",
    ring: "ring-1 ring-pink-400/20",
    shadow: "",
  },
};

/**
 * Retourne les styles d'accent (border + ring) pour les cartes profil
 * SOURCE DE VÉRITÉ UNIQUE pour les accents des cartes
 */
export function getAccentStyles(variant: AvatarVariant | null | undefined): AccentStyles {
  const safeVariant = (variant && variant in ACCENT_STYLES_MAP) ? variant : "violet";
  return ACCENT_STYLES_MAP[safeVariant];
}

/**
 * Déduit la variante d'avatar depuis avatar_url ou avatar_variant
 * Source de vérité unique pour la couleur d'accent
 */
function getAvatarVariant(avatarUrl: string | null | undefined, avatarVariant?: string | null): AvatarVariant {
  // Si avatar_variant est fourni et valide, l'utiliser (priorité absolue)
  if (avatarVariant && avatarVariant in THEME_MAP) {
    return avatarVariant as AvatarVariant;
  }

  // Sinon, déduire depuis avatar_url (fallback uniquement)
  if (!avatarUrl) {
    if (process.env.NODE_ENV === "development") {
      console.log("[AvatarTheme] Missing avatar_url and avatar_variant, fallback to violet");
    }
    return "violet";
  }

  const urlLower = avatarUrl.toLowerCase();
  
  // Détection robuste : français ET anglais, conversion vers valeurs anglaises
  // Rouge / Red
  if (urlLower.includes("rouge") || urlLower.includes("red")) {
    return "red";
  }
  
  // Violet / Purple  
  if (urlLower.includes("violet") || urlLower.includes("purple")) {
    return "violet";
  }
  
  // Orange -> pas dans les nouvelles valeurs, utiliser pink comme fallback
  if (urlLower.includes("orange")) {
    return "pink"; // Orange n'existe plus, utiliser pink
  }
  
  // Bleu / Blue
  if (urlLower.includes("bleu") || urlLower.includes("blue")) {
    return "blue";
  }
  
  // Vert / Green
  if (urlLower.includes("vert") || urlLower.includes("green")) {
    return "green";
  }
  
  // Pink
  if (urlLower.includes("pink") || urlLower.includes("rose")) {
    return "pink";
  }

  // Fallback avec log en dev
  if (process.env.NODE_ENV === "development") {
    console.warn("[AvatarTheme] Could not detect variant from avatar_url, fallback to violet:", avatarUrl);
  }
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
  
  // Log en dev pour debug
  if (process.env.NODE_ENV === "development") {
    console.log("[AvatarTheme] getAvatarAccentTheme - avatar_variant:", avatarVariant, "avatar_url:", avatarUrl, "→ variant:", variant);
  }
  
  return THEME_MAP[variant];
}


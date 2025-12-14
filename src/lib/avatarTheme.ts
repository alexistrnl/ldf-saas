/**
 * Retourne les classes Tailwind d'accent basées sur l'avatar de l'utilisateur
 * 
 * Utilise des classes hardcodées pour éviter la purge Tailwind
 */

export type AvatarVariant = "red" | "purple" | "blue" | "green" | "orange";

/**
 * Mapping avatar_variant → URL de l'avatar
 */
const AVATAR_URL_MAP: Record<AvatarVariant, string> = {
  red: "/avatar/avatar-rouge.png",
  purple: "/avatar/avatar-violet.png",
  blue: "/avatar/avatar-bleu.png",
  green: "/avatar/avatar-vert.png",
  orange: "/avatar/avatar-orange.png",
};

/**
 * Mapping avatar_variant → couleur d'accent (hex)
 */
const AVATAR_COLOR_MAP: Record<AvatarVariant, string> = {
  red: "#ef4444",      // red-500
  purple: "#8b5cf6",   // violet-500
  blue: "#3b82f6",     // blue-500
  green: "#10b981",    // emerald-500
  orange: "#f97316",   // orange-500
};

/**
 * Retourne le thème complet basé sur avatar_variant
 * SOURCE DE VÉRITÉ UNIQUE pour l'avatar et les accents
 */
export function getAvatarThemeFromVariant(variant: AvatarVariant | string | null | undefined): {
  variant: AvatarVariant;
  accent: string;           // Couleur d'accent principale (hex)
  accentSoft: string;       // Couleur d'accent avec alpha (rgba)
  ring: string;             // Style inline pour ring/border (boxShadow)
  avatarSrc: string;        // URL de l'image avatar
  glow: string;             // Style inline pour glow autour de l'avatar
} {
  // Normaliser la valeur : convertir en string, lowercase, trim
  let normalizedVariant: AvatarVariant = "purple"; // fallback
  
  if (variant) {
    const v = variant.toString().toLowerCase().trim();
    // Mapping explicite des valeurs possibles
    if (v === "red" && v in AVATAR_URL_MAP) {
      normalizedVariant = "red";
    } else if (v === "purple" && v in AVATAR_URL_MAP) {
      normalizedVariant = "purple";
    } else if (v === "blue" && v in AVATAR_URL_MAP) {
      normalizedVariant = "blue";
    } else if (v === "green" && v in AVATAR_URL_MAP) {
      normalizedVariant = "green";
    } else if (v === "orange" && v in AVATAR_URL_MAP) {
      normalizedVariant = "orange";
    } else if (v in AVATAR_URL_MAP) {
      // Si c'est déjà une valeur valide dans le map
      normalizedVariant = v as AvatarVariant;
    }
    // Sinon, reste sur "purple" (fallback)
  }
  
  const safeVariant: AvatarVariant = normalizedVariant;
  
  const accentHex = AVATAR_COLOR_MAP[safeVariant];
  
  // Convertir hex en rgba avec alpha
  const r = parseInt(accentHex.slice(1, 3), 16);
  const g = parseInt(accentHex.slice(3, 5), 16);
  const b = parseInt(accentHex.slice(5, 7), 16);
  const accentSoft = `rgba(${r}, ${g}, ${b}, 0.2)`;
  const glow = `rgba(${r}, ${g}, ${b}, 0.33)`;
  
  return {
    variant: safeVariant,
    accent: accentHex,
    accentSoft: accentSoft,
    ring: `0 0 0 1px ${accentSoft}`,
    glow: `0 0 20px ${glow}`,
    avatarSrc: AVATAR_URL_MAP[safeVariant],
  };
}

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
  purple: {
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
  purple: {
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
  orange: {
    border: "border-orange-500/30",
    ring: "ring-1 ring-orange-400/20",
    shadow: "",
  },
};

/**
 * Retourne les styles d'accent (border + ring) pour les cartes profil
 * SOURCE DE VÉRITÉ UNIQUE pour les accents des cartes
 */
export function getAccentStyles(variant: AvatarVariant | null | undefined): AccentStyles {
  const safeVariant = (variant && variant in ACCENT_STYLES_MAP) ? variant : "purple";
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
      console.log("[AvatarTheme] Missing avatar_url and avatar_variant, fallback to purple");
    }
    return "purple";
  }

  const urlLower = avatarUrl.toLowerCase();
  
  // Détection robuste : français ET anglais, conversion vers valeurs anglaises
  // Rouge / Red
  if (urlLower.includes("rouge") || urlLower.includes("red")) {
    return "red";
  }
  
  // Violet / Purple  
  if (urlLower.includes("violet") || urlLower.includes("purple")) {
    return "purple";
  }
  
  // Orange
  if (urlLower.includes("orange")) {
    return "orange";
  }
  
  // Bleu / Blue
  if (urlLower.includes("bleu") || urlLower.includes("blue")) {
    return "blue";
  }
  
  // Vert / Green
  if (urlLower.includes("vert") || urlLower.includes("green")) {
    return "green";
  }

  // Fallback avec log en dev
  if (process.env.NODE_ENV === "development") {
    console.warn("[AvatarTheme] Could not detect variant from avatar_url, fallback to purple:", avatarUrl);
  }
  return "purple";
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


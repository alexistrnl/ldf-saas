import { UserProfile } from "./profile";
import { getAccentColor } from "./profile";

const AVATAR_PRESET_URLS: Record<string, string> = {
  purple: "/avatar/avatar-violet.png",
  blue: "/avatar/avatar-bleu.png",
  green: "/avatar/avatar-vert.png",
  red: "/avatar/avatar-rouge.png",
  orange: "/avatar/avatar-orange.png",
};

/**
 * Obtient l'URL de l'avatar à afficher selon avatar_type
 */
export function getAvatarUrl(profile: UserProfile | null | undefined): string {
  if (!profile) {
    return AVATAR_PRESET_URLS.purple; // Fallback
  }

  // Si avatar_type === 'photo', utiliser avatar_url
  if (profile.avatar_type === 'photo' && profile.avatar_url) {
    return profile.avatar_url;
  }

  // Si avatar_type === 'preset' (ou null/undefined), utiliser avatar_preset
  const preset = profile.avatar_preset || profile.avatar_variant || 'purple';
  return AVATAR_PRESET_URLS[preset] || AVATAR_PRESET_URLS.purple;
}

/**
 * Obtient la couleur d'accent avec fallback
 */
export function getProfileAccentColor(profile: UserProfile | null | undefined): string {
  return getAccentColor(profile);
}

/**
 * Convertit une couleur hex en rgba avec alpha
 */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

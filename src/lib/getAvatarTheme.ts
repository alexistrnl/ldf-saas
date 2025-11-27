/**
 * Retourne la couleur de thème associée à l'avatar de l'utilisateur
 */
export function getAvatarTheme(avatarUrl: string | null | undefined) {
  if (!avatarUrl) return { color: "#6A24A4" };

  if (avatarUrl.includes("bleu")) return { color: "#0BB7DD" };
  if (avatarUrl.includes("orange")) return { color: "#FF8A00" };
  if (avatarUrl.includes("rouge")) return { color: "#EB1D36" };
  if (avatarUrl.includes("vert")) return { color: "#19B64A" };
  if (avatarUrl.includes("violet")) return { color: "#6A24A4" };

  return { color: "#6A24A4" };
}

/**
 * Convertit une couleur hex en rgba avec une opacité donnée
 */
export function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}


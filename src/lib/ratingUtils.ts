/**
 * Arrondit un nombre à 2 décimales maximum
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Calcule la note publique d'une enseigne avec la règle "1 utilisateur = 1 voix"
 * 
 * Règle métier :
 * - Pour chaque utilisateur qui a noté l'enseigne, on calcule d'abord sa moyenne personnelle
 * - Puis on fait la moyenne de ces moyennes utilisateur
 * - Cela évite qu'un utilisateur qui a noté plusieurs fois pèse plus lourd
 * 
 * @param logs - Liste des logs avec user_id et rating
 * @returns { publicRating: nombre, uniqueVotersCount: nombre }
 */
export function calculatePublicRating(logs: Array<{ user_id: string; rating: number | null }>) {
  if (!logs || logs.length === 0) {
    return { publicRating: 0, uniqueVotersCount: 0 }
  }

  // Étape 1 : Grouper par user_id et calculer la moyenne pour chaque utilisateur
  const userRatingsMap = new Map<string, { sum: number; count: number }>()

  for (const log of logs) {
    if (!log.user_id || typeof log.rating !== 'number') continue

    const current = userRatingsMap.get(log.user_id) ?? { sum: 0, count: 0 }
    userRatingsMap.set(log.user_id, {
      sum: current.sum + log.rating,
      count: current.count + 1,
    })
  }

  // Étape 2 : Calculer la moyenne pour chaque utilisateur
  const userAverages: number[] = []
  for (const [userId, stats] of userRatingsMap.entries()) {
    if (stats.count > 0) {
      const userAvg = stats.sum / stats.count
      userAverages.push(userAvg)
    }
  }

  // Étape 3 : Calculer la moyenne globale de ces moyennes utilisateur
  const uniqueVotersCount = userAverages.length
  const publicRating =
    uniqueVotersCount > 0
      ? roundToTwoDecimals(userAverages.reduce((acc, avg) => acc + avg, 0) / uniqueVotersCount)
      : 0

  return {
    publicRating,
    uniqueVotersCount,
  }
}

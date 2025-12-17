import { supabase } from '@/lib/supabaseClient'

/**
 * Formate un message d'erreur utilisateur pour les erreurs RLS Supabase
 * Affiche un message clair selon si l'utilisateur est connecté ou non
 * 
 * @param error - L'erreur Supabase
 * @param tableName - Nom de la table (optionnel, pour context)
 * @returns Message d'erreur formaté pour l'utilisateur
 */
export async function formatRLSError(error: any): Promise<string> {
  // Vérifier si c'est une erreur RLS
  const isRLSError = 
    error?.code === "42501" || 
    error?.message?.toLowerCase().includes("permission denied") ||
    error?.message?.toLowerCase().includes("row-level security") ||
    error?.message?.toLowerCase().includes("rls");

  if (!isRLSError) {
    // Si ce n'est pas une erreur RLS, retourner le message original
    return error?.message || "Une erreur est survenue";
  }

  // Logger l'erreur technique pour le debug
  console.error("[RLS Error] Technical details:", {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    fullError: error,
  });

  // Vérifier si l'utilisateur est connecté
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return "Action impossible : vous devez être connecté pour effectuer cette action.";
    } else {
      return "Action refusée : vous n'avez pas les droits administrateur pour effectuer cette action.";
    }
  } catch (authError) {
    // En cas d'erreur lors de la vérification de l'auth, considérer comme non connecté
    console.error("[RLS Error] Error checking user auth:", authError);
    return "Action impossible : vous devez être connecté pour effectuer cette action.";
  }
}


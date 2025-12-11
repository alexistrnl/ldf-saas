import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  const url = req.nextUrl.clone();

  const isMobileOrTablet = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  const pathname = url.pathname;

  const isApi = pathname.startsWith("/api");
  const isNextStatic =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff2?)$/);

  // ============================================================
  // COUCHE 1 : Gestion desktop vs mobile/tablette
  // Cette logique doit s'exécuter EN PREMIER, avant toute autre logique
  // ============================================================
  if (!isApi && !isNextStatic) {
    // Si desktop et pas déjà sur /desktop-info -> rediriger vers /desktop-info
    if (!isMobileOrTablet && pathname !== "/desktop-info") {
      url.pathname = "/desktop-info";
      return NextResponse.redirect(url);
    }

    // Si mobile/tablette et sur /desktop-info -> rediriger vers /
    if (isMobileOrTablet && pathname === "/desktop-info") {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // Ne rien faire pour API et fichiers statiques
  if (isApi || isNextStatic) {
    return NextResponse.next();
  }

  // ============================================================
  // COUCHE 2 : Logique d'authentification ou autres redirections
  // Cette logique s'exécute uniquement si on n'a pas déjà redirigé ci-dessus
  // ============================================================
  // (Aucune logique d'auth dans le middleware actuellement)
  // La logique d'auth est gérée au niveau des pages (src/app/page.tsx)
  // Si vous souhaitez ajouter une logique d'auth ici, elle s'exécutera
  // uniquement pour les utilisateurs mobile/tablette non redirigés

  // Sinon, laisser passer
  return NextResponse.next();
}

// Appliquer le middleware sur toutes les routes "app" par défaut
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};


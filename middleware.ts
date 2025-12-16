import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "./src/lib/supabase/middleware";

export async function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  const url = req.nextUrl.clone();

  const isMobileOrTablet = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  const pathname = url.pathname;

  const isApi = pathname.startsWith("/api");
  const isNextStatic =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff2?)$/);

  // Routes qui ne doivent JAMAIS être bloquées par le desktop-block (même sur PC)
  const allowedDesktopRoutes = [
    "/login",
    "/signup",
    "/reset-password",
    "/confirmation",
    "/forgot-password",
  ];
  const isAllowedDesktopRoute = 
    allowedDesktopRoutes.includes(pathname) ||
    pathname.startsWith("/auth/");

  // ============================================================
  // COUCHE 1 : Authentification Supabase (rafraîchir session)
  // ============================================================
  // Toujours appeler updateSession pour rafraîchir la session
  const { supabaseResponse, user, isAdmin } = await updateSession(req);

  // Protection de /admin/* : si pas d'utilisateur → redirect vers /login?next=<pathname>
  // Si user connecté mais non admin → redirect vers /
  if (pathname.startsWith("/admin/")) {
    if (!user) {
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    // Si utilisateur connecté mais non admin → rediriger vers /
    if (!isAdmin) {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    // Si admin, /admin/* est autorisé (desktop et mobile)
    // Continuer avec la réponse Supabase (cookies mis à jour)
    // et laisser passer sans vérifier desktop/mobile
    return supabaseResponse;
  }

  // ============================================================
  // COUCHE 2 : Gestion desktop vs mobile/tablette
  // ============================================================
  if (!isApi && !isNextStatic) {
    // Si desktop et route autorisée -> laisser passer
    if (!isMobileOrTablet && isAllowedDesktopRoute) {
      return supabaseResponse;
    }

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

  // Sinon, retourner la réponse Supabase (avec cookies mis à jour)
  return supabaseResponse;
}

// Appliquer le middleware sur toutes les routes "app" par défaut
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};


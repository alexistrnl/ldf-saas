import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  const url = req.nextUrl.clone();

  // Détecter si l'utilisateur est sur mobile ou tablette
  const isMobileOrTablet = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  // Routes à exclure du middleware
  const isApi = url.pathname.startsWith("/api");
  const isStatic =
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/static") ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff2?|json)$/i);

  // Ne pas appliquer de redirection pour les routes API et les fichiers statiques
  if (isApi || isStatic) {
    return NextResponse.next();
  }

  // Si l'utilisateur est sur DESKTOP et qu'il n'est pas déjà sur /desktop-info
  // → redirection vers /desktop-info
  if (!isMobileOrTablet && url.pathname !== "/desktop-info") {
    url.pathname = "/desktop-info";
    return NextResponse.redirect(url);
  }

  // Si l'utilisateur est sur MOBILE/TABLETTE et qu'il est sur /desktop-info
  // → redirection vers la page d'accueil
  if (isMobileOrTablet && url.pathname === "/desktop-info") {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Optionnel : limiter le middleware à certaines routes
// Par défaut, Next.js applique le middleware à toutes les routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - fichiers statiques (images, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|static).*)",
  ],
};


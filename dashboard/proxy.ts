import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/privacy",
  "/install",
  "/downloads",
  "/methode",
  // La référence API et sa spec : un intégrateur tiers n'a pas de compte.
  "/docs",
  "/openapi.yaml",
  // Parcours d'entrée : l'élève arrive sur ces pages AVANT d'avoir un compte.
  // Elles montrent la classe qu'il rejoint puis l'envoient s'inscrire.
  "/join",
  "/invitation",
];

// Pages qui doivent renvoyer vers /login en conservant la destination. Sans
// ça, un utilisateur non connecté qui suit un lien profond est ramené à la
// racine après authentification et perd son contexte.
const KEEP_DESTINATION = ["/extension/pair"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // L'API v1 s'authentifie par clé d'organisation, pas par cookie : early
  // return explicite (l'exclusion par matcher n'est pas fiable une fois
  // compilée en path-to-regexp, vérifié en prod).
  //
  // Même traitement pour /embed/ : ces pages sont rendues dans l'iframe d'un
  // site tiers et s'authentifient par jeton signé. Les faire passer par
  // PUBLIC_PATHS ne suffirait pas — createServerClient + getUser tourneraient
  // quand même, pour poser des cookies inutiles en contexte tiers-partie et
  // un aller-retour Supabase à chaque rendu.
  if (path.startsWith("/api/") || path.startsWith("/embed/")) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Ne pas insérer de logique entre createServerClient et getUser :
  // ceci rafraîchit la session si nécessaire.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (KEEP_DESTINATION.some((p) => path.startsWith(p))) {
      url.searchParams.set("next", path + request.nextUrl.search);
    }
    return NextResponse.redirect(url);
  }

  if (user && path.startsWith("/login")) {
    const url = request.nextUrl.clone();
    // `next` n'est honoré que s'il est relatif : un chemin absolu ou
    // protocol-relative transformerait la page de login en redirecteur ouvert.
    const next = request.nextUrl.searchParams.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    url.search = "";
    if (safeNext) {
      const target = new URL(safeNext, request.nextUrl.origin);
      url.pathname = target.pathname;
      url.search = target.search;
    } else {
      url.pathname = "/";
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // /api/v1 est exclu : l'auth y est par clé API d'organisation, pas par cookie.
    "/((?!api/v1|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

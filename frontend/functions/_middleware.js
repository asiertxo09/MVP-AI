import { verifySessionToken } from "./lib/session";

export async function onRequest(context) {
    const { request, next, env } = context;
    const url = new URL(request.url);

    // Permitir acceso público a login, assets, etc.
    const publicPaths = [
        "/login", "/register", "/index.html", "/assets/", "/styles/", "/scripts/", "/api/login", "/api/register", "/api/parent-login", "/api/parent-setup", "/parent-login.html"
    ];

    if (publicPaths.some(p => url.pathname.startsWith(p)) || url.pathname === "/") {
        return next();
    }

    // Verificar cookie de sesión para rutas protegidas
    /*
    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader || !cookieHeader.includes("session=")) {
        // Redirigir a login si es una página HTML, o error 401 si es API
        if (url.pathname.startsWith("/api/")) {
             return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        return Response.redirect(new URL("/login.html", request.url), 302);
    }
    */

    // Dejar pasar y que cada endpoint maneje su seguridad específica o descomentar arriba para global
    return next();
}

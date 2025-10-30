import { readSessionSecret, verifySessionToken, SESSION_COOKIE_NAME } from "./lib/session";

const PUBLIC_PATHS = new Set(["/", "/login"]);

export const onRequest = async ({ request, next, env }) => {
    const url = new URL(request.url);

    if (PUBLIC_PATHS.has(url.pathname)) {
        return next();
    }

    if (url.pathname.startsWith("/app/")) {
        const cookieHeader = request.headers.get("Cookie") || "";
        const token = extractCookie(cookieHeader, SESSION_COOKIE_NAME);
        if (!token) {
            return redirectToLogin(url);
        }

        try {
            const secret = readSessionSecret(env);
            const payload = await verifySessionToken(token, secret);
            if (!payload) {
                return redirectToLogin(url);
            }
            request.session = payload;
        } catch (err) {
            console.error("middleware", err);
            return redirectToLogin(url);
        }
    }

    return next();
};

function extractCookie(cookieHeader, name) {
    const value = cookieHeader
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => c.split("="))
        .find(([key]) => key === name)?.[1];
    return value ? decodeURIComponent(value) : null;
}

function redirectToLogin(url) {
    return Response.redirect(new URL("/login", url), 302);
}

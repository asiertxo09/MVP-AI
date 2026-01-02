import { verifyPassword } from "../lib/auth";
import { ensureUsersTable, findUserByUsername } from "../lib/users";
import { createSessionToken, readSessionSecret, serializeSessionCookie } from "../lib/session";
import { requireDb, MissingDatabaseBindingError } from "../lib/d1";

export const onRequestPost = async ({ request, env }) => {
    try {
        if (request.headers.get("content-type")?.includes("application/json") === false) {
            return jsonResponse({ error: "Content-Type debe ser application/json" }, 415);
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ error: "JSON inválido" }, 400);
        }

        const username = typeof body.username === "string" ? body.username.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (!username || !password) {
            return jsonResponse({ error: "Faltan credenciales" }, 400);
        }

        const db = requireDb(env);
        await ensureUsersTable(db);
        const user = await findUserByUsername(db, username);
        if (!user) {
            return jsonResponse({ error: "Credenciales inválidas" }, 401);
        }

        const valid = await verifyPassword(password, user);
        if (!valid) {
            return jsonResponse({ error: "Credenciales inválidas" }, 401);
        }

        const secret = readSessionSecret(env);
        const { token } = await createSessionToken({ userId: user.id, username: user.username, role: user.role_name, secret });
        const headers = new Headers({
            "Set-Cookie": serializeSessionCookie(token),
            "Cache-Control": "no-store",
            "Content-Type": "application/json"
        });

        return new Response(JSON.stringify({ ok: true, role: user.role_name }), { status: 200, headers });
    } catch (err) {
        if (err instanceof MissingDatabaseBindingError) {
            console.error("login missing DB", err);
            return jsonResponse({ error: err.userMessage }, 500);
        }
        console.error("login", err);
        return jsonResponse({ error: "Error interno" }, 500);
    }
};

function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        }
    });
}

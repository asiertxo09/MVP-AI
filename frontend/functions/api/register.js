import { hashPassword } from "../lib/auth";
import { ensureUsersTable, findUserByUsername, createUser } from "../lib/users";

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

        if (username.length < 3 || username.length > 50) {
            return jsonResponse({ error: "El usuario debe tener entre 3 y 50 caracteres" }, 400);
        }
        if (password.length < 8) {
            return jsonResponse({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
        }

        await ensureUsersTable(env.DB);
        const existing = await findUserByUsername(env.DB, username);
        if (existing) {
            return jsonResponse({ error: "Usuario ya registrado" }, 409);
        }

        const hashed = await hashPassword(password);
        await createUser(env.DB, {
            username,
            passwordHash: hashed.hash,
            passwordSalt: hashed.salt,
            passwordIterations: hashed.iterations,
            passwordAlgo: hashed.algorithm,
        });

        return jsonResponse({ ok: true }, 201);
    } catch (err) {
        console.error("register", err);
        return jsonResponse({ error: "Error interno" }, 500);
    }
};

function jsonResponse(body, status) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        }
    });
}

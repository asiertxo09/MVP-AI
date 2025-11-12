// API endpoint para login de padres usando la contraseña parental
import { requireDb } from "../lib/d1";
import { verifyPassword } from "../lib/password";
import { createSessionToken, readSessionSecret, SESSION_COOKIE_NAME } from "../lib/session";

export const onRequestPost = async ({ request, env }) => {
    try {
        const { username, parentPassword } = await request.json();

        if (!username || !parentPassword) {
            return jsonResponse({ error: "Usuario y contraseña parental requeridos" }, 400);
        }

        const db = requireDb(env);

        // Buscar el usuario hijo
        const user = await db.prepare(
            `SELECT id, username FROM users WHERE username = ? AND role_id = 3`
        ).bind(username).first();

        if (!user) {
            return jsonResponse({ error: "Usuario no encontrado" }, 401);
        }

        // Verificar la contraseña parental
        const parentAccount = await db.prepare(
            `SELECT * FROM parent_accounts WHERE child_user_id = ?`
        ).bind(user.id).first();

        if (!parentAccount) {
            return jsonResponse({ error: "No hay cuenta de padres configurada" }, 401);
        }

        const isValid = await verifyPassword(
            parentPassword,
            parentAccount.parent_password_hash,
            parentAccount.parent_password_salt,
            parentAccount.parent_password_iterations,
            parentAccount.parent_password_algo
        );

        if (!isValid) {
            return jsonResponse({ error: "Contraseña parental incorrecta" }, 401);
        }

        // Actualizar último acceso
        await db.prepare(
            `UPDATE parent_accounts SET last_access = datetime('now') WHERE child_user_id = ?`
        ).bind(user.id).run();

        // Crear token de sesión parental (con un claim especial)
        const secret = readSessionSecret(env);
        const token = await createSessionToken(
            { sub: user.id, role: 'parent', childUsername: user.username },
            secret,
            86400 // 24 horas
        );

        return new Response(JSON.stringify({ ok: true, username: user.username }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
            }
        });
    } catch (err) {
        console.error("Error en parent login:", err);
        return jsonResponse({ error: "Error en el inicio de sesión" }, 500);
    }
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}


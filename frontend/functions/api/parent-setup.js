// API endpoint para configurar la contraseña parental
import { requireDb } from "../lib/d1";
import { hashPassword } from "../lib/password";
import { verifySessionToken, readSessionSecret, SESSION_COOKIE_NAME } from "../lib/session";

export const onRequestPost = async ({ request, env }) => {
    try {
        // Verificar que el usuario hijo está autenticado
        const secret = readSessionSecret(env);
        const cookieHeader = request.headers.get("Cookie") || "";
        const token = cookieHeader.split(';').find(c => c.trim().startsWith(SESSION_COOKIE_NAME + '='))?.split('=')[1];

        if (!token) {
            return jsonResponse({ error: "No autenticado" }, 401);
        }

        const session = await verifySessionToken(decodeURIComponent(token), secret);
        if (!session) {
            return jsonResponse({ error: "Sesión inválida" }, 401);
        }

        const { parentPassword } = await request.json();

        if (!parentPassword || parentPassword.length < 6) {
            return jsonResponse({ error: "La contraseña parental debe tener al menos 6 caracteres" }, 400);
        }

        const db = requireDb(env);

        // Verificar que el usuario es un niño
        const user = await db.prepare(
            `SELECT id, role_id FROM users WHERE id = ?`
        ).bind(session.sub).first();

        if (!user || user.role_id !== 3) {
            return jsonResponse({ error: "Solo usuarios tipo 'child' pueden configurar cuenta parental" }, 403);
        }

        // Hash de la contraseña parental
        const { hash, salt, iterations, algo } = await hashPassword(parentPassword);

        // Verificar si ya existe una cuenta parental
        const existing = await db.prepare(
            `SELECT id FROM parent_accounts WHERE child_user_id = ?`
        ).bind(session.sub).first();

        if (existing) {
            // Actualizar contraseña existente
            await db.prepare(
                `UPDATE parent_accounts 
                 SET parent_password_hash = ?, 
                     parent_password_salt = ?, 
                     parent_password_iterations = ?, 
                     parent_password_algo = ?
                 WHERE child_user_id = ?`
            ).bind(hash, salt, iterations, algo, session.sub).run();
        } else {
            // Crear nueva cuenta parental
            await db.prepare(
                `INSERT INTO parent_accounts 
                 (child_user_id, parent_password_hash, parent_password_salt, parent_password_iterations, parent_password_algo)
                 VALUES (?, ?, ?, ?, ?)`
            ).bind(session.sub, hash, salt, iterations, algo).run();
        }

        return jsonResponse({ ok: true, message: "Contraseña parental configurada" }, 200);
    } catch (err) {
        console.error("Error configurando cuenta parental:", err);
        return jsonResponse({ error: "Error al configurar cuenta parental" }, 500);
    }
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}


import { verifyPassword } from "../lib/auth";
import { findUserByUsername } from "../lib/users";
import { createSessionToken, readSessionSecret } from "../lib/session";
import { requireDb } from "../lib/d1";
import { getSession } from "../lib/session";

export const onRequestPost = async ({ request, env }) => {
    try {
        const session = await getSession(request, env);
        if (!session) {
            return jsonResponse({ error: "No autorizado" }, 401);
        }

        const db = requireDb(env);
        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ error: "JSON inválido" }, 400);
        }

        const { childId } = body;
        if (!childId) {
            return jsonResponse({ error: "childId requerido" }, 400);
        }

        // Verify the child belongs to this supervisor (re-using getLinkedChildren logic or a direct check)
        // For simplicity, we trust the ID but robustly we should check the link exists
        const linkCheck = await db.prepare("SELECT * FROM user_links WHERE supervisor_id = ? AND child_id = ?")
            .bind(session.sub, childId).first();

        if (!linkCheck) {
            return jsonResponse({ error: "Este niño no está vinculado a tu cuenta" }, 403);
        }

        const childUser = await db.prepare("SELECT * FROM users WHERE id = ?").bind(childId).first();
        if (!childUser) {
            return jsonResponse({ error: "Usuario hijo no encontrado" }, 404);
        }

        const secret = readSessionSecret(env);
        // Create a token for the child. 
        // IMPORTANT: We do NOT set a cookie here. We return the token in the body.
        const { token } = await createSessionToken({
            userId: childUser.id,
            username: childUser.username,
            role: 'child', // Force role
            secret
        });

        return jsonResponse({ ok: true, token, redirectUrl: `/app/index.html` }, 200);

    } catch (err) {
        console.error("play-as-child", err);
        return jsonResponse({ error: "Error al iniciar sesión como hijo: " + err.message }, 500);
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

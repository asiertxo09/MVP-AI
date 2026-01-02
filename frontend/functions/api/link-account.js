import { linkUser, findUserByUsername } from "../lib/users";
import { verifyPassword } from "../lib/auth";
import { requireDb, MissingDatabaseBindingError } from "../lib/d1";
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

        const { childUsername, childPassword } = body;

        // Current user (Parent or Specialist)
        const supervisorId = session.sub;
        const supervisorRole = session.role; // 'admin', 'parent', 'medical'

        // Determine link type from session role or request
        let linkType = 'parent';
        if (supervisorRole === 'medical' || supervisorRole === 4) { // Assuming 4 is medical based on previous exploration
            linkType = 'specialist';
        }

        // Validate child credentials (for security, to link you must know the child's login)
        const childUser = await findUserByUsername(db, childUsername);

        if (!childUser) {
            return jsonResponse({ error: "Usuario hijo no encontrado" }, 404);
        }

        // Verify password
        const isValid = await verifyPassword(
            childPassword,
            childUser
        );

        if (!isValid) {
            return jsonResponse({ error: "Credenciales del hijo incorrectas" }, 401);
        }

        // Perform Link
        await linkUser(db, {
            supervisorId: supervisorId,
            childId: childUser.id,
            type: linkType
        });

        return jsonResponse({ ok: true, message: "Cuenta vinculada exitosamente" }, 200);

    } catch (err) {
        if (err instanceof MissingDatabaseBindingError) {
            console.error("link-account missing DB", err);
            return jsonResponse({ error: err.userMessage }, 500);
        }
        console.error("link-account", err);
        return jsonResponse({ error: "Error al vincular cuenta: " + err.message }, 500);
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

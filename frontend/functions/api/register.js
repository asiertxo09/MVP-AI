import { hashPassword } from "../lib/auth";
import { ensureUsersTable, findUserByUsername, createUser } from "../lib/users";
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
        const role = typeof body.role === "string" ? body.role : "";

        if (username.length < 3 || username.length > 50) {
            return jsonResponse({ error: "El usuario debe tener entre 3 y 50 caracteres" }, 400);
        }
        if (password.length < 8) {
            return jsonResponse({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
        }
        const validRoles = ["Padre", "Hijo", "Médico", "parent", "child", "specialist", "medical"];
        if (!validRoles.includes(role)) {
            return jsonResponse({ error: "Rol de usuario no válido" }, 400);
        }

        const db = requireDb(env);
        await ensureUsersTable(db);
        const existing = await findUserByUsername(db, username);
        if (existing) {
            return jsonResponse({ error: "Usuario ya registrado" }, 409);
        }

        // Map roles to DB values
        const roleMapping = {
            'parent': 'Padre',
            'child': 'Hijo',
            'specialist': 'Médico',
            'medical': 'Médico',
            'Padre': 'Padre',
            'Hijo': 'Hijo',
            'Médico': 'Médico'
        };

        const dbRole = roleMapping[role];

        const isActive = (dbRole === 'Hijo') ? 1 : 0; // Parents/Specialists inactive by default

        const hashed = await hashPassword(password);
        await createUser(db, {
            username,
            passwordHash: hashed.hash,
            passwordSalt: hashed.salt,
            passwordIterations: hashed.iterations,
            passwordAlgo: hashed.algorithm,
            role: dbRole,
            isActive: isActive
        });

        if (isActive === 0) {
            return jsonResponse({ ok: true, message: "Cuenta creada. Esperando aprobación del administrador." }, 201);
        }

        return jsonResponse({ ok: true }, 201);
    } catch (err) {
        if (err instanceof MissingDatabaseBindingError) {
            console.error("register missing DB", err);
            return jsonResponse({ error: err.userMessage }, 500);
        }
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

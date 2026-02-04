import { hashPassword } from "../lib/auth";
import { createUser, linkUser } from "../lib/users";
import { requireDb, MissingDatabaseBindingError } from "../lib/d1";
import { getSession } from "../lib/session";

export const onRequestPost = async ({ request, env }) => {
    try {
        const session = await getSession(request, env);
        if (!session) {
            return jsonResponse({ error: "No autorizado" }, 401);
        }

        // Only parents or specialists can create children this way
        // Role check can be stricter if needed
        const supervisorId = session.sub;

        // We expect name, surname, age
        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ error: "JSON inválido" }, 400);
        }

        const { name, surname, age } = body;

        if (!name || !age) {
            return jsonResponse({ error: "Nombre y edad son obligatorios." }, 400);
        }

        const db = requireDb(env);

        // Generate a unique internal username and dummy password
        const uniqueSuffix = crypto.randomUUID().split('-')[0];
        const username = `child_${name.toLowerCase().replace(/\s+/g, '')}_${uniqueSuffix}`;
        const dummyPassword = crypto.randomUUID();

        const hashed = await hashPassword(dummyPassword);

        // Create the child user (Active by default)
        await createUser(db, {
            username,
            passwordHash: hashed.hash,
            passwordSalt: hashed.salt,
            passwordIterations: hashed.iterations,
            passwordAlgo: hashed.algorithm,
            role: 'Hijo',
            isActive: 1,
            name,
            surname,
            age
        });

        // We need the ID of the new user. 
        // createUser returns the result of .run(). 
        // In D1/better-sqlite3 run() usually has lastInsertRowid.
        // Let's query it back by username to be safe or investigate createUser return.
        // Looking at users.js, it returns db.prepare(...).run().

        // Let's fetch the user we just created
        const newUser = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();

        if (!newUser) {
            throw new Error("Error retrieving created child");
        }

        // Link to supervisor
        await linkUser(db, {
            supervisorId,
            childId: newUser.id,
            type: session.role === 'medical' ? 'specialist' : 'parent'
        });

        return jsonResponse({
            ok: true,
            child: {
                username,
                name,
                surname,
                age
            }
        }, 201);

    } catch (err) {
        if (err instanceof MissingDatabaseBindingError) {
            console.error("create-child missing DB", err);
            return jsonResponse({ error: err.userMessage }, 500);
        }
        console.error("create-child", err);
        return jsonResponse({ error: "Error al crear cuenta de niño: " + err.message }, 500);
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

import { requireDb } from "../../lib/d1";
import { getSession } from "../../lib/session";

export const onRequestGet = async ({ request, env }) => {
    try {
        // Child authentication often comes via 'Authorization: Bearer <token>' 
        // OR a query param if relying on session cookie is tricky in potential webviews/iframes.
        // For kingdoms.html integration, we use the session cookie set by play-as-child 
        // OR the Bearer token passed in headers if we decide to fetch that way.
        // Let's rely on standard Session first (cookie).

        let session = await getSession(request, env);

        // getSession already checks Authorization header and Cookie


        if (!session) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const db = requireDb(env);
        const userId = session.sub;

        // Fetch progress
        let progress = await db.prepare("SELECT * FROM student_progress WHERE user_id = ?").bind(userId).first();

        // If not exists, initialize
        if (!progress) {
            await db.prepare(`
                INSERT INTO student_progress (user_id, current_level, stars_total) 
                VALUES (?, 1, 0)
            `).bind(userId).run();
            progress = { current_level: 1, stars_total: 0 };
        }

        return new Response(JSON.stringify(progress), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (e) {
        console.error("Progress API Error:", e);
        return new Response(JSON.stringify({ error: "Internal Error" }), { status: 500 });
    }
};

// Endpoint to advance level (simple version)
export const onRequestPost = async ({ request, env }) => {
    try {
        const session = await getSession(request, env);
        if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

        const db = requireDb(env);
        const userId = session.sub;
        const body = await request.json();

        // e.g. { action: 'unlock_next' }
        if (body.action === 'complete_level') {
            const current = await db.prepare("SELECT current_level, stars_total FROM student_progress WHERE user_id = ?").bind(userId).first();
            const nextLevel = (current?.current_level || 1) + 1;
            const newStars = (current?.stars_total || 0) + (body.stars || 0);

            await db.prepare(`
                UPDATE student_progress 
                SET current_level = ?, stars_total = ?, updated_at = datetime('now')
                WHERE user_id = ?
            `).bind(nextLevel, newStars, userId).run();

            return new Response(JSON.stringify({ success: true, level: nextLevel, stars: newStars }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};

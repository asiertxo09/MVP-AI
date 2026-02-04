import { requireDb } from "../../lib/d1";
import { getSession } from "../../lib/session";

export const onRequestPost = async ({ request, env }) => {
    try {
        const session = await getSession(request, env);
        if (!session || session.role !== 'parent') {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const db = requireDb(env);
        const { childId, dailyTimeLimitSeconds } = await request.json();

        if (!childId || dailyTimeLimitSeconds === undefined) {
            return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400 });
        }

        // Verify parent has access to child
        const linkCheck = await db.prepare("SELECT * FROM user_links WHERE supervisor_id = ? AND child_id = ?")
            .bind(session.sub, childId).first();

        if (!linkCheck) {
            return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        }

        // Use INSERT OR IGNORE / UPDATE or atomic UPSERT
        // Since we want to preserve other profile fields if they exist, let's check existence
        const existing = await db.prepare("SELECT user_id FROM student_profiles WHERE user_id = ?").bind(childId).first();

        if (existing) {
            await db.prepare(`
                UPDATE student_profiles 
                SET daily_time_limit_seconds = ?, last_updated = datetime('now')
                WHERE user_id = ?
            `).bind(dailyTimeLimitSeconds, childId).run();
        } else {
            await db.prepare(`
                INSERT INTO student_profiles (user_id, daily_time_limit_seconds, last_updated)
                VALUES (?, ?, datetime('now'))
            `).bind(childId, dailyTimeLimitSeconds).run();
        }

        return new Response(JSON.stringify({ ok: true, dailyTimeLimitSeconds }), { status: 200 });

    } catch (err) {
        console.error("child-settings error:", err);
        return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
    }
};

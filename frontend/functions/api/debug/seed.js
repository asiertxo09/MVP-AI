export const onRequestGet = async ({ request, env }) => {
    const url = new URL(request.url);
    const username = url.searchParams.get('username') || 'hijo3@mail.com';

    try {
        const db = env.DB;

        // 1. Find User
        const user = await db.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
        if (!user) {
            return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
        }
        const userId = user.id;

        // 2. Clear Existing Data
        await db.prepare("DELETE FROM activity_metrics WHERE user_id = ?").bind(userId).run();
        await db.prepare("DELETE FROM daily_metrics WHERE user_id = ?").bind(userId).run();
        await db.prepare("DELETE FROM user_current_state WHERE user_id = ?").bind(userId).run();

        // 3. Generate History (60 days)
        const activityTypes = ['math', 'speed_math', 'reading', 'speed_reading', 'writing'];
        let totalStars = 0;
        let totalActivities = 0;
        let totalTime = 0;
        let currentStreak = 0;
        let lastActivityDate = null;

        const queries = [];

        for (let i = 59; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            // 30% chance to skip a day
            if (Math.random() < 0.3) {
                currentStreak = 0;
                continue;
            }
            currentStreak++;

            const numSessions = Math.floor(Math.random() * 5) + 1;
            let dailyStars = 0;
            let dailyTime = 0;
            let dailyActivitiesByType = {};

            for (let j = 0; j < numSessions; j++) {
                const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
                const activityName = "Ejercicio " + type;
                const duration = Math.floor(Math.random() * 540) + 60; // 60s - 600s
                const isCorrect = Math.random() > 0.2;
                const stars = isCorrect ? Math.floor(Math.random() * 10) + 1 : 0;
                const metadata = type.includes('reading') ? JSON.stringify({ wpm: Math.floor(Math.random() * 50) + 30 }) : null;

                totalStars += stars;
                dailyStars += stars;
                totalTime += duration;
                dailyTime += duration;
                totalActivities++;

                dailyActivitiesByType[type] = (dailyActivitiesByType[type] || 0) + 1;
                lastActivityDate = date.toISOString();

                queries.push(db.prepare(`
                    INSERT INTO activity_metrics (user_id, activity_type, activity_name, completed_at, duration_seconds, stars_earned, is_correct, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(userId, type, activityName, date.toISOString(), duration, stars, isCorrect ? 1 : 0, metadata));
            }

            queries.push(db.prepare(`
                INSERT INTO daily_metrics (user_id, metric_date, total_activities, total_stars, total_time_seconds, activities_by_type)
                VALUES (?, ?, ?, ?, ?, ?)
            `).bind(userId, dateStr, numSessions, dailyStars, dailyTime, JSON.stringify(dailyActivitiesByType)));
        }

        // 4. Update Current State
        queries.push(db.prepare(`
            INSERT INTO user_current_state (user_id, total_stars, current_streak, last_activity_date, total_activities_completed, total_time_played_seconds)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(userId, totalStars, currentStreak, lastActivityDate, totalActivities, totalTime));

        // Batch execute (chunks of 100 to avoid limits)
        for (let i = 0; i < queries.length; i += 50) {
            const chunk = queries.slice(i, i + 50);
            await db.batch(chunk);
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Seeded ${totalActivities} activities for ${username}`,
            stats: { totalStars, currentStreak, totalTime }
        }), { headers: { 'Content-Type': 'application/json' } });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500 });
    }
};

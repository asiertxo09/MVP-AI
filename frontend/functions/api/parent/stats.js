import { getSession } from "../../lib/session";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const childIdParam = url.searchParams.get("childId");

  // 1. Security Check: Validate Session using shared getSession
  const session = await getSession(request, env);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // 2. Authorization Check: Parent must provide childId and have a valid link
  const db = env.DB;
  let targetChildId = childIdParam;

  // Check if the logged-in user is a parent/supervisor
  const userRole = await db.prepare(
    "SELECT r.role_name FROM users u JOIN user_roles r ON u.role_id = r.id WHERE u.id = ?"
  ).bind(session.sub).first();

  if (!userRole) {
    return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
  }

  const roleName = userRole.role_name.toLowerCase();

  if (roleName === 'padre' || roleName === 'parent' || roleName === 'médico' || roleName === 'medical') {
    // Parent/Specialist: must specify childId and have a link
    if (!childIdParam) {
      return new Response(JSON.stringify({ error: "childId parameter required" }), { status: 400 });
    }

    // Verify the link exists
    const link = await db.prepare(
      "SELECT * FROM user_links WHERE supervisor_id = ? AND child_id = ?"
    ).bind(session.sub, childIdParam).first();

    if (!link) {
      return new Response(JSON.stringify({ error: "Forbidden: No access to this child" }), { status: 403 });
    }

    targetChildId = parseInt(childIdParam, 10);
  } else if (roleName === 'hijo' || roleName === 'child') {
    // Child viewing their own stats
    targetChildId = session.sub;
  } else {
    return new Response(JSON.stringify({ error: "Forbidden: Invalid role" }), { status: 403 });
  }

  try {
    // 1. Fetch Streak & Profile
    const profileQuery = await db.prepare(`
      SELECT
        u.username,
        ucs.current_streak,
        ucs.total_stars,
        sp.overall_pcpm,
        sp.math_level,
        sp.reading_level,
        sp.writing_level,
        sp.daily_time_limit_seconds
      FROM users u
      LEFT JOIN user_current_state ucs ON u.id = ucs.user_id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      WHERE u.id = ?
    `).bind(targetChildId).first();

    // 2. Weekly Activity (Last 7 days)
    // Detailed for Chart: Return array of all days in range with 0s filled
    const rawWeeklyActivity = await db.prepare(`
      SELECT
        date(completed_at) as day,
        COUNT(*) as activities,
        SUM(duration_seconds) as duration
      FROM activity_metrics
      WHERE user_id = ? AND completed_at >= datetime('now', '-7 days')
      GROUP BY day
      ORDER BY day ASC
    `).bind(targetChildId).all();

    // Fill in missing days
    const weeklyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      const found = rawWeeklyActivity.results.find(r => r.day === dayStr);
      weeklyActivity.push({
        day: dayStr,
        duration: found ? found.duration : 0,
        activities: found ? found.activities : 0
      });
    }

    // 3. Skills Radar (Aggregation)
    const skillsData = await db.prepare(`
      SELECT
        activity_type,
        AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) as accuracy,
        COUNT(*) as count
      FROM activity_metrics
      WHERE user_id = ?
      GROUP BY activity_type
    `).bind(targetChildId).all();

    // 4. Recent Session
    const recentSession = await db.prepare(`
      SELECT
        activity_name,
        activity_type,
        stars_earned,
        duration_seconds,
        completed_at,
        is_correct,
        metadata
      FROM activity_metrics
      WHERE user_id = ?
      ORDER BY completed_at DESC
      LIMIT 1
    `).bind(targetChildId).first();

    // 5. Total Time 24h & Accuracy
    const stats24h = await db.prepare(`
      SELECT
        SUM(duration_seconds) as total_time,
        AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) as accuracy
      FROM activity_metrics
      WHERE user_id = ? AND completed_at >= datetime('now', '-24 hours')
    `).bind(targetChildId).first();

    // Math Speed (Average time per activity for math)
    const mathStats = await db.prepare(`
        SELECT AVG(duration_seconds) as avg_duration
        FROM activity_metrics
        WHERE user_id = ? AND activity_type IN ('math', 'matematicas')
    `).bind(targetChildId).first();

    // Detailed History for Zoom (Last 30 days of activity duration)
    const historyData = await db.prepare(`
      SELECT
        date(completed_at) as day,
        SUM(duration_seconds) as duration
      FROM activity_metrics
      WHERE user_id = ? AND completed_at >= datetime('now', '-30 days')
      GROUP BY day
      ORDER BY day ASC
    `).bind(targetChildId).all();

    // Process Skills for Radar
    const skillsMap = { math: 0, reading: 0, writing: 0 };
    if (skillsData.results) {
      skillsData.results.forEach(s => {
        const type = s.activity_type.toLowerCase();
        const score = Math.round(s.accuracy * 100);
        if (type.includes('math') || type.includes('mate') || type.includes('cálculo')) skillsMap.math = score;
        else if (type.includes('read') || type.includes('speak') || type.includes('lengu') || type.includes('lectura')) skillsMap.reading = score;
        else if (type.includes('write') || type.includes('escri') || type.includes('dictado')) skillsMap.writing = score;
      });
    }

    return new Response(JSON.stringify({
      profile: {
        username: profileQuery?.username || "Child",
        streak: profileQuery?.current_streak || 0,
        stars: profileQuery?.total_stars || 0,
        pcpm: profileQuery?.overall_pcpm || 0,
        daily_time_limit: profileQuery?.daily_time_limit_seconds || 900
      },
      weekly_activity: weeklyActivity,
      history_30d: historyData.results || [],
      skills: skillsMap,
      recent_session: recentSession || null,
      stats_24h: {
        total_time: stats24h?.total_time || 0,
        accuracy: Math.round((stats24h?.accuracy || 0) * 100)
      },
      math_speed: mathStats?.avg_duration || 0
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// API endpoint para gestionar métricas de actividades
import { requireDb } from "../lib/d1";
import { getSession } from "../lib/session";

// POST: Guardar nueva métrica de actividad
export const onRequestPost = async ({ request, env }) => {
    try {
        const session = await getSession(request, env);
        if (!session) {
            return jsonResponse({ error: "No autenticado" }, 401);
        }

        const {
            activityType,
            activityName,
            durationSeconds,
            starsEarned,
            energyChange,
            isCorrect,
            difficultyLevel,
            challengeData,
            userResponse,
            metadata
        } = await request.json();

        if (!activityType || !activityName) {
            return jsonResponse({ error: "Tipo y nombre de actividad requeridos" }, 400);
        }

        const db = requireDb(env);

        // Insertar métrica de actividad
        const result = await db.prepare(
            `INSERT INTO activity_metrics 
            (user_id, activity_type, activity_name, duration_seconds, stars_earned, energy_change, 
             is_correct, difficulty_level, challenge_data, user_response, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            session.sub,
            activityType,
            activityName,
            durationSeconds || null,
            starsEarned || 0,
            energyChange || 0,
            isCorrect !== undefined ? (isCorrect ? 1 : 0) : null,
            difficultyLevel || null,
            challengeData ? JSON.stringify(challengeData) : null,
            userResponse ? JSON.stringify(userResponse) : null,
            metadata ? JSON.stringify(metadata) : null
        ).run();

        // Actualizar estado actual del usuario
        await updateUserCurrentState(db, session.sub, starsEarned || 0, energyChange || 0, activityType);

        // Actualizar métricas diarias
        await updateDailyMetrics(db, session.sub, activityType, durationSeconds || 0, isCorrect);

        return jsonResponse({ ok: true, metricId: result.meta.last_row_id }, 201);
    } catch (err) {
        console.error("Error guardando métrica:", err);
        return jsonResponse({ error: "Error al guardar métrica" }, 500);
    }
};

// GET: Obtener métricas del usuario (o hijo vinculado)
export const onRequestGet = async ({ request, env }) => {
    try {
        const session = await getSession(request, env);
        if (!session) {
            return jsonResponse({ error: "No autenticado" }, 401);
        }

        const db = requireDb(env);
        const url = new URL(request.url);
        const type = url.searchParams.get('type'); // 'current', 'daily', 'activities', 'complete'
        const days = parseInt(url.searchParams.get('days') || '30');
        const childId = url.searchParams.get('childId');

        let targetUserId = session.sub;

        // Si se solicita información de un hijo, verificar la vinculación
        if (childId) {
            const link = await db.prepare(
                `SELECT * FROM user_links WHERE supervisor_id = ? AND child_id = ?`
            ).bind(session.sub, childId).first();

            if (!link) {
                return jsonResponse({ error: "No tienes permiso para ver este usuario" }, 403);
            }
            targetUserId = childId;
        }

        let data = {};

        if (!type || type === 'current') {
            // Estado actual
            const current = await db.prepare(
                `SELECT * FROM user_current_state WHERE user_id = ?`
            ).bind(targetUserId).first();

            if (!current) {
                // Si es el propio usuario, inicializamos. Si es hijo, solo devolvemos estructura vacía si no existe.
                if (targetUserId === session.sub) {
                    await db.prepare(
                        `INSERT INTO user_current_state (user_id) VALUES (?)`
                    ).bind(targetUserId).run();
                }

                data.current = {
                    user_id: targetUserId,
                    total_stars: 0,
                    energy_level: 5.0,
                    current_streak: 0,
                    total_activities_completed: 0,
                    total_time_played_seconds: 0
                };
            } else {
                data.current = current;
            }
        }

        if (!type || type === 'daily') {
            // Métricas diarias (últimos N días)
            const dailyMetrics = await db.prepare(
                `SELECT * FROM daily_metrics 
                 WHERE user_id = ? 
                 AND date(metric_date) >= date('now', '-' || ? || ' days')
                 ORDER BY metric_date DESC`
            ).bind(targetUserId, days).all();
            data.daily = dailyMetrics.results;
        }

        if (!type || type === 'activities') {
            // Actividades recientes (últimas 50)
            const activities = await db.prepare(
                `SELECT * FROM activity_metrics 
                 WHERE user_id = ? 
                 ORDER BY completed_at DESC 
                 LIMIT 50`
            ).bind(targetUserId).all();
            data.activities = activities.results;
        }

        if (type === 'complete') {
            // Vista completa consolidada
            const complete = await db.prepare(
                `SELECT * FROM student_complete_metrics WHERE user_id = ?`
            ).bind(targetUserId).first();
            data.complete = complete;
        }

        return jsonResponse(data);
    } catch (err) {
        console.error("Error obteniendo métricas:", err);
        return jsonResponse({ error: "Error al obtener métricas" }, 500);
    }
};

// Funciones auxiliares
async function updateUserCurrentState(db, userId, starsEarned, energyChange, activityType) {
    const current = await db.prepare(
        `SELECT * FROM user_current_state WHERE user_id = ?`
    ).bind(userId).first();

    if (!current) {
        await db.prepare(
            `INSERT INTO user_current_state 
            (user_id, total_stars, energy_level, last_activity_date, last_activity_type, total_activities_completed)
            VALUES (?, ?, ?, datetime('now'), ?, 1)`
        ).bind(userId, starsEarned, 5.0 + energyChange, activityType).run();
    } else {
        const newEnergy = Math.max(0, Math.min(10, current.energy_level + energyChange));
        await db.prepare(
            `UPDATE user_current_state 
            SET total_stars = total_stars + ?,
                energy_level = ?,
                last_activity_date = datetime('now'),
                last_activity_type = ?,
                total_activities_completed = total_activities_completed + 1,
                updated_at = datetime('now')
            WHERE user_id = ?`
        ).bind(starsEarned, newEnergy, activityType, userId).run();
    }
}

async function updateDailyMetrics(db, userId, activityType, durationSeconds, isCorrect) {
    const today = new Date().toISOString().split('T')[0];

    const existing = await db.prepare(
        `SELECT * FROM daily_metrics WHERE user_id = ? AND metric_date = ?`
    ).bind(userId, today).first();

    if (!existing) {
        const activitiesByType = JSON.stringify({ [activityType]: 1 });
        await db.prepare(
            `INSERT INTO daily_metrics 
            (user_id, metric_date, total_activities, total_time_seconds, activities_by_type)
            VALUES (?, ?, 1, ?, ?)`
        ).bind(userId, today, durationSeconds, activitiesByType).run();
    } else {
        const activitiesByType = JSON.parse(existing.activities_by_type || '{}');
        activitiesByType[activityType] = (activitiesByType[activityType] || 0) + 1;

        await db.prepare(
            `UPDATE daily_metrics 
            SET total_activities = total_activities + 1,
                total_time_seconds = total_time_seconds + ?,
                activities_by_type = ?,
                updated_at = datetime('now')
            WHERE user_id = ? AND metric_date = ?`
        ).bind(durationSeconds, JSON.stringify(activitiesByType), userId, today).run();
    }
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}


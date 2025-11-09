import { requireDb } from "../lib/d1";
import { verifySessionToken, readSessionSecret, SESSION_COOKIE_NAME } from "../lib/session";

// Iniciar una nueva evaluación
export const onRequestPost = async ({ request, env }) => {
    try {
        const secret = readSessionSecret(env);
        const cookieHeader = request.headers.get("Cookie") || "";
        const token = cookieHeader.split(';').find(c => c.trim().startsWith(SESSION_COOKIE_NAME + '='))?.split('=')[1];

        if (!token) {
            return jsonResponse({ error: "No autenticado" }, 401);
        }

        const session = await verifySessionToken(decodeURIComponent(token), secret);
        if (!session) {
            return jsonResponse({ error: "Sesión inválida o expirada" }, 401);
        }

        const db = requireDb(env);

        // Crear nueva evaluación
        const result = await db.prepare(
            `INSERT INTO initial_assessments (user_id, completed) VALUES (?, 0)`
        ).bind(session.sub).run();

        return jsonResponse({
            ok: true,
            assessmentId: result.meta.last_row_id
        }, 201);
    } catch (err) {
        console.error("Error creating assessment:", err);
        return jsonResponse({ error: "Error al crear evaluación" }, 500);
    }
};

// Obtener evaluación del usuario
export const onRequestGet = async ({ request, env }) => {
    try {
        const secret = readSessionSecret(env);
        const cookieHeader = request.headers.get("Cookie") || "";
        const token = cookieHeader.split(';').find(c => c.trim().startsWith(SESSION_COOKIE_NAME + '='))?.split('=')[1];

        if (!token) {
            return jsonResponse({ error: "No autenticado" }, 401);
        }

        const session = await verifySessionToken(decodeURIComponent(token), secret);
        if (!session) {
            return jsonResponse({ error: "Sesión inválida o expirada" }, 401);
        }

        const db = requireDb(env);
        const url = new URL(request.url);
        const assessmentId = url.searchParams.get('id');

        if (assessmentId) {
            // Obtener evaluación específica con todos los detalles
            const assessment = await db.prepare(
                `SELECT * FROM initial_assessments WHERE id = ? AND user_id = ?`
            ).bind(assessmentId, session.sub).first();

            if (!assessment) {
                return jsonResponse({ error: "Evaluación no encontrada" }, 404);
            }

            // Obtener resultados de cada prueba
            const reading = await db.prepare(
                `SELECT * FROM assessment_reading WHERE assessment_id = ?`
            ).bind(assessmentId).first();

            const phonological = await db.prepare(
                `SELECT * FROM assessment_phonological WHERE assessment_id = ?`
            ).bind(assessmentId).first();

            const math = await db.prepare(
                `SELECT * FROM assessment_math WHERE assessment_id = ?`
            ).bind(assessmentId).first();

            const dictation = await db.prepare(
                `SELECT * FROM assessment_dictation WHERE assessment_id = ?`
            ).bind(assessmentId).first();

            return jsonResponse({
                assessment,
                tests: { reading, phonological, math, dictation }
            });
        } else {
            // Obtener todas las evaluaciones del usuario
            const assessments = await db.prepare(
                `SELECT * FROM initial_assessments WHERE user_id = ? ORDER BY assessment_date DESC`
            ).bind(session.sub).all();

            return jsonResponse({ assessments: assessments.results });
        }
    } catch (err) {
        console.error("Error fetching assessment:", err);
        return jsonResponse({ error: "Error al obtener evaluación" }, 500);
    }
};

// Actualizar evaluación (marcar como completada)
export const onRequestPut = async ({ request, env }) => {
    try {
        const secret = readSessionSecret(env);
        const cookieHeader = request.headers.get("Cookie") || "";
        const token = cookieHeader.split(';').find(c => c.trim().startsWith(SESSION_COOKIE_NAME + '='))?.split('=')[1];

        if (!token) {
            return jsonResponse({ error: "No autenticado" }, 401);
        }

        const session = await verifySessionToken(decodeURIComponent(token), secret);
        if (!session) {
            return jsonResponse({ error: "Sesión inválida o expirada" }, 401);
        }

        const db = requireDb(env);
        const body = await request.json();
        const { assessmentId, completed, overallScore } = body;

        await db.prepare(
            `UPDATE initial_assessments SET completed = ?, overall_score = ? WHERE id = ? AND user_id = ?`
        ).bind(completed ? 1 : 0, overallScore, assessmentId, session.sub).run();

        return jsonResponse({ ok: true });
    } catch (err) {
        console.error("Error updating assessment:", err);
        return jsonResponse({ error: "Error al actualizar evaluación" }, 500);
    }
};

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        }
    });
}

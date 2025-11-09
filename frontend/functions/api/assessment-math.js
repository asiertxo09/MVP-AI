import { requireDb } from "../lib/d1";
import { verifySessionToken, readSessionSecret, SESSION_COOKIE_NAME } from "../lib/session";

// Guardar resultado de prueba de cálculo básico
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
        const body = await request.json();

        const {
            assessmentId,
            difficultyLevel,
            questionsData,
            correctAnswers,
            totalQuestions,
            timeSeconds
        } = body;

        // Calcular métricas
        const accuracyPercentage = (correctAnswers / totalQuestions) * 100;
        const epm = (correctAnswers / timeSeconds) * 60; // Ejercicios Por Minuto

        const result = await db.prepare(`
            INSERT INTO assessment_math 
            (assessment_id, difficulty_level, questions_data, correct_answers, 
             total_questions, accuracy_percentage, epm, time_seconds)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            assessmentId,
            difficultyLevel,
            JSON.stringify(questionsData),
            correctAnswers,
            totalQuestions,
            accuracyPercentage,
            epm,
            timeSeconds
        ).run();

        return jsonResponse({
            ok: true,
            id: result.meta.last_row_id,
            metrics: {
                accuracy: Math.round(accuracyPercentage * 100) / 100,
                epm: Math.round(epm * 100) / 100,
                correctAnswers,
                totalQuestions
            }
        }, 201);
    } catch (err) {
        console.error("Error saving math assessment:", err);
        return jsonResponse({ error: "Error al guardar cálculo" }, 500);
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

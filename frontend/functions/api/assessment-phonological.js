import { requireDb } from "../lib/d1";
import { verifySessionToken, readSessionSecret, SESSION_COOKIE_NAME } from "../lib/session";

// Guardar resultado de prueba de conciencia fonológica
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
            testType,
            questionsData,
            correctAnswers,
            totalQuestions,
            timeSeconds
        } = body;

        // Calcular porcentaje de aciertos
        const accuracyPercentage = (correctAnswers / totalQuestions) * 100;

        const result = await db.prepare(`
            INSERT INTO assessment_phonological 
            (assessment_id, test_type, questions_data, correct_answers, 
             total_questions, accuracy_percentage, time_seconds)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
            assessmentId,
            testType,
            JSON.stringify(questionsData),
            correctAnswers,
            totalQuestions,
            accuracyPercentage,
            timeSeconds
        ).run();

        return jsonResponse({
            ok: true,
            id: result.meta.last_row_id,
            metrics: {
                accuracy: Math.round(accuracyPercentage * 100) / 100,
                correctAnswers,
                totalQuestions
            }
        }, 201);
    } catch (err) {
        console.error("Error saving phonological assessment:", err);
        return jsonResponse({ error: "Error al guardar conciencia fonológica" }, 500);
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

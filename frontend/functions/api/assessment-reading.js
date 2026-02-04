import { requireDb } from "../lib/d1";
import { verifySessionToken, readSessionSecret, SESSION_COOKIE_NAME } from "../lib/session";

// Guardar resultado de prueba de lectura
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
            readingText,
            audioRecording,
            transcription,
            durationSeconds,
            wordsRead,
            wordsExpected
        } = body;

        // Calcular métricas
        const errorsCount = wordsExpected - wordsRead;
        const accuracyPercentage = (wordsRead / wordsExpected) * 100;
        const pcpm = (wordsRead / durationSeconds) * 60; // Palabras Correctas Por Minuto

        const result = await db.prepare(`
            INSERT INTO assessment_reading 
            (assessment_id, reading_text, audio_recording, transcription, 
             duration_seconds, words_read, words_expected, pcpm, 
             accuracy_percentage, errors_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            assessmentId,
            readingText,
            audioRecording,
            transcription,
            durationSeconds,
            wordsRead,
            wordsExpected,
            pcpm,
            accuracyPercentage,
            errorsCount
        ).run();

        return jsonResponse({
            ok: true,
            id: result.meta.last_row_id,
            metrics: {
                pcpm: Math.round(pcpm * 100) / 100,
                accuracy: Math.round(accuracyPercentage * 100) / 100,
                errors: errorsCount
            }
        }, 201);
    } catch (err) {
        console.error("Error saving reading assessment:", err);
        return jsonResponse({ error: "Error al guardar lectura" }, 500);
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


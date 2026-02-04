import { requireDb } from "../lib/d1";
import { verifySessionToken, readSessionSecret, SESSION_COOKIE_NAME } from "../lib/session";

// Guardar resultado de prueba de dictado
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
            dictationText,
            audioDictation,
            studentResponse
        } = body;

        // Calcular métricas de escritura
        const metrics = calculateDictationMetrics(dictationText, studentResponse);

        const result = await db.prepare(`
            INSERT INTO assessment_dictation 
            (assessment_id, dictation_text, audio_dictation, student_response,
             words_total, words_correct, accuracy_percentage, 
             spelling_errors, grammar_errors)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            assessmentId,
            dictationText,
            audioDictation,
            studentResponse,
            metrics.wordsTotal,
            metrics.wordsCorrect,
            metrics.accuracyPercentage,
            metrics.spellingErrors,
            metrics.grammarErrors
        ).run();

        return jsonResponse({
            ok: true,
            id: result.meta.last_row_id,
            metrics: {
                accuracy: Math.round(metrics.accuracyPercentage * 100) / 100,
                wordsCorrect: metrics.wordsCorrect,
                wordsTotal: metrics.wordsTotal,
                spellingErrors: metrics.spellingErrors,
                grammarErrors: metrics.grammarErrors
            }
        }, 201);
    } catch (err) {
        console.error("Error saving dictation assessment:", err);
        return jsonResponse({ error: "Error al guardar dictado" }, 500);
    }
};

// Función para calcular métricas del dictado
function calculateDictationMetrics(expected, actual) {
    const expectedWords = expected.toLowerCase().trim().split(/\s+/);
    const actualWords = actual.toLowerCase().trim().split(/\s+/);

    const wordsTotal = expectedWords.length;
    let wordsCorrect = 0;
    let spellingErrors = 0;
    let grammarErrors = 0;

    // Comparación simple palabra por palabra
    for (let i = 0; i < Math.min(expectedWords.length, actualWords.length); i++) {
        if (expectedWords[i] === actualWords[i]) {
            wordsCorrect++;
        } else {
            // Calcular distancia de Levenshtein simplificada
            const distance = levenshteinDistance(expectedWords[i], actualWords[i]);
            if (distance <= 2) {
                spellingErrors++;
            } else {
                grammarErrors++;
            }
        }
    }

    // Palabras faltantes o extras
    if (actualWords.length !== expectedWords.length) {
        grammarErrors += Math.abs(actualWords.length - expectedWords.length);
    }

    const accuracyPercentage = (wordsCorrect / wordsTotal) * 100;

    return {
        wordsTotal,
        wordsCorrect,
        accuracyPercentage,
        spellingErrors,
        grammarErrors
    };
}

// Algoritmo de Levenshtein para calcular distancia entre palabras
function levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        }
    });
}

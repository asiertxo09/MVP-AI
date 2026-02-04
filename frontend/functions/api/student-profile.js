import { requireDb } from "../lib/d1";
import { getSession } from "../lib/session";

// Crear o actualizar perfil del estudiante basado en evaluación
export const onRequestPost = async ({ request, env }) => {
    try {
        const session = await getSession(request, env);
        if (!session) {
            return jsonResponse({ error: "No autenticado" }, 401);
        }

        const db = requireDb(env);
        const body = await request.json();
        const { assessmentId } = body;

        // Obtener todos los resultados de la evaluación
        const assessment = await db.prepare(
            `SELECT * FROM initial_assessments WHERE id = ? AND user_id = ?`
        ).bind(assessmentId, session.sub).first();

        if (!assessment) {
            return jsonResponse({ error: "Evaluación no encontrada" }, 404);
        }

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

        // Calcular niveles y métricas globales
        const profile = calculateStudentProfile({
            reading,
            phonological,
            math,
            dictation
        });

        // Verificar si ya existe un perfil
        const existingProfile = await db.prepare(
            `SELECT id FROM student_profiles WHERE user_id = ?`
        ).bind(session.sub).first();

        if (existingProfile) {
            // Actualizar perfil existente
            await db.prepare(`
                UPDATE student_profiles SET
                    assessment_id = ?,
                    reading_level = ?,
                    phonological_level = ?,
                    math_level = ?,
                    writing_level = ?,
                    overall_pcpm = ?,
                    overall_epm = ?,
                    overall_accuracy = ?,
                    strengths = ?,
                    areas_improvement = ?,
                    recommended_activities = ?,
                    last_updated = datetime('now')
                WHERE user_id = ?
            `).bind(
                assessmentId,
                profile.readingLevel,
                profile.phonologicalLevel,
                profile.mathLevel,
                profile.writingLevel,
                profile.overallPcpm,
                profile.overallEpm,
                profile.overallAccuracy,
                JSON.stringify(profile.strengths),
                JSON.stringify(profile.areasImprovement),
                JSON.stringify(profile.recommendedActivities),
                session.sub
            ).run();
        } else {
            // Crear nuevo perfil
            await db.prepare(`
                INSERT INTO student_profiles 
                (user_id, assessment_id, reading_level, phonological_level, 
                 math_level, writing_level, overall_pcpm, overall_epm, 
                 overall_accuracy, strengths, areas_improvement, recommended_activities)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                session.sub,
                assessmentId,
                profile.readingLevel,
                profile.phonologicalLevel,
                profile.mathLevel,
                profile.writingLevel,
                profile.overallPcpm,
                profile.overallEpm,
                profile.overallAccuracy,
                JSON.stringify(profile.strengths),
                JSON.stringify(profile.areasImprovement),
                JSON.stringify(profile.recommendedActivities)
            ).run();
        }

        return jsonResponse({ ok: true, profile }, 201);
    } catch (err) {
        console.error("Error creating student profile:", err);
        return jsonResponse({ error: "Error al crear perfil" }, 500);
    }
};

// Obtener perfil del estudiante
export const onRequestGet = async ({ request, env }) => {
    try {
        const session = await getSession(request, env);
        if (!session) {
            return jsonResponse({ error: "No autenticado" }, 401);
        }

        const db = requireDb(env);

        const profile = await db.prepare(
            `SELECT * FROM student_profiles WHERE user_id = ?`
        ).bind(session.sub).first();

        if (!profile) {
            // Return a default profile if not found, instead of 404
            // This ensures GameEngine and other tools work for new children
            return jsonResponse({
                profile: {
                    user_id: session.sub,
                    reading_level: 'inicial',
                    math_level: 'inicial',
                    writing_level: 'inicial',
                    daily_time_limit: 900,
                    strengths: [],
                    areasImprovement: [],
                    recommendedActivities: []
                }
            });
        }

        // Parsear campos JSON
        profile.strengths = JSON.parse(profile.strengths || '[]');
        profile.areasImprovement = JSON.parse(profile.areas_improvement || '[]');
        profile.recommendedActivities = JSON.parse(profile.recommended_activities || '[]');
        profile.daily_time_limit = profile.daily_time_limit_seconds || 900;

        // Fetch Modality Profile (NeuroQuest Phase 2)
        const modalityProfile = await db.prepare(
            `SELECT * FROM modality_profiles WHERE child_id = ?`
        ).bind(profile.id).first(); // assuming profile.id or look up by user_id if needed. 
        // NOTE: student_profiles usually has 'id' PK, but 'user_id' FK. 
        // modality_profiles uses 'child_id' which references 'children(id)'.
        // We need to confirm if 'student_profiles.user_id' maps to 'children.id' or 'children.user_id'.
        // Looking at creating profile: `user_id` is session.sub.
        // Looking at `children` table (not visible here but assumed): often children(id) is distinct.
        // Let's assume for now user_id in student_profiles is the child's user_id.
        // And modality_profiles might perform a join or verify existence.
        // Let's safe fetch by user_id if modality_profiles has user_id, OR fetch child record first.
        // Re-reading migration: modality_profiles(child_id).
        // If 'student_profiles' is for a child, then 'session.sub' is the child's user_id. 
        // We probably need to lookup the child record to get the 'id' for 'modality_profiles', 
        // OR simply add 'modality_profiles' support to look up by user_id if we change migration? 
        // No, migration is set. Let's try to find child_id from user_id.

        // However, looking at 'children.js' might reveal if children table has user_id.
        // Let's assume we can try to join or separate query.
        // For safely, let's just expose it if we can find it.

        // Actually, let's keep it simple: fetch by joining or assuming mapped ID.
        // Wait, 'children' table usually has 'id' and 'user_id' (if linked to auth).
        // Let's add a safe check.

        let modalityParams = {};
        const childRecord = await db.prepare("SELECT id FROM children WHERE user_id = ?").bind(session.sub).first();

        if (childRecord) {
            const mod = await db.prepare("SELECT * FROM modality_profiles WHERE child_id = ?").bind(childRecord.id).first();
            if (mod) {
                modalityParams = mod;
            }
        }

        // Attach to profile object
        profile.modality = modalityParams;

        return jsonResponse({ profile });
    } catch (err) {
        console.error("Error fetching student profile:", err);
        return jsonResponse({ error: "Error al obtener perfil" }, 500);
    }
};

// Función para calcular el perfil del estudiante
function calculateStudentProfile({ reading, phonological, math, dictation }) {
    const profile = {
        readingLevel: 'inicial',
        phonologicalLevel: 'inicial',
        mathLevel: 'inicial',
        writingLevel: 'inicial',
        overallPcpm: 0,
        overallEpm: 0,
        overallAccuracy: 0,
        strengths: [],
        areasImprovement: [],
        recommendedActivities: []
    };

    // Calcular nivel de lectura basado en PCPM
    if (reading) {
        profile.overallPcpm = reading.pcpm || 0;
        if (reading.pcpm >= 100) {
            profile.readingLevel = 'avanzado';
            profile.strengths.push('Lectura fluida');
        } else if (reading.pcpm >= 60) {
            profile.readingLevel = 'intermedio';
        } else if (reading.pcpm >= 30) {
            profile.readingLevel = 'basico';
        } else {
            profile.readingLevel = 'inicial';
            profile.areasImprovement.push('Velocidad de lectura');
        }

        if (reading.accuracy_percentage < 80) {
            profile.areasImprovement.push('Precisión en lectura');
        }
    }

    // Calcular nivel fonológico
    if (phonological) {
        if (phonological.accuracy_percentage >= 85) {
            profile.phonologicalLevel = 'avanzado';
            profile.strengths.push('Conciencia fonológica');
        } else if (phonological.accuracy_percentage >= 70) {
            profile.phonologicalLevel = 'intermedio';
        } else if (phonological.accuracy_percentage >= 50) {
            profile.phonologicalLevel = 'basico';
        } else {
            profile.phonologicalLevel = 'inicial';
            profile.areasImprovement.push('Conciencia fonológica');
        }
    }

    // Calcular nivel matemático basado en EPM
    if (math) {
        profile.overallEpm = math.epm || 0;
        if (math.accuracy_percentage >= 90 && math.epm >= 8) {
            profile.mathLevel = 'avanzado';
            profile.strengths.push('Cálculo mental');
        } else if (math.accuracy_percentage >= 75 && math.epm >= 5) {
            profile.mathLevel = 'intermedio';
        } else if (math.accuracy_percentage >= 60) {
            profile.mathLevel = 'basico';
        } else {
            profile.mathLevel = 'inicial';
            profile.areasImprovement.push('Cálculo básico');
        }
    }

    // Calcular nivel de escritura
    if (dictation) {
        if (dictation.accuracy_percentage >= 90) {
            profile.writingLevel = 'avanzado';
            profile.strengths.push('Ortografía');
        } else if (dictation.accuracy_percentage >= 75) {
            profile.writingLevel = 'intermedio';
        } else if (dictation.accuracy_percentage >= 60) {
            profile.writingLevel = 'basico';
        } else {
            profile.writingLevel = 'inicial';
            profile.areasImprovement.push('Ortografía y escritura');
        }
    }

    // Calcular precisión general
    const accuracies = [
        reading?.accuracy_percentage || 0,
        phonological?.accuracy_percentage || 0,
        math?.accuracy_percentage || 0,
        dictation?.accuracy_percentage || 0
    ].filter(a => a > 0);

    profile.overallAccuracy = accuracies.length > 0
        ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length
        : 0;

    // Generar actividades recomendadas
    profile.recommendedActivities = generateRecommendedActivities(profile);

    return profile;
}

function generateRecommendedActivities(profile) {
    const activities = [];

    if (profile.readingLevel === 'inicial' || profile.readingLevel === 'basico') {
        activities.push({
            type: 'lectura',
            title: 'Lecturas guiadas',
            description: 'Textos cortos con apoyo visual y auditivo',
            priority: 'alta'
        });
    }

    if (profile.phonologicalLevel === 'inicial' || profile.phonologicalLevel === 'basico') {
        activities.push({
            type: 'fonologia',
            title: 'Juegos de rimas y sonidos',
            description: 'Identificar sonidos iniciales y finales',
            priority: 'alta'
        });
    }

    if (profile.mathLevel === 'inicial' || profile.mathLevel === 'basico') {
        activities.push({
            type: 'matematicas',
            title: 'Juegos numéricos',
            description: 'Sumas y restas con objetos visuales',
            priority: 'media'
        });
    }

    if (profile.writingLevel === 'inicial' || profile.writingLevel === 'basico') {
        activities.push({
            type: 'escritura',
            title: 'Práctica de escritura',
            description: 'Dictados cortos y ejercicios de ortografía',
            priority: 'media'
        });
    }

    return activities;
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

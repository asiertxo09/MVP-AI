// API endpoint for High-Frequency Clinical Data Architecture (NeuroQuest Phase 1)
import { requireDb } from "../../lib/d1";
import { getSession } from "../../lib/session";

// POST: Ingest batch of telemetry events
export const onRequestPost = async ({ request, env }) => {
    try {
        // Authenticate request (optional for high-freq, but good for security)
        // If performance is critical, we might use a lighter token or skip this check for some events,
        // but for now, we assume standard session authentication.
        const session = await getSession(request, env);
        if (!session) {
            return jsonResponse({ error: "No autenticado" }, 401);
        }

        const events = await request.json();

        if (!Array.isArray(events)) {
            return jsonResponse({ error: "Expected array of events" }, 400);
        }

        if (events.length === 0) {
            return jsonResponse({ ok: true, count: 0 }, 200);
        }

        const db = requireDb(env);

        // Prepare the batch insert statement
        // Note: D1 supports batch execution via db.batch(), but standard prepared statements 
        // with multiple values are also efficient. 
        // For simplicity and safety, we'll try to use a transaction or batch.
        // Let's use a loop with a prepared statement for now, or construct a bulk insert if supported.
        // D1 `batch` method takes an array of prepared statements.

        const stmt = db.prepare(`
            INSERT INTO interaction_events 
            (session_id, timestamp, stimulus_id, interaction_type, reaction_time_ms, execution_time_ms, force_pressure, status, error_class)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const batch = events.map(event => stmt.bind(
            event.session_id || null, // Should ideally validate this belongs to the user
            event.timestamp,
            event.stimulus_id,
            event.interaction_type,
            event.reaction_time_ms || null,
            event.execution_time_ms || null,
            event.force_pressure || null,
            event.status,
            event.error_class || null
        ));

        // Execute batch
        await db.batch(batch);

        // "Fire-and-Forget" response - we don't wait for complex analytics here
        return jsonResponse({ ok: true, count: events.length }, 201);

    } catch (err) {
        console.error("Error ingestion telemetry:", err);
        return jsonResponse({ error: "Error processing telemetry" }, 500);
    }
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

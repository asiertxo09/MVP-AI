/**
 * NeuroQuest Telemetry Client
 * Handles high-frequency event batching and transmission
 */
class TelemetryClient {
    constructor(options = {}) {
        this.batchSize = options.batchSize || 10;
        this.flushInterval = options.flushInterval || 5000; // 5 seconds
        this.endpoint = '/api/telemetry';
        this.buffer = [];
        this.timer = null;
        this.sessionId = null; // Should be set when game starts
        this.enabled = true;

        // Auto-flush on page unload
        window.addEventListener('beforeunload', () => this.flush(true));

        // Start flush timer
        this.startTimer();
    }

    setSessionId(id) {
        this.sessionId = id;
    }

    /**
     * Start the periodic flush timer
     */
    startTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.flush(), this.flushInterval);
    }

    /**
     * Log a telemetry event
     * @param {string} interactionType - e.g., 'tap_start', 'drag_path'
     * @param {object} data - Additional event data
     */
    logEvent(interactionType, data = {}) {
        if (!this.enabled) return;

        const event = {
            timestamp: Date.now(),
            session_id: this.sessionId,
            interaction_type: interactionType,
            ...data
        };

        this.buffer.push(event);

        if (this.buffer.length >= this.batchSize) {
            this.flush();
        }
    }

    /**
     * Send buffered events to server
     * @param {boolean} useBeacon - Use Navigator.sendBeacon (better for unload)
     */
    async flush(useBeacon = false) {
        if (this.buffer.length === 0) return;

        const eventsToSend = [...this.buffer];
        this.buffer = []; // Clear buffer immediately

        try {
            const payload = JSON.stringify(eventsToSend);

            if (useBeacon && navigator.sendBeacon) {
                // sendBeacon is more reliable on unload
                const blob = new Blob([payload], { type: 'application/json' });
                navigator.sendBeacon(this.endpoint, blob);
            } else {
                // Standard fetch
                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: payload,
                    keepalive: true // Important for background/unload
                });

                if (!response.ok) {
                    console.warn('Telemetry upload failed:', response.status);
                    // Optional: retry logic or re-queueing (careful with memory)
                }
            }
        } catch (err) {
            console.error('Telemetry error:', err);
        }
    }
}

// Singleton instance
const telemetry = new TelemetryClient();
window.telemetry = telemetry; // Global access for game engine
export default telemetry;

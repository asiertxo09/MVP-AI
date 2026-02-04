export class GameEngine {
    constructor() {
        this.maxDailySeconds = 900; // 15 minutes
        this.playedSeconds = 0;
        this.isHardStop = false;
        this.warningShown = false;
        this.interval = null;

        // Parental Control
        // Parental Control
        const username = localStorage.getItem('eduplay_username') || 'guest';
        this.pinKey = `eduplay_parent_pin_${username}`;
        this.parentPin = localStorage.getItem(this.pinKey);

        this.activeChildId = null;

        // Difficulty Logic
        this.streak = 0;
        this.mistakesInRow = 0;
        this.difficultyMultiplier = 1.0;

        // Initialize Phase 2 State
        this.history = []; // Rolling window of last 10 trials
        this.sessionStartRT = null; // Avg RT of first 10 trials
        this.currentModalityState = {
            enhanceVisuals: false,
            slowTTS: false,
            reduceDistractors: false
        };
        this.modalityProfile = null;
    }

    async init() {
        await this.fetchProfile();
        this.startTimer();
        this.checkTimeLimit();
    }

    async fetchProfile() {
        try {
            const { apiFetch } = await import('./api-client.js');
            const response = await apiFetch('/api/student-profile');
            if (response.ok && response.data.profile) {
                const profile = response.data.profile;
                this.activeChildId = profile.user_id; // Keeping legacy user_id map
                if (profile.daily_time_limit) {
                    this.maxDailySeconds = profile.daily_time_limit;
                    console.log(`Setting maxDailySeconds to ${this.maxDailySeconds} for child ${this.activeChildId}`);
                    this.loadState();
                }

                // Neuro-Engine: Load Modality Profile
                if (profile.modality) {
                    this.modalityProfile = profile.modality;
                    this.updateModalityState();
                    console.log("Neuro-Engine: Modality Profile Loaded", this.modalityProfile);
                }
            }
        } catch (e) {
            console.warn("Failed to fetch student profile for time limit:", e);
        }
    }

    // Neuro-Engine: Modality Adaptation
    updateModalityState() {
        if (!this.modalityProfile) return;

        // Weakness Targeting: Auditory Deficit -> Enhance Visuals
        // Assuming indices are 0.0 to 1.0 or normalized scores
        // If auditory_index is significantly lower than visual_index or below threshold
        const auditory = this.modalityProfile.auditory_index || 0.5;
        if (auditory < 0.4) {
            this.currentModalityState.enhanceVisuals = true;
            this.currentModalityState.slowTTS = true;
        }
    }

    // API Support
    async saveMetric(activityType, isCorrect, details = {}) {
        try {
            const { post } = await import('./api-client.js');
            // Legacy metric save
            post('/api/metrics', {
                activityType: activityType,
                activityName: details.activityName || activityType,
                isCorrect: isCorrect,
                durationSeconds: details.durationSeconds || null,
                starsEarned: details.starsEarned || 0,
                energyChange: details.energyChange || 0,
                metadata: {
                    ...details,
                    difficulty: this.difficultyMultiplier,
                    neuroState: this.calculateNeuroMetrics(),
                    timestamp: Date.now()
                }
            }).catch(e => console.warn("Legacy metric failed", e));

            console.log("Metric saved:", activityType);

            // Phase 1: High-Frequency Telemetry
            if (window.telemetry) {
                window.telemetry.logEvent('trial_complete', {
                    activity_type: activityType,
                    status: isCorrect ? 'correct' : 'incorrect',
                    reaction_time_ms: details.reactionTimeMs || null,
                    difficulty: this.difficultyMultiplier
                });
            }

        } catch (e) {
            console.warn("Failed to save metric:", e);
        }
    }

    startTimer() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => {
            this.playedSeconds++;
            this.saveState();
            this.checkTimeLimit();
        }, 1000);
    }

    checkTimeLimit() {
        const remaining = this.maxDailySeconds - this.playedSeconds;
        if (remaining <= 60 && remaining > 0 && !this.warningShown) {
            this.warningShown = true;
            this.showToast("¡Casi terminamos por hoy!");
        }

        if (remaining <= 0) {
            this.triggerHardStop();
        }
    }

    triggerHardStop() {
        if (this.isHardStop) return;
        this.isHardStop = true;
        clearInterval(this.interval);

        // Create Full Screen Overlay
        const overlay = document.createElement('div');
        overlay.id = 'hardStopOverlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.95)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.color = 'white';
        overlay.style.textAlign = 'center';
        overlay.style.fontFamily = "'Fredoka One', cursive";

        const title = document.createElement('h1');
        title.innerText = "¡Tiempo Terminado!";
        title.style.fontSize = '3rem';
        title.style.marginBottom = '20px';
        title.style.color = '#ff6b6b';

        const missionTitle = document.createElement('h2');
        missionTitle.innerText = "Misión del Mundo Real:";
        missionTitle.style.marginBottom = '10px';

        const missionText = document.createElement('p');
        missionText.innerText = this.generateOfflineMission();
        missionText.style.fontSize = '2rem';
        missionText.style.color = '#feca57';
        missionText.style.maxWidth = '80%';

        // Back to Dashboard Button
        const btnBack = document.createElement('button');
        btnBack.innerText = "Volver al Dashboard (PIN)";
        btnBack.style.marginTop = '30px';
        btnBack.style.padding = '15px 30px';
        btnBack.style.fontSize = '1.5rem';
        btnBack.style.backgroundColor = '#6c5ce7';
        btnBack.style.color = 'white';
        btnBack.style.border = 'none';
        btnBack.style.borderRadius = '10px';
        btnBack.style.cursor = 'pointer';

        btnBack.onclick = () => {
            this.requestParentAccess((success) => {
                if (success) {
                    window.location.href = '/dashboard-parent.html';
                }
            });
        };

        overlay.appendChild(title);
        overlay.appendChild(missionTitle);
        overlay.appendChild(missionText);
        overlay.appendChild(btnBack);

        document.body.appendChild(overlay);

        // Disable interactions
        const app = document.getElementById('app');
        if (app) app.style.filter = 'blur(10px)';
    }

    generateOfflineMission() {
        const missions = [
            "¡Sal y busca 3 hojas diferentes!",
            "Dibuja a tu familia con lápices",
            "Salta 10 veces a la pata coja",
            "Busca algo de color rojo en tu casa",
            "Dale un abrazo a alguien"
        ];
        return missions[Math.floor(Math.random() * missions.length)];
    }

    showToast(message) {
        // Simple toast implementation
        const toast = document.createElement('div');
        toast.innerText = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = '#333';
        toast.style.color = '#fff';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '5px';
        toast.style.zIndex = '10000';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    getStorageKey() {
        if (this.activeChildId) return `eduplay_engine_state_${this.activeChildId}`;

        const childId = sessionStorage.getItem('eduplay_child_id');
        // Fallback to token hash or guest if no childId (legacy/direct access)
        if (!childId) {
            const token = sessionStorage.getItem('child_session_token');
            return `eduplay_engine_state_${token ? token.substring(0, 10) : 'guest'}`;
        }
        return `eduplay_engine_state_${childId}`;
    }

    loadState() {
        const saved = localStorage.getItem(this.getStorageKey());
        if (saved) {
            const parsed = JSON.parse(saved);
            const lastDate = new Date(parsed.timestamp).toDateString();
            const today = new Date().toDateString();

            // Migrate old remainingSeconds if exists
            if (parsed.remainingSeconds !== undefined && parsed.playedSeconds === undefined) {
                parsed.playedSeconds = this.maxDailySeconds - parsed.remainingSeconds;
            }

            if (lastDate === today) {
                this.playedSeconds = parsed.playedSeconds || 0;
            } else {
                this.playedSeconds = 0;
            }
        }
    }

    saveState() {
        localStorage.setItem(this.getStorageKey(), JSON.stringify({
            playedSeconds: this.playedSeconds,
            timestamp: Date.now()
        }));
    }

    // Neuro-Engine: Adaptive Difficulty (Phase 2)
    reportResult(isCorrect, activityType = 'unknown', details = {}) {
        const rt = details.reactionTimeMs || 0;

        // Update Rolling Window
        this.history.push({ isCorrect, rt, timestamp: Date.now() });
        if (this.history.length > 10) this.history.shift();

        // Initialize Baseline if needed
        if (this.history.length === 10 && this.sessionStartRT === null) {
            this.sessionStartRT = this.history.reduce((a, b) => a + b.rt, 0) / 10;
        }

        // Calculate Decision Matrix
        const adaptations = this.calculateNeuroEngine();

        // Apply Logic to Legacy Multiplier
        if (adaptations.action === 'increase_load') {
            this.difficultyMultiplier = Math.min(2.0, this.difficultyMultiplier + 0.1);
        } else if (adaptations.action === 'increase_scaffolding') {
            this.difficultyMultiplier = Math.max(0.5, this.difficultyMultiplier - 0.1);
        }

        // Save to backend with simplified method call
        this.saveMetric(activityType, isCorrect, details);

        // Return adaptations + legacy action map
        if (adaptations.scaffolding.includes('show_hint')) {
            return { action: 'show_hint', adaptations };
        }

        return { difficulty: this.difficultyMultiplier, adaptations };
    }

    calculateNeuroMetrics() {
        if (this.history.length === 0) return { accuracy: 0, consistency: 0, fatigue: 0 };

        const correctCount = this.history.filter(h => h.isCorrect).length;
        const accuracy = (correctCount / this.history.length) * 100;

        // RT Stats
        const rts = this.history.map(h => h.rt);
        const meanRT = rts.reduce((a, b) => a + b, 0) / rts.length;
        const variance = rts.reduce((a, b) => a + Math.pow(b - meanRT, 2), 0) / rts.length;
        const consistency = Math.sqrt(variance); // Standard Deviation

        // Fatigue Velocity
        let fatigue = 0;
        if (this.sessionStartRT) {
            fatigue = (meanRT - this.sessionStartRT) / this.sessionStartRT; // >0 means slowing down
        }

        return { accuracy, consistency, fatigue, meanRT };
    }

    calculateNeuroEngine() {
        const metrics = this.calculateNeuroMetrics();
        const { accuracy, consistency, fatigue } = metrics;

        // Decision Matrix (Flow Theory)
        let decision = {
            zone: 'B', // Flow
            action: 'sustain_load',
            scaffolding: [],
            intrinsicLoad: 'medium',
            visuals: this.currentModalityState // Inherit modality base
        };

        // Zone A: Boredom/Mastery (>80%)
        if (accuracy >= 80) {
            decision.zone = 'A';
            decision.action = 'increase_load';
            decision.intrinsicLoad = 'high';
            // Increase speed or complexity
        }
        // Zone C: Anxiety/Frustration (<50%)
        else if (accuracy < 50) {
            decision.zone = 'C';
            decision.action = 'increase_scaffolding';
            decision.intrinsicLoad = 'low';
            decision.scaffolding.push('show_hint');

            if (fatigue > 0.3) {
                // High fatigue
                decision.scaffolding.push('breathing_break');
            }
        }

        // Check Consistency (Attention)
        if (consistency > 1000) { // e.g. > 1s variance
            decision.scaffolding.push('attention_check');
        }

        return decision;
    }

    // Helper for games to check current state
    getAdaptations() {
        return this.calculateNeuroEngine();
    }

    // Parental Gate
    requestParentAccess(callback) {
        if (!this.parentPin) {
            this.setupParentPin(callback);
            return;
        }

        // Create PIN Modal
        this.renderPinModal("Solo Adultos", "Entrar", (pin, modal) => {
            if (pin === this.parentPin) {
                modal.remove();
                callback(true);
            } else {
                alert("PIN Incorrecto");
                callback(false);
            }
        }, () => {
            // Cancel callback
            callback(false);
        });
    }

    setupParentPin(callback) {
        // First Time Setup Flow
        this.renderPinModal("Crea tu PIN de Padres", "Siguiente", (pin1, modal1) => {
            if (pin1.length !== 4) {
                alert("El PIN debe tener 4 dígitos");
                return;
            }
            modal1.remove();

            // Confirm Step
            setTimeout(() => {
                this.renderPinModal("Confirma tu PIN", "Guardar", (pin2, modal2) => {
                    if (pin1 === pin2) {
                        this.parentPin = pin1;
                        this.parentPin = pin1;
                        localStorage.setItem(this.pinKey, pin1);
                        alert("¡PIN Guardado!");
                        alert("¡PIN Guardado!");
                        modal2.remove();
                        callback(true);
                    } else {
                        alert("Los PIN no coinciden. Intenta de nuevo.");
                        modal2.remove();
                        this.setupParentPin(callback);
                    }
                }, () => callback(false));
            }, 100);
        }, () => callback(false));
    }

    renderPinModal(titleText, confirmText, onConfirm, onCancel) {
        const modal = document.createElement('div');
        modal.className = 'pin-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '10000';

        const content = document.createElement('div');
        content.style.backgroundColor = 'white';
        content.style.padding = '2rem';
        content.style.borderRadius = '1rem';
        content.style.textAlign = 'center';

        const title = document.createElement('h2');
        title.innerText = titleText;
        title.style.marginBottom = '1rem';

        const input = document.createElement('input');
        input.type = 'password';
        input.placeholder = 'PIN';
        input.maxLength = 4;
        input.style.fontSize = '2rem';
        input.style.textAlign = 'center';
        input.style.width = '150px';
        input.style.marginBottom = '1rem';

        const btnContainer = document.createElement('div');

        const btnCancel = document.createElement('button');
        btnCancel.innerText = "Cancelar";
        btnCancel.style.marginRight = '10px';
        btnCancel.onclick = () => {
            modal.remove();
            if (onCancel) onConfirm(null, modal); // Treat as invalid or specifically call cancel
            else if (onCancel) onCancel();
        };

        const btnConfirm = document.createElement('button');
        btnConfirm.innerText = confirmText;
        btnConfirm.onclick = () => {
            const pin = input.value;
            onConfirm(pin, modal);
        };

        content.appendChild(title);
        content.appendChild(input);
        btnContainer.appendChild(btnCancel);
        btnContainer.appendChild(btnConfirm);
        content.appendChild(btnContainer);
        modal.appendChild(content);

        document.body.appendChild(modal);
        input.focus();
    }
}

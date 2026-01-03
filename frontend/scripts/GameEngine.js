export class GameEngine {
    constructor() {
        this.maxDailySeconds = 900; // 15 minutes
        this.remainingSeconds = this.maxDailySeconds;
        this.isHardStop = false;
        this.warningShown = false;
        this.interval = null;

        // Parental Control
        // Parental Control
        const username = localStorage.getItem('eduplay_username') || 'guest';
        this.pinKey = `eduplay_parent_pin_${username}`;
        this.parentPin = localStorage.getItem(this.pinKey);

        // Difficulty Logic
        this.streak = 0; // Consecutive correct answers
        this.mistakesInRow = 0;
        this.difficultyMultiplier = 1.0; // Speed/Difficulty factor

        // Load state from local storage
        this.loadState();
    }

    init() {
        this.startTimer();
        this.checkTimeLimit();
    }

    // API Support
    async saveMetric(activityType, isCorrect, details = {}) {
        // Send to backend via standard fetch if ApiClient not available in scope
        // Or assume this runs in module context where auth/api-client is importable?
        // GameEngine is imported by child-app.js, which imports api-client.
        // But GameEngine is a class. Ideally we pass saveMetric callback or import apiFetch here.
        // For simplicity, we'll try to use the global window.apiFetch if available or dynamic import.

        try {
            const { post } = await import('./api-client.js');
            await post('/api/metrics', {
                activityType: activityType,
                activityName: details.activityName || activityType,
                isCorrect: isCorrect,
                metadata: {
                    ...details,
                    difficulty: this.difficultyMultiplier,
                    timestamp: Date.now()
                }
            });
            console.log("Metric saved:", activityType);
        } catch (e) {
            console.warn("Failed to save metric:", e);
        }
    }

    startTimer() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => {
            this.remainingSeconds--;
            this.saveState();
            this.checkTimeLimit();
        }, 1000);
    }

    checkTimeLimit() {
        if (this.remainingSeconds <= 60 && this.remainingSeconds > 0 && !this.warningShown) {
            this.warningShown = true;
            this.showToast("¡Casi terminamos por hoy!");
        }

        if (this.remainingSeconds <= 0) {
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
            // Reset daily if date changed (simplified logic)
            const lastDate = new Date(parsed.timestamp).toDateString();
            const today = new Date().toDateString();
            if (lastDate === today) {
                this.remainingSeconds = parsed.remainingSeconds;
            } else {
                this.remainingSeconds = this.maxDailySeconds;
            }
        }
    }

    saveState() {
        localStorage.setItem(this.getStorageKey(), JSON.stringify({
            remainingSeconds: this.remainingSeconds,
            timestamp: Date.now()
        }));
    }

    // Adaptive Difficulty
    reportResult(isCorrect, activityType = 'unknown', activityName = null) {
        if (isCorrect) {
            this.streak++;
            this.mistakesInRow = 0;
            if (this.streak >= 3) {
                this.difficultyMultiplier += 0.1;
                this.streak = 0; // Reset streak to require another 3 for next bump
            }
        } else {
            this.streak = 0;
            this.mistakesInRow++;
            if (this.mistakesInRow >= 2) {
                this.difficultyMultiplier = Math.max(0.5, this.difficultyMultiplier - 0.15);
                this.mistakesInRow = 0;
                // Show Hint (handled by game logic, but flagged here)
                this.saveMetric(activityType, isCorrect, { action: 'show_hint', activityName: activityName || activityType });
                return { action: 'show_hint' };
            }
        }

        // Save to backend
        this.saveMetric(activityType, isCorrect, { activityName: activityName || activityType });

        // Critical Failure Check
        // Ideally we track accuracy over last N attempts.
        // Simplified: if multiplier drops too low.
        if (this.difficultyMultiplier < 0.6) {
            // Trigger breathing?
            return { action: 'breathing_exercise' };
        }

        return { difficulty: this.difficultyMultiplier };
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

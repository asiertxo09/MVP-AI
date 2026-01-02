// =========================================================
// Onboarding Wizard Logic
// =========================================================

export class WizardController {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentStep = 0;
        this.totalSteps = 8;
        this.userData = {
            consentGiven: false,
            micPermissionGranted: false,
            audioCalibrated: false,
            selectedAvatar: null,
            assessmentComplete: false,
            fluencyTestComplete: false,
            goalsSet: false
        };
        this.audioStream = null;
        this.audioContext = null;
        this.analyser = null;
    }

    // Step definitions
    get steps() {
        return [
            { id: 'welcome', title: '¡Bienvenido!', component: this.renderWelcome.bind(this) },
            { id: 'microphone', title: 'Micrófono', component: this.renderMicrophone.bind(this) },
            { id: 'calibration', title: 'Calibración', component: this.renderCalibration.bind(this) },
            { id: 'avatar', title: 'Tu Avatar', component: this.renderAvatar.bind(this) },
            { id: 'assessment', title: 'Evaluación', component: this.renderAssessment.bind(this) },
            { id: 'fluency', title: 'Fluidez', component: this.renderFluency.bind(this) },
            { id: 'goals', title: 'Objetivos', component: this.renderGoals.bind(this) },
            { id: 'done', title: '¡Listo!', component: this.renderDone.bind(this) }
        ];
    }

    init() {
        this.render();
    }

    render() {
        this.container.innerHTML = '';

        // Progress bar
        const progress = document.createElement('div');
        progress.className = 'wizard-progress';
        progress.innerHTML = this.steps.map((step, i) => `
            <div class="progress-step ${i < this.currentStep ? 'done' : ''} ${i === this.currentStep ? 'active' : ''}">
                <span class="step-num">${i + 1}</span>
                <span class="step-label">${step.title}</span>
            </div>
        `).join('');

        // Content
        const content = document.createElement('div');
        content.className = 'wizard-content';
        content.id = 'wizard-step-content';

        this.container.appendChild(progress);
        this.container.appendChild(content);

        // Render current step
        this.steps[this.currentStep].component(content);
    }

    nextStep() {
        if (this.currentStep < this.totalSteps - 1) {
            this.currentStep++;
            this.render();
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.render();
        }
    }

    // ===== Step Components =====

    renderWelcome(container) {
        container.innerHTML = `
            <div class="step-card">
                <h2>👋 ¡Hola, futuro héroe!</h2>
                <p>Vamos a preparar todo para que puedas empezar tu aventura de aprendizaje.</p>
                <div class="consent-box">
                    <label>
                        <input type="checkbox" id="consent-check">
                        Acepto los términos y condiciones de uso y la política de privacidad.
                    </label>
                </div>
                <div class="btn-row">
                    <button class="btn-next" id="btn-next" disabled>Siguiente →</button>
                </div>
            </div>
        `;

        const checkbox = document.getElementById('consent-check');
        const btn = document.getElementById('btn-next');
        checkbox.addEventListener('change', () => {
            this.userData.consentGiven = checkbox.checked;
            btn.disabled = !checkbox.checked;
        });
        btn.addEventListener('click', () => this.nextStep());
    }

    renderMicrophone(container) {
        container.innerHTML = `
            <div class="step-card">
                <h2>🎤 Necesitamos tu micrófono</h2>
                <p>Para escuchar tu voz y ayudarte a mejorar, necesitamos acceso al micrófono.</p>
                <button class="btn-primary" id="btn-request-mic">Permitir Micrófono</button>
                <p id="mic-status" class="status-text"></p>
                <div class="btn-row">
                    <button class="btn-back" id="btn-back">← Atrás</button>
                    <button class="btn-next" id="btn-next" disabled>Siguiente →</button>
                </div>
            </div>
        `;

        document.getElementById('btn-back').addEventListener('click', () => this.prevStep());
        document.getElementById('btn-request-mic').addEventListener('click', () => this.requestMicPermission());
        document.getElementById('btn-next').addEventListener('click', () => this.nextStep());
    }

    async requestMicPermission() {
        const statusEl = document.getElementById('mic-status');
        try {
            this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.userData.micPermissionGranted = true;
            statusEl.textContent = '✅ ¡Micrófono conectado!';
            statusEl.className = 'status-text success';
            document.getElementById('btn-next').disabled = false;
        } catch (err) {
            statusEl.textContent = '❌ Permiso denegado. Intenta de nuevo.';
            statusEl.className = 'status-text error';
        }
    }

    renderCalibration(container) {
        container.innerHTML = `
            <div class="step-card">
                <h2>🔊 Calibración de Voz</h2>
                <p>Habla en voz alta para verificar que te escuchamos bien.</p>
                <div class="audio-meter">
                    <div class="meter-bar" id="meter-bar"></div>
                </div>
                <p id="calibration-status" class="status-text">Esperando audio...</p>
                <div class="btn-row">
                    <button class="btn-back" id="btn-back">← Atrás</button>
                    <button class="btn-next" id="btn-next" disabled>Siguiente →</button>
                </div>
            </div>
        `;

        document.getElementById('btn-back').addEventListener('click', () => this.prevStep());
        document.getElementById('btn-next').addEventListener('click', () => {
            this.stopAudioAnalysis();
            this.nextStep();
        });

        this.startAudioAnalysis();
    }

    startAudioAnalysis() {
        if (!this.audioStream) return;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(this.audioStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const meterBar = document.getElementById('meter-bar');
        const statusEl = document.getElementById('calibration-status');
        const btnNext = document.getElementById('btn-next');

        let detectedSound = false;

        const checkLevel = () => {
            if (!this.analyser) return;
            this.analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            const level = Math.min(100, (avg / 128) * 100);

            meterBar.style.width = `${level}%`;

            if (level > 20 && !detectedSound) {
                detectedSound = true;
                statusEl.textContent = '✅ ¡Te escuchamos! Puedes continuar.';
                statusEl.className = 'status-text success';
                btnNext.disabled = false;
                this.userData.audioCalibrated = true;
            }

            requestAnimationFrame(checkLevel);
        };
        checkLevel();
    }

    stopAudioAnalysis() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
            this.analyser = null;
        }
    }

    renderAvatar(container) {
        const avatars = ['🦁', '🐸', '🐱', '🐶', '🦊', '🐼'];
        container.innerHTML = `
            <div class="step-card">
                <h2>🎭 Elige tu Avatar</h2>
                <p>¿Quién te acompañará en esta aventura?</p>
                <div class="avatar-grid">
                    ${avatars.map((a, i) => `<button class="avatar-btn" data-index="${i}">${a}</button>`).join('')}
                </div>
                <div class="btn-row">
                    <button class="btn-back" id="btn-back">← Atrás</button>
                    <button class="btn-next" id="btn-next" disabled>Siguiente →</button>
                </div>
            </div>
        `;

        document.getElementById('btn-back').addEventListener('click', () => this.prevStep());
        document.getElementById('btn-next').addEventListener('click', () => this.nextStep());

        container.querySelectorAll('.avatar-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.userData.selectedAvatar = btn.textContent;
                document.getElementById('btn-next').disabled = false;
            });
        });
    }

    renderAssessment(container) {
        container.innerHTML = `
            <div class="step-card">
                <h2>📝 Evaluación Rápida</h2>
                <p>Haremos una pequeña prueba para conocer tu nivel. ¡No te preocupes, no hay respuestas incorrectas!</p>
                <button class="btn-primary" id="btn-start-assessment">Empezar Evaluación</button>
                <p id="assessment-status" class="status-text"></p>
                <div class="btn-row">
                    <button class="btn-back" id="btn-back">← Atrás</button>
                    <button class="btn-next" id="btn-next" disabled>Siguiente →</button>
                </div>
            </div>
        `;

        document.getElementById('btn-back').addEventListener('click', () => this.prevStep());
        document.getElementById('btn-next').addEventListener('click', () => this.nextStep());
        document.getElementById('btn-start-assessment').addEventListener('click', () => {
            // Simulate assessment (in real app, would open a modal or inline game)
            document.getElementById('assessment-status').textContent = '✅ ¡Evaluación completada!';
            document.getElementById('assessment-status').className = 'status-text success';
            this.userData.assessmentComplete = true;
            document.getElementById('btn-next').disabled = false;
        });
    }

    renderFluency(container) {
        container.innerHTML = `
            <div class="step-card">
                <h2>📖 Prueba de Fluidez (Opcional)</h2>
                <p>Lee la siguiente oración en voz alta:</p>
                <blockquote>"El sol brilla en el cielo azul."</blockquote>
                <button class="btn-primary" id="btn-record">🎙️ Grabar</button>
                <p id="fluency-status" class="status-text">Puedes omitir este paso.</p>
                <div class="btn-row">
                    <button class="btn-back" id="btn-back">← Atrás</button>
                    <button class="btn-next" id="btn-next">Siguiente →</button>
                </div>
            </div>
        `;

        document.getElementById('btn-back').addEventListener('click', () => this.prevStep());
        document.getElementById('btn-next').addEventListener('click', () => this.nextStep());
        document.getElementById('btn-record').addEventListener('click', () => {
            document.getElementById('fluency-status').textContent = '✅ ¡Grabación guardada!';
            document.getElementById('fluency-status').className = 'status-text success';
            this.userData.fluencyTestComplete = true;
        });
    }

    renderGoals(container) {
        container.innerHTML = `
            <div class="step-card">
                <h2>🎯 Establece Objetivos</h2>
                <p>¿Qué quieres mejorar? (Selecciona uno o más)</p>
                <div class="goal-options">
                    <label><input type="checkbox" name="goal" value="reading"> Lectura</label>
                    <label><input type="checkbox" name="goal" value="speaking"> Habla</label>
                    <label><input type="checkbox" name="goal" value="math"> Matemáticas</label>
                    <label><input type="checkbox" name="goal" value="attention"> Atención</label>
                </div>
                <div class="btn-row">
                    <button class="btn-back" id="btn-back">← Atrás</button>
                    <button class="btn-next" id="btn-next" disabled>Finalizar →</button>
                </div>
            </div>
        `;

        document.getElementById('btn-back').addEventListener('click', () => this.prevStep());
        document.getElementById('btn-next').addEventListener('click', () => this.nextStep());

        container.querySelectorAll('input[name="goal"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const anyChecked = container.querySelectorAll('input[name="goal"]:checked').length > 0;
                document.getElementById('btn-next').disabled = !anyChecked;
                this.userData.goalsSet = anyChecked;
            });
        });
    }

    renderDone(container) {
        // Cleanup audio stream
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(t => t.stop());
        }

        container.innerHTML = `
            <div class="step-card done-step">
                <h2>🎉 ¡Todo listo!</h2>
                <p>Tu aventura de aprendizaje está a punto de comenzar.</p>
                <div class="avatar-preview">${this.userData.selectedAvatar || '🦁'}</div>
                <button class="btn-primary" id="btn-go-map">Ir al Mapa →</button>
            </div>
        `;

        document.getElementById('btn-go-map').addEventListener('click', () => {
            // Save user data to localStorage or send to API
            localStorage.setItem('wizard_complete', 'true');
            localStorage.setItem('selected_avatar', this.userData.selectedAvatar);
            window.location.href = '/app/index.html';
        });
    }
}

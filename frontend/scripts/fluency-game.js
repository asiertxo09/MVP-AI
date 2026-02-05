// =========================================================
// Fluency Falls - Reading Fluency Game
// =========================================================

import { GameEngine } from './GameEngine.js';

export class FluencyFallsGame {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.engine = new GameEngine();
        this.text = "El rápido zorro marrón salta sobre el perro perezoso.";
        this.targetWPM = 60; // Words Per Minute
        this.words = this.text.split(' ');
        this.karaokeInterval = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isPlayingReference = false;
    }

    async init() {
        this.render();

        // Neuro-Engine: Check Modality to adjust WPM or text size
        const adaptations = this.engine.getAdaptations();
        if (adaptations.visuals && adaptations.visuals.enhanceVisuals) {
            this.container.classList.add('high-contrast');
        }

        // Adjust WPM based on difficulty/profile
        if (adaptations.intrinsicLoad === 'low') {
            this.targetWPM = 40;
        } else if (adaptations.intrinsicLoad === 'high') {
            this.targetWPM = 80;
        }
    }

    render() {
        this.container.innerHTML = '';
        this.container.className = 'fluency-container';

        // Header
        const header = document.createElement('div');
        header.innerHTML = `<h2>🌊 Cataratas de Fluidez</h2>`;
        this.container.appendChild(header);

        // Waterfall Visual (Flow Interaction)
        const waterfall = document.createElement('div');
        waterfall.className = 'waterfall';
        // Speed depends on WPM
        waterfall.style.animationDuration = `${60 / this.targetWPM}s`;
        this.container.appendChild(waterfall);

        // Text Display
        const textDisplay = document.createElement('div');
        textDisplay.className = 'text-display';
        textDisplay.id = 'karaoke-text';

        this.words.forEach((word, idx) => {
            const span = document.createElement('span');
            span.innerText = word + ' ';
            span.id = `word-${idx}`;
            textDisplay.appendChild(span);
        });

        this.container.appendChild(textDisplay);

        // Controls
        const controls = document.createElement('div');
        controls.className = 'controls';

        const btnListen = document.createElement('button');
        btnListen.innerText = "👂 Escuchar (Modelo)";
        btnListen.onclick = () => this.playReferenceAudio();

        const btnRecord = document.createElement('button');
        btnRecord.innerText = "🎤 Grabar Lectura";
        btnRecord.onclick = () => this.toggleRecording(btnRecord);

        controls.appendChild(btnListen);
        controls.appendChild(btnRecord);
        this.container.appendChild(controls);

        // Back Button
        const backBtn = document.createElement('button');
        backBtn.className = 'back-btn';
        backBtn.innerText = '← Volver';
        backBtn.onclick = () => window.location.href = 'index.html';
        this.container.appendChild(backBtn);
    }

    playReferenceAudio() {
        if (this.isPlayingReference) return;
        this.isPlayingReference = true;

        // Simulate TTS and Karaoke Animation
        const perWordTime = (60 / this.targetWPM) * 1000;
        let currentWordIndex = 0;

        // Reset Styles
        this.words.forEach((_, idx) => {
            document.getElementById(`word-${idx}`).classList.remove('active');
        });

        this.karaokeInterval = setInterval(() => {
            if (currentWordIndex >= this.words.length) {
                clearInterval(this.karaokeInterval);
                this.isPlayingReference = false;
                return;
            }

            // Highlight current word
            if (currentWordIndex > 0) {
                document.getElementById(`word-${currentWordIndex - 1}`).classList.remove('active');
            }
            document.getElementById(`word-${currentWordIndex}`).classList.add('active');

            // Play sound (Beep for prototype, real TTS in prod)
            this.playPip();

            currentWordIndex++;
        }, perWordTime);
    }

    playPip() {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    }

    async toggleRecording(btn) {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            btn.innerText = "🎤 Grabar Lectura";
            btn.classList.remove('recording');
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.mediaRecorder = new MediaRecorder(stream);
                this.audioChunks = [];

                this.mediaRecorder.ondataavailable = (event) => {
                    this.audioChunks.push(event.data);
                };

                this.mediaRecorder.onstop = () => {
                    // Playback (Echo Reading)
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    audio.play();

                    this.engine.reportResult(true, 'fluency_reading', {
                        durationSeconds: this.audioChunks.length, // rough proxy
                        wpm: this.targetWPM // Ideally calculated from audio duration
                    });

                    alert("¡Bien hecho! Ahora escúchate a ti mismo (Eco).");
                };

                this.mediaRecorder.start();
                btn.innerText = "⏹ Detener";
                btn.classList.add('recording');
            } catch (e) {
                console.error("Error accessing microphone", e);
                alert("Necesitamos acceso al micrófono para esta actividad.");
            }
        }
    }
}

// =========================================================
// Auditory Station - Processing & Noise Filtering
// =========================================================

import { GameEngine } from './GameEngine.js';

export class AuditoryGame {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.engine = new GameEngine();
        this.ctx = null;
        this.noiseNode = null;
        this.targetNode = null;
        this.noiseGain = null;
        this.targetGain = null;
        this.isPlaying = false;

        this.SNR_Level = 0.5; // Signal-to-Noise Ratio (0.0 to 1.0)
    }

    init() {
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        this.container.className = 'auditory-container';

        // Header
        const header = document.createElement('div');
        header.innerHTML = `<h2>🔊 Estación Auditiva</h2>`;
        this.container.appendChild(header);

        // Visual Anchor Display (Shape Morphing)
        const anchorDisplay = document.createElement('div');
        anchorDisplay.className = 'visual-anchor';
        anchorDisplay.style.width = '200px';
        anchorDisplay.style.height = '200px';
        anchorDisplay.style.backgroundColor = '#6C5CE7';
        anchorDisplay.style.margin = '20px auto';
        anchorDisplay.style.borderRadius = '50%'; // Starts as Circle (Low Pitch)
        anchorDisplay.style.transition = 'all 0.5s ease';
        anchorDisplay.id = 'visual-anchor-shape';
        this.container.appendChild(anchorDisplay);

        // Controls
        const controls = document.createElement('div');

        const btnPlayLow = document.createElement('button');
        btnPlayLow.innerText = "▶ Tono Bajo (Oso)";
        btnPlayLow.onclick = () => this.playSound('low');

        const btnPlayHigh = document.createElement('button');
        btnPlayHigh.innerText = "▶ Tono Alto (Pájaro)";
        btnPlayHigh.onclick = () => this.playSound('high');

        // Noise Slider
        const sliderContainer = document.createElement('div');
        sliderContainer.style.marginTop = '20px';
        sliderContainer.innerHTML = '<label>Nivel de Ruido (Cafetería): </label>';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 100;
        slider.value = 50;
        slider.oninput = (e) => {
            this.SNR_Level = 1 - (e.target.value / 100);
            if (this.noiseGain) {
                this.noiseGain.gain.setValueAtTime((1 - this.SNR_Level) * 0.5, this.ctx.currentTime);
            }
        };
        sliderContainer.appendChild(slider);

        controls.appendChild(btnPlayLow);
        controls.appendChild(btnPlayHigh);
        this.container.appendChild(controls);
        this.container.appendChild(sliderContainer);

        // Back Button
        const backBtn = document.createElement('button');
        backBtn.className = 'back-btn';
        backBtn.innerText = '← Volver';
        backBtn.onclick = () => window.location.href = 'index.html';
        this.container.appendChild(backBtn);
    }

    initAudio() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            // Create Noise Generator (Pink Noise approximation)
            const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = data[i];
                data[i] *= 3.5;
            }
            let lastOut = 0;

            this.noiseBuffer = buffer;
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    playSound(type) {
        this.initAudio();

        // 1. Play Noise Background
        if (!this.isPlaying) {
            this.noiseNode = this.ctx.createBufferSource();
            this.noiseNode.buffer = this.noiseBuffer;
            this.noiseNode.loop = true;
            this.noiseGain = this.ctx.createGain();
            this.noiseNode.connect(this.noiseGain);
            this.noiseGain.connect(this.ctx.destination);
            // Set initial volume based on SNR
            this.noiseGain.gain.setValueAtTime((1 - this.SNR_Level) * 0.5, this.ctx.currentTime);
            this.noiseNode.start();
        }

        // 2. Play Target Sound
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const shape = document.getElementById('visual-anchor-shape');

        if (type === 'high') {
            osc.frequency.setValueAtTime(800, this.ctx.currentTime); // High pitch
            shape.style.borderRadius = '0%'; // Triangle/Square (Sharp)
            shape.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)'; // Triangle
            shape.style.backgroundColor = '#FF7675'; // Red-ish
        } else {
            osc.frequency.setValueAtTime(200, this.ctx.currentTime); // Low pitch
            shape.style.borderRadius = '50%'; // Circle (Round)
            shape.style.clipPath = 'none';
            shape.style.backgroundColor = '#6C5CE7'; // Blue-ish
        }

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 1.0);

        // Report telemetry
        this.engine.reportResult(true, 'auditory_discrimination', {
            target: type,
            snr_level: this.SNR_Level
        });
    }
}

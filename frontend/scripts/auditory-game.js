
import { GameEngine } from './GameEngine.js';

export class AuditoryGame {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.engine = new GameEngine();
        this.audioCtx = null;
        this.isPlaying = false;
        this.currentSide = null; // 'left' or 'right'
        this.analyser = null;
        this.dataArray = null;
        this.canvasCtx = null;
    }

    init() {
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        this.container.className = 'game-container auditory-theme';

        // Header
        const header = document.createElement('div');
        header.innerHTML = `<h2>🔊 Estación Auditiva</h2>`;
        this.container.appendChild(header);

        // Speakers Area
        const speakersRow = document.createElement('div');
        speakersRow.className = 'speakers-row';

        // Left Speaker
        const leftSpeaker = document.createElement('div');
        leftSpeaker.className = 'speaker left';
        leftSpeaker.id = 'speaker-left';
        leftSpeaker.onclick = () => this.checkAnswer('left');
        leftSpeaker.innerHTML = `<div class="speaker-cone"></div>`;
        speakersRow.appendChild(leftSpeaker);

        // Waveform Canvas (Middle)
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'waveform-display';
        const canvas = document.createElement('canvas');
        canvas.id = 'wave-canvas';
        canvas.width = 300;
        canvas.height = 100;
        canvasContainer.appendChild(canvas);
        speakersRow.appendChild(canvasContainer);

        // Right Speaker
        const rightSpeaker = document.createElement('div');
        rightSpeaker.className = 'speaker right';
        rightSpeaker.id = 'speaker-right';
        rightSpeaker.onclick = () => this.checkAnswer('right');
        rightSpeaker.innerHTML = `<div class="speaker-cone"></div>`;
        speakersRow.appendChild(rightSpeaker);

        this.container.appendChild(speakersRow);

        // Controls
        const controls = document.createElement('div');
        controls.className = 'game-hud';

        const btnPlay = document.createElement('button');
        btnPlay.className = 'btn-primary-action';
        btnPlay.innerText = "▶ Reproducir Sonido";
        btnPlay.onclick = () => this.playStimulus();

        controls.appendChild(btnPlay);

        const info = document.createElement('p');
        info.innerText = "¿De qué lado vino el sonido?";
        info.style.marginTop = '10px';
        controls.appendChild(info);

        this.container.appendChild(controls);

        // Prepare Canvas
        this.canvasCtx = canvas.getContext('2d');
    }

    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 256;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.draw();
        }
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    }

    draw() {
        if (!this.canvasCtx) return;
        requestAnimationFrame(() => this.draw());

        this.analyser.getByteTimeDomainData(this.dataArray);

        const canvas = document.getElementById('wave-canvas');
        if (!canvas) return; // Unmounted

        const ctx = this.canvasCtx;
        const width = canvas.width;
        const height = canvas.height;

        ctx.fillStyle = '#2d3436';
        ctx.fillRect(0, 0, width, height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00cec9';
        ctx.beginPath();

        const sliceWidth = width * 1.0 / this.dataArray.length;
        let x = 0;

        for (let i = 0; i < this.dataArray.length; i++) {
            const v = this.dataArray[i] / 128.0;
            const y = v * height / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    }

    playStimulus() {
        this.initAudio();

        // Pick Side
        this.currentSide = Math.random() > 0.5 ? 'right' : 'left';
        const panVal = this.currentSide === 'left' ? -1 : 1;

        const osc = this.audioCtx.createOscillator();
        const panner = this.audioCtx.createStereoPanner();
        const gain = this.audioCtx.createGain();

        osc.frequency.setValueAtTime(440, this.audioCtx.currentTime);
        // Slide pitch
        osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.3);

        panner.pan.value = panVal;

        osc.connect(panner);
        panner.connect(gain);
        gain.connect(this.analyser); // For visual
        this.analyser.connect(this.audioCtx.destination);

        gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, this.audioCtx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.5);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.5);

        // Animate Speaker
        const spk = document.getElementById(this.currentSide === 'left' ? 'speaker-left' : 'speaker-right');
        spk.classList.add('pumping');
        setTimeout(() => spk.classList.remove('pumping'), 500);
    }

    checkAnswer(side) {
        if (!this.currentSide) {
            alert("¡Dale a reproducir primero!");
            return;
        }

        if (side === this.currentSide) {
            alert("✅ ¡Correcto!");
            // Complete
            const btn = document.querySelector('button.btn-primary');
            if (btn) btn.click();
            else {
                // Reset
                this.currentSide = null;
            }
        } else {
            alert("❌ Inténtalo de nuevo. Escucha con atención.");
        }
    }
}

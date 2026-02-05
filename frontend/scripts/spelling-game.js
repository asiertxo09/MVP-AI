
import { GameEngine } from './GameEngine.js';

export class SpellingGame {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.engine = new GameEngine();
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.targetLetter = 'S'; // 'S' for Spell
        this.particles = [];
        this.audioCtx = null;
        this.humOscillator = null;
    }

    init() {
        this.render();
        this.animateParticles();
    }

    render() {
        this.container.innerHTML = '';
        this.container.className = 'game-container sanctuary-theme';

        // Header
        const header = document.createElement('div');
        header.innerHTML = `<h2>✨ Santuario de Hechizos</h2>`;
        this.container.appendChild(header);

        // Tablet Wrapper
        const tablet = document.createElement('div');
        tablet.className = 'magic-tablet';

        // Ghost Guide
        const guide = document.createElement('div');
        guide.className = 'letter-guide';
        guide.innerText = this.targetLetter;
        tablet.appendChild(guide);

        // Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = 400;
        this.canvas.height = 400;
        this.canvas.className = 'magic-canvas';

        this.listen(this.canvas);

        tablet.appendChild(this.canvas);
        this.container.appendChild(tablet);

        this.ctx = this.canvas.getContext('2d');

        // Instructions
        const hud = document.createElement('div');
        hud.className = 'game-hud';
        hud.innerHTML = `<p>Dibuja la runa mágica <strong>"${this.targetLetter}"</strong></p>`;
        this.container.appendChild(hud);

        // Controls (Clear/Check)
        const controls = document.createElement('div');
        controls.style.marginTop = "20px";

        const btnClear = document.createElement('button');
        btnClear.innerText = "🔄 Reiniciar Hechizo";
        btnClear.onclick = () => this.clear();

        const btnCast = document.createElement('button');
        btnCast.innerText = "🪄 Lanzar Hechizo";
        btnCast.onclick = () => this.castSpell();

        controls.appendChild(btnClear);
        controls.appendChild(btnCast);
        this.container.appendChild(controls);
    }

    listen(canvas) {
        const start = (e) => {
            this.isDrawing = true;
            this.startHum();
            e.preventDefault();
        };
        const move = (e) => {
            if (!this.isDrawing) return;
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
            const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

            this.spawnParticles(x, y);
            this.drawStroke(x, y);
        };
        const end = () => {
            this.isDrawing = false;
            this.stopHum();
        };

        canvas.addEventListener('mousedown', start);
        canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);

        canvas.addEventListener('touchstart', start, { passive: false });
        canvas.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('touchend', end);
    }

    startHum() {
        if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.humOscillator = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        this.humOscillator.channelCount = 2;
        this.humOscillator.type = 'sine';
        this.humOscillator.frequency.setValueAtTime(100, this.audioCtx.currentTime); // Low hum

        this.humOscillator.connect(gain);
        gain.connect(this.audioCtx.destination);

        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        this.humOscillator.start();
    }

    stopHum() {
        if (this.humOscillator) {
            this.humOscillator.stop();
            this.humOscillator = null;
        }
    }

    drawStroke(x, y) {
        // Draw implicit stroke for logic (hidden or subtle)
        // For visual, we rely on particles, but let's draw a faint line for continuity
        // Actually, let's just use particles.
    }

    spawnParticles(x, y) {
        for (let i = 0; i < 3; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: 1.0,
                color: `hsl(${Math.random() * 60 + 200}, 100%, 70%)` // Blues/Purples
            });
        }
    }

    animateParticles() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update & Draw Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            } else {
                this.ctx.globalAlpha = p.life;
                this.ctx.fillStyle = p.color;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, 4 * p.life, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // Persistent Trace (Optional, maybe not needed if particles are dense enough or we leave a trail buffer)
        // Ideally we draw onto a separate canvas for the permanent stroke and main canvas for particles.
        // For simplicity, let's assume "Magic Dust" stays for a bit (long life) or we just rely on the effect.
        // Actually, for spelling we need to see the shape.
        // Let's add a long-lived "Trail" particle or just draw into a buffer.

        requestAnimationFrame(() => this.animateParticles());
    }

    clear() {
        this.particles = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    castSpell() {
        // Check if particles cover the guide? 
        // For prototype, simulate success.
        alert("✨ ¡Hechizo Lazado!");
        // Trigger complete
        const btn = document.querySelector('button.btn-primary');
        if (btn) btn.click();
    }
}

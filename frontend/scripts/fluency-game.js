
import { GameEngine } from './GameEngine.js';

export class FluencyFallsGame {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.engine = new GameEngine();
        this.text = `
            Había una vez un pequeño barco
            que no sabía, que no sabía navegar.
            Pasaron una, dos, tres, cuatro,
            cinco, seis, siete semanas.
            Y el barco, y el barco,
            comenzó a navegar.`;

        this.lines = this.text.split('\n').map(l => l.trim()).filter(l => l);
        this.isFlowing = false;
        this.scrollSpeed = 0;
        this.baseSpeed = 1; // Pixels per frame
        this.micLevel = 0;

        this.audioCtx = null;
        this.analyser = null;
        this.dataArray = null;
    }

    async init() {
        this.render();
        // Ask for mic permission immediately for the visualizer
        await this.setupMic();
    }

    async setupMic() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioCtx.createMediaStreamSource(stream);
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

            this.startLoop();
        } catch (e) {
            console.error("Mic access denied", e);
            alert("Necesitamos el micrófono para que el río fluya.");
        }
    }

    startLoop() {
        const loop = () => {
            if (!this.analyser) return;

            this.analyser.getByteFrequencyData(this.dataArray);

            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < this.dataArray.length; i++) {
                sum += this.dataArray[i];
            }
            const average = sum / this.dataArray.length;
            this.micLevel = average;

            // Adjust Speed based on volume (Voice Activation)
            // Threshold ~ 10-20 to start moving
            if (this.micLevel > 15) {
                // Smooth acceleration
                this.scrollSpeed += 0.05;
                if (this.scrollSpeed > 2.5) this.scrollSpeed = 2.5;
            } else {
                // Deceleration (Friction)
                this.scrollSpeed *= 0.95;
                if (this.scrollSpeed < 0.1) this.scrollSpeed = 0;
            }

            this.updateScroll();
            this.updateVisuals();

            requestAnimationFrame(loop);
        };
        loop();
    }

    updateScroll() {
        const scrollContainer = document.getElementById('river-scroll');
        if (scrollContainer) {
            scrollContainer.scrollTop += this.scrollSpeed;

            // Check end
            if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 50) {
                // End of river
                if (!this.finished) {
                    this.finished = true;
                    this.showWin();
                }
            }
        }
    }

    updateVisuals() {
        // Update Raft animation/particles based on speed
        const raft = document.getElementById('raft-avatar');
        if (raft) {
            if (this.scrollSpeed > 1) {
                raft.classList.add('moving-fast');
                raft.style.transform = `scale(1.05) rotate(${Math.sin(Date.now() / 100) * 2}deg)`;
            } else {
                raft.classList.remove('moving-fast');
                raft.style.transform = `scale(1) rotate(${Math.sin(Date.now() / 500) * 1}deg)`;
            }
        }

        // Update Mic Orb
        const orb = document.getElementById('mic-orb');
        if (orb) {
            const scale = 1 + (this.micLevel / 100);
            orb.style.transform = `scale(${scale})`;
            orb.style.opacity = 0.5 + (this.micLevel / 200);
        }
    }

    render() {
        this.container.innerHTML = '';
        this.container.className = 'game-container river-theme';

        // 1. River Background setup in CSS

        // 2. Scroll Area (The River)
        const scrollArea = document.createElement('div');
        scrollArea.id = 'river-scroll';
        scrollArea.className = 'river-scroll-area';

        // Spacer top
        const spacerTop = document.createElement('div');
        spacerTop.style.height = '50vh';
        scrollArea.appendChild(spacerTop);

        // Lines
        this.lines.forEach((line, idx) => {
            const lineEl = document.createElement('div');
            lineEl.className = 'river-line';
            lineEl.innerText = line;
            scrollArea.appendChild(lineEl);
        });

        // Spacer bottom
        const spacerBottom = document.createElement('div');
        spacerBottom.style.height = '50vh';
        scrollArea.appendChild(spacerBottom);

        this.container.appendChild(scrollArea);

        // 3. The Raft (Fixed Overlay)
        const raft = document.createElement('div');
        raft.id = 'raft-avatar';
        raft.className = 'raft';
        raft.innerHTML = '🚣'; // Placeholder or Image
        this.container.appendChild(raft);

        // 4. Mic Indicator
        const orb = document.createElement('div');
        orb.id = 'mic-orb';
        orb.className = 'mic-orb';
        this.container.appendChild(orb);

        // Sidebar / Start Msg
        const hud = document.createElement('div');
        hud.className = 'game-hud';
        hud.innerHTML = '<p>¡Lee en voz alta para mover la balsa!</p>';
        this.container.appendChild(hud);
    }

    showWin() {
        // Call backend or existing flow
        const modal = document.createElement('div');
        modal.className = 'win-modal';
        modal.innerHTML = `
            <div class="win-content">
                <h2>🎉 ¡Llegaste a la meta!</h2>
                <button id="finishLevelBtn">Completar Nivel</button>
            </div>
        `;
        this.container.appendChild(modal);

        document.getElementById('finishLevelBtn').onclick = () => {
            // Find the "Completer Nivel" button from parent or trigger it
            // Try to click the hidden Complete button in demo-mechanics overlay
            const btn = document.querySelector('.btn-primary'); // The one we added in demo-mechanics
            if (btn && btn.innerText.includes('Completar')) {
                btn.click();
            } else {
                alert("¡Nivel Completado!");
            }
        };
    }
}

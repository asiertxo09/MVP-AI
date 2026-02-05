
import { GameEngine } from './GameEngine.js';

export class ComprehensionCavernsGame {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.engine = new GameEngine();
        this.story = {
            title: "El Secreto de la Cueva",
            text: [
                "Hace mucho tiempo, un pequeño dragón vivía en la montaña.", // 0
                "Le gustaba comer piedras brillantes de colores.",           // 1
                "Un día, encontró una piedra azul que brillaba como el cielo.", // 2
                "Pero la piedra estaba muy caliente y no podía tocarla."      // 3
            ],
            questions: [
                {
                    q: "¿Qué le gustaba comer al dragón?",
                    answers: [
                        { text: "Piedras brillantes", correct: true },
                        { text: "Fuego rojo", correct: false, clueIndex: 1 },
                        { text: "Hojas verdes", correct: false, clueIndex: 1 }
                    ]
                },
                {
                    q: "¿De qué color era la piedra especial?",
                    answers: [
                        { text: "Roja", correct: false, clueIndex: 2 },
                        { text: "Azul", correct: true },
                        { text: "Verde", correct: false, clueIndex: 2 }
                    ]
                }
            ]
        };
        this.currentQuestion = 0;
    }

    init() {
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        this.container.className = 'game-container cavern-theme';

        // 1. Story Scroll (Left)
        const scrollPanel = document.createElement('div');
        scrollPanel.className = 'story-scroll';

        const title = document.createElement('h2');
        title.innerText = this.story.title;
        scrollPanel.appendChild(title);

        this.story.text.forEach((sentence, idx) => {
            const p = document.createElement('p');
            p.innerText = sentence;
            p.id = `story-line-${idx}`;
            p.className = 'story-line';
            scrollPanel.appendChild(p);
        });

        this.container.appendChild(scrollPanel);

        // 2. The Cave (Right)
        const cavePanel = document.createElement('div');
        cavePanel.className = 'cave-panel';
        cavePanel.id = 'cave-panel';

        this.renderQuestion(cavePanel);

        this.container.appendChild(cavePanel);
    }

    renderQuestion(panel) {
        panel.innerHTML = '';

        if (this.currentQuestion >= this.story.questions.length) {
            this.showWin(panel);
            return;
        }

        const qData = this.story.questions[this.currentQuestion];

        const qText = document.createElement('div');
        qText.className = 'cave-question';
        qText.innerText = qData.q;
        panel.appendChild(qText);

        const torchContainer = document.createElement('div');
        torchContainer.className = 'torch-container';

        qData.answers.forEach(ans => {
            const torch = document.createElement('div');
            torch.className = 'torch-btn';
            torch.innerHTML = `
                <div class="torch-flame"></div>
                <div class="torch-stick"></div>
                <span class="torch-label">${ans.text}</span>
            `;
            torch.onclick = () => this.handleAnswer(ans, torch);
            torchContainer.appendChild(torch);
        });

        panel.appendChild(torchContainer);
    }

    handleAnswer(ans, btn) {
        if (ans.correct) {
            // Success
            btn.classList.add('lit');
            this.playDing();
            setTimeout(() => {
                this.currentQuestion++;
                this.renderQuestion(document.getElementById('cave-panel'));
            }, 1500);
        } else {
            // Fail - Spotlight Clue
            btn.classList.add('extinguished');
            this.playFizzle();

            if (ans.clueIndex !== undefined) {
                this.spotlightClue(ans.clueIndex);
            }
        }
    }

    spotlightClue(index) {
        // Dim everything
        document.querySelectorAll('.story-line').forEach(el => el.classList.add('dimmed'));

        // Highlight logic
        const target = document.getElementById(`story-line-${index}`);
        if (target) {
            target.classList.remove('dimmed');
            target.classList.add('spotlight');
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });

            setTimeout(() => {
                document.querySelectorAll('.story-line').forEach(el => {
                    el.classList.remove('dimmed');
                    el.classList.remove('spotlight');
                });
            }, 3000);
        }
    }

    showWin(panel) {
        panel.innerHTML = `
            <div class="cave-art-reveal">
                <div style="font-size:5rem;">🐲💎</div>
                <h3>¡Descubriste el secreto!</h3>
                <button id="finishCaveBtn" class="btn-primary-action">Salir de la Cueva</button>
            </div>
        `;
        document.getElementById('finishCaveBtn').onclick = () => {
            const btn = document.querySelector('button.btn-primary'); // The one we added in demo-mechanics
            if (btn && btn.innerText.includes('Completar')) {
                btn.click();
            } else {
                alert("¡Nivel Completado!");
            }
        };
    }

    playDing() {
        const audio = new Audio(); // Placeholder or synth
        // Synth
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    }

    playFizzle() {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const bufSize = ctx.sampleRate * 0.5;
        const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        noise.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
    }
}

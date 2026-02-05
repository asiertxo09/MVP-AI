
export class AccessibilityManager {
    constructor() {
        this.synth = window.speechSynthesis;
        this.isDyslexicMode = false;
        this.isRulerActive = false;
        this.rulerEl = null;

        this.init();
    }

    init() {
        // Prepare Font
        if (!document.getElementById('font-dyslexic')) {
            const link = document.createElement('link');
            link.id = 'font-dyslexic';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&display=swap'; // Fallback/Similar
            document.head.appendChild(link);
        }

        // Setup UI
        this.setupSettingsButton();
    }

    /* --- DYSLEXIA TOOLS --- */

    toggleDyslexiaMode() {
        this.isDyslexicMode = !this.isDyslexicMode;
        document.body.classList.toggle('dyslexic-mode', this.isDyslexicMode);
        document.body.classList.toggle('high-contrast', this.isDyslexicMode); // Optional combo

        return this.isDyslexicMode;
    }

    toggleReadingRuler() {
        this.isRulerActive = !this.isRulerActive;

        if (this.isRulerActive) {
            if (!this.rulerEl) {
                this.rulerEl = document.createElement('div');
                this.rulerEl.id = 'reading-ruler';
                this.rulerEl.className = 'reading-ruler';
                document.body.appendChild(this.rulerEl);

                document.addEventListener('mousemove', (e) => {
                    if (this.isRulerActive && this.rulerEl) {
                        this.rulerEl.style.top = `${e.clientY - 25}px`;
                    }
                });
            }
            this.rulerEl.style.display = 'block';
        } else {
            if (this.rulerEl) this.rulerEl.style.display = 'none';
        }

        return this.isRulerActive;
    }

    /* --- TTS & KARAOKE --- */

    speak(text, elementToHighlight = null) {
        if (this.synth.speaking) {
            this.synth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 0.9; // Slightly slower for kids

        // Karaoke Logic (Boundary Events)
        if (elementToHighlight) {
            // Split text into words to estimate position? 
            // Browser API 'onboundary' gives charIndex.

            // We need to wrap words in spans to highlight specific ones is complex 
            // without corrupting DOM. simpler approach: Highlight the whole block
            // or use specific data-attributes.

            // For MVP: Highlight the container.
            elementToHighlight.classList.add('tts-active');

            utterance.onend = () => {
                elementToHighlight.classList.remove('tts-active');
            };
        }

        this.synth.speak(utterance);
    }

    setupSettingsButton() {
        const btn = document.createElement('button');
        btn.innerText = "♿";
        btn.className = "accessibility-toggle-btn";
        btn.onclick = () => this.openSettingsModal();
        document.body.appendChild(btn);
    }

    openSettingsModal() {
        const modal = document.createElement('div');
        modal.className = 'accessibility-modal';

        modal.innerHTML = `
            <div class="acc-panel">
                <h3>Accesibilidad</h3>
                <div class="acc-row">
                    <label>Fuente Dislexia</label>
                    <button id="btn-dyslexia">${this.isDyslexicMode ? 'ON' : 'OFF'}</button>
                </div>
                <div class="acc-row">
                    <label>Regla de Lectura</label>
                    <button id="btn-ruler">${this.isRulerActive ? 'ON' : 'OFF'}</button>
                </div>
                <button class="close-btn">Cerrar</button>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#btn-dyslexia').onclick = (e) => {
            const state = this.toggleDyslexiaMode();
            e.target.innerText = state ? 'ON' : 'OFF';
            e.target.classList.toggle('active', state);
        };

        modal.querySelector('#btn-ruler').onclick = (e) => {
            const state = this.toggleReadingRuler();
            e.target.innerText = state ? 'ON' : 'OFF';
            e.target.classList.toggle('active', state);
        };

        modal.querySelector('.close-btn').onclick = () => modal.remove();
    }
}

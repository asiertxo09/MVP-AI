
export class PetSystem {
    constructor(containerId, initialEmotion = 'idle') {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.warn(`PetSystem: Container ${containerId} not found.`);
            return;
        }
        this.emotion = initialEmotion;
        this.timeoutId = null;

        // Base structure
        this.container.innerHTML = `
            <div class="pet-character">
                <div class="pet-body">
                    <div class="pet-face">
                        <div class="pet-eye left"></div>
                        <div class="pet-eye right"></div>
                        <div class="pet-mouth"></div>
                    </div>
                </div>
                <div class="pet-speech-bubble hidden"></div>
            </div>
        `;

        this.petEl = this.container.querySelector('.pet-character');
        this.bubbleEl = this.container.querySelector('.pet-speech-bubble');

        this.setEmotion('idle');
        this.setupIdleLoop();
    }

    setEmotion(emotion) {
        if (!this.petEl) return;

        // Clear previous classes
        this.petEl.classList.remove('idle', 'thinking', 'happy', 'sad', 'talking');
        this.petEl.classList.add(emotion);
        this.emotion = emotion;

        // Specific behaviors
        if (emotion === 'happy') {
            this.playSound('cheer');
        } else if (emotion === 'sad') {
            this.playSound('encourage');
        }
    }

    say(text, duration = 3000) {
        if (!this.bubbleEl) return;

        this.bubbleEl.innerText = text;
        this.bubbleEl.classList.remove('hidden');
        this.setEmotion('talking');

        if (this.timeoutId) clearTimeout(this.timeoutId);

        this.timeoutId = setTimeout(() => {
            this.bubbleEl.classList.add('hidden');
            this.setEmotion('idle');
        }, duration);
    }

    // React to user inactivity
    startThinkingWorker(timeout = 5000) {
        // Reset existing timer if any
        if (this.thinkTimer) clearTimeout(this.thinkTimer);

        this.thinkTimer = setTimeout(() => {
            if (this.emotion === 'idle') {
                this.setEmotion('thinking');
                this.say("¿Necesitas ayuda?");
            }
        }, timeout);
    }

    resetThinkingWorker() {
        if (this.emotion === 'thinking') this.setEmotion('idle');
        this.startThinkingWorker();
    }

    setupIdleLoop() {
        // Blink logic
        setInterval(() => {
            if (this.emotion === 'idle' || this.emotion === 'thinking') {
                this.petEl.classList.add('blink');
                setTimeout(() => this.petEl.classList.remove('blink'), 200);
            }
        }, 4000);
    }

    playSound(type) {
        // Placeholder sound
        // const audio = new Audio(`assets/sounds/${type}.mp3`);
        // audio.play().catch(e => {}); 
    }
}

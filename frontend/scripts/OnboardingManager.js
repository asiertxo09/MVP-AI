
export class OnboardingManager {
    constructor(petSystem) {
        this.pet = petSystem;
        this.currentScene = 'intro';
        this.avatarState = {
            archetype: 'explorer',
            hat: 0,
            color: 0
        };

        this.options = {
            hat: ['Sin Gorro', 'Gorra', 'Sombrero Mágico', 'Casco'],
            color: ['Azul', 'Rojo', 'Verde', 'Morado'],
            hatEmojis: ['', '🧢', '🎩', '⛑️'],
            colorCodes: ['#3498db', '#e74c3c', '#2ecc71', '#9b59b6']
        };

        this.initintro();
    }

    /* --- SCENE 1: THE CALL --- */
    initintro() {
        // 1. Fade out world
        setTimeout(() => {
            document.getElementById('forest-bg').classList.add('gray');
        }, 1000);

        // 2. Pet Appears
        setTimeout(() => {
            document.getElementById('guide-intro').classList.add('active');
            this.pet.setEmotion('sad');
            this.typeText("¡Oh no! todo se ha vuelto gris... ¡Las Palabras Mágicas han escapado!");
        }, 2500);

        // 3. CTA
        setTimeout(() => {
            this.pet.setEmotion('thinking');
            this.typeText("¿Me ayudas a encontrarlas para devolver el color?", () => {
                const btn = document.getElementById('btn-hero');
                btn.classList.remove('hidden');
                btn.onclick = () => this.startAdventure();
            });
        }, 6000);
    }

    typeText(text, callback) {
        const el = document.getElementById('guide-text');
        el.innerText = "";
        let i = 0;
        const interval = setInterval(() => {
            el.innerText += text[i];
            i++;
            if (i >= text.length) {
                clearInterval(interval);
                if (callback) callback();
            }
        }, 50);
    }

    async startAdventure() {
        // Backend Trigger (Simulated)
        // await fetch('/api/sessions/start', { method: 'POST' });

        this.pet.setEmotion('happy');
        this.pet.say("¡Gracias! ¡Sabía que podía contar contigo!", 2000);

        setTimeout(() => {
            this.transitionToAvatar();
        }, 2000);
    }

    /* --- SCENE 2: AVATAR --- */
    transitionToAvatar() {
        document.getElementById('scene-intro').classList.add('hidden');
        const avatarScene = document.getElementById('scene-avatar');
        avatarScene.classList.remove('hidden');
        avatarScene.classList.add('fade-in');

        this.setupAvatarListeners();
        this.updateAvatarPreview();
    }

    setupAvatarListeners() {
        // Archetypes
        document.querySelectorAll('.archetype-card').forEach(card => {
            card.onclick = () => {
                document.querySelectorAll('.archetype-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.avatarState.archetype = card.dataset.type;
                this.updateAvatarPreview();
            };
        });

        // Finish
        document.getElementById('btn-finish-avatar').onclick = () => this.finishOnboarding();
    }

    cycleOption(type, dir) {
        const len = this.options[type].length;
        let val = this.avatarState[type];
        val += dir;
        if (val < 0) val = len - 1;
        if (val >= len) val = 0;
        this.avatarState[type] = val;

        // Update Label
        document.getElementById(`lbl-${type}`).innerText = this.options[type][val];
        this.updateAvatarPreview();
    }

    updateAvatarPreview() {
        const preview = document.getElementById('avatar-preview');
        const base = preview.querySelector('.avatar-base');

        // Color
        const color = this.options.colorCodes[this.avatarState.color];
        preview.style.backgroundColor = color;
        // Ideally we tint the character, but bg is easier for MVP preview

        // Hat (Emoji Overlay)
        const hatEmoji = this.options.hatEmojis[this.avatarState.hat];

        // Build Avatar HTML
        // Simple Emoji Composition
        let baseEmoji = '😐';
        if (this.avatarState.archetype === 'explorer') baseEmoji = '🤠';
        else if (this.avatarState.archetype === 'wizard') baseEmoji = '🧙';
        else if (this.avatarState.archetype === 'ranger') baseEmoji = '🧝';

        base.innerHTML = `
            <div style="position: relative;">
                <span>${baseEmoji}</span>
                <span style="position: absolute; top: -40px; left: 0;">${hatEmoji}</span>
            </div>
        `;
    }

    finishOnboarding() {
        // Save Profile
        const profile = {
            ...this.avatarState,
            completedOnboarding: true
        };
        localStorage.setItem('eduplay_avatar', JSON.stringify(profile));

        // Redirect
        window.location.href = 'kingdoms.html?child_token=guest'; // guest for demo
    }
}

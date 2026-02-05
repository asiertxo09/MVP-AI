
export class PhonemeForestGame {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.score = 0;
        this.maxScore = 3;
        this.lanterns = []; // Targets
        this.fireflies = []; // Draggables
        this.draggedElement = null;
        this.audioCtx = null;
    }

    async init() {
        this.container.innerHTML = '<div class="loading">🌲 Cargando el Bosque...</div>';
        await new Promise(r => setTimeout(r, 500)); // Sim delay

        // Mock Data for now (Later fetch from API)
        this.levelData = {
            targetPhoneme: 'M',
            distractors: ['P', 'T'],
            words: [
                { id: 'f1', word: 'Mamá', phoneme: 'M', isTarget: true },
                { id: 'f2', word: 'Mesa', phoneme: 'M', isTarget: true },
                { id: 'f3', word: 'Pato', phoneme: 'P', isTarget: false },
                { id: 'f4', word: 'Taza', phoneme: 'T', isTarget: false }
            ]
        };

        this.render();
        this.initAudio();
    }

    initAudio() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playTone(freq, type = 'sine') {
        if (!this.audioCtx) this.initAudio();
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.5);
        osc.stop(this.audioCtx.currentTime + 0.5);
    }

    render() {
        this.container.innerHTML = '';
        this.container.className = 'game-container forest-theme';

        // 1. Lanterns (Targets)
        const lanternContainer = document.createElement('div');
        lanternContainer.className = 'lantern-row';

        // We need buckets for the phonemes. 
        // For simplicity in this level, we have 1 Target Lantern (M) and maybe 1 Distractor Lantern (Others)?
        // Or just Match "M" Fireflies to the "M" Lantern.

        const targetLantern = document.createElement('div');
        targetLantern.className = 'lantern';
        targetLantern.dataset.phoneme = this.levelData.targetPhoneme;
        targetLantern.innerHTML = `
            <div class="lantern-glow"></div>
            <div class="lantern-label">${this.levelData.targetPhoneme}</div>
        `;
        lanternContainer.appendChild(targetLantern);
        this.lanterns.push(targetLantern);
        this.container.appendChild(lanternContainer);

        // 2. Fireflies (Draggables)
        const fireflyContainer = document.createElement('div');
        fireflyContainer.className = 'firefly-field';

        this.levelData.words.forEach(wordObj => {
            const firefly = document.createElement('div');
            firefly.className = 'firefly';
            firefly.dataset.id = wordObj.id;
            firefly.dataset.phoneme = wordObj.phoneme;
            firefly.draggable = true; // Use Touch/Mouse logic instead of HTML5 Drag for better control?

            firefly.innerHTML = `
                <div class="firefly-wings"></div>
                <div class="firefly-body"></div>
                <span class="firefly-word" style="display:none">${wordObj.word}</span> 
            `;

            // Random position
            firefly.style.left = `${Math.random() * 60 + 20}%`;
            firefly.style.top = `${Math.random() * 40 + 50}%`;

            this.addDragEvents(firefly);
            fireflyContainer.appendChild(firefly);
            this.fireflies.push(firefly);
        });

        this.container.appendChild(fireflyContainer);

        // Instructions
        const hud = document.createElement('div');
        hud.className = 'game-hud';
        hud.innerHTML = `<p>Arrastra las luciérnagas <strong>/${this.levelData.targetPhoneme}/</strong> a la linterna.</p>`;
        this.container.appendChild(hud);
    }

    addDragEvents(el) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        const start = (e) => {
            if (el.classList.contains('matched')) return;
            isDragging = true;
            el.classList.add('dragging');
            // Play sound
            this.playTone(440); // A4

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            startX = clientX;
            startY = clientY;

            const rect = el.getBoundingClientRect();
            const parentRect = this.container.getBoundingClientRect();

            initialLeft = el.offsetLeft;
            initialTop = el.offsetTop;

            e.preventDefault(); // Prevent scroll
        };

        const move = (e) => {
            if (!isDragging) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            const dx = clientX - startX;
            const dy = clientY - startY;

            el.style.left = `${initialLeft + dx}px`;
            el.style.top = `${initialTop + dy}px`;

            this.checkHover(el);
        };

        const end = () => {
            if (!isDragging) return;
            isDragging = false;
            el.classList.remove('dragging');

            if (this.checkDrop(el)) {
                // Success
                this.handleMatch(el);
            } else {
                // Return to start (optional physics)
                el.style.transition = 'all 0.5s ease-out';
                el.style.left = `${initialLeft}px`;
                el.style.top = `${initialTop}px`;
                setTimeout(() => { el.style.transition = ''; }, 500);
            }
        };

        el.addEventListener('mousedown', start);
        el.addEventListener('touchstart', start, { passive: false });

        window.addEventListener('mousemove', move);
        window.addEventListener('touchmove', move, { passive: false });

        window.addEventListener('mouseup', end);
        window.addEventListener('touchend', end);
    }

    checkHover(el) {
        // Simple AABB check with Lantern
        const r1 = el.getBoundingClientRect();
        const lantern = this.lanterns[0];
        const r2 = lantern.getBoundingClientRect();

        const overlap = !(r1.right < r2.left ||
            r1.left > r2.right ||
            r1.bottom < r2.top ||
            r1.top > r2.bottom);

        if (overlap) {
            lantern.classList.add('hover-active');
        } else {
            lantern.classList.remove('hover-active');
        }
    }

    checkDrop(el) {
        const lantern = this.lanterns[0];
        if (lantern.classList.contains('hover-active')) {
            lantern.classList.remove('hover-active');
            // Check logic
            const targetPhoneme = lantern.dataset.phoneme;
            const draggedPhoneme = el.dataset.phoneme;
            return targetPhoneme === draggedPhoneme;
        }
        return false;
    }

    handleMatch(el) {
        // Snap to center of lantern
        const lantern = this.lanterns[0];
        // Visual snap would be complex with CSS transforms, 
        // just fade it out or attach it.

        el.classList.add('matched');
        this.playTone(880, 'triangle'); // High ding

        // Particle burst (Simulate)
        // ...

        // Remove
        setTimeout(() => el.remove(), 500);

        this.score++;

        // Check win
        const remainingTargets = this.fireflies.filter(f => !f.classList.contains('matched') && f.dataset.phoneme === this.levelData.targetPhoneme);
        if (remainingTargets.length === 1) { // 1 because we haven't removed the current one yet from DOM fully, but class is set
            // Actually filter by class
        }

        // Better check:
        const targets = this.levelData.words.filter(w => w.isTarget).length;
        if (this.score >= targets) {
            this.showWin();
        }
    }

    showWin() {
        const modal = document.createElement('div');
        modal.className = 'win-modal';
        modal.innerHTML = `
            <div class="win-content">
                <h2>🌟 ¡Bosque Iluminado!</h2>
                <button id="nextLevelBtn">Siguiente Nivel</button>
            </div>
        `;
        this.container.appendChild(modal);

        document.getElementById('nextLevelBtn').onclick = () => {
            // Find the "Completer Nivel" button from parent or trigger it
            // For now just alert
            alert("¡Nivel Completado!");
            // Try to click the hidden Complete button in demo-mechanics if it exists
            // Or we expose a callback
        };
    }
}

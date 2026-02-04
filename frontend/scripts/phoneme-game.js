// =========================================================
// Phoneme Hunt Game Logic
// =========================================================

// API Configuration
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocal
    ? 'http://localhost:5001/api/generate'
    : 'https://eduplay-backend.onrender.com/api/generate';

// Audio Context for synthesized sounds
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

// Play a "Ding" sound (success)
export function playDing() {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
}

// Play a "Boing" sound (error)
export function playBoing() {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
}

// Vibrate (if supported)
export function vibrate() {
    if (navigator.vibrate) {
        navigator.vibrate(100);
    }
}

// Helper: Get user's weak phonemes from metrics
async function getPhonemePerformance() {
    try {
        const res = await fetch('/api/metrics?type=activities&days=30');
        if (!res.ok) return [];
        const data = await res.json();
        const activities = data.activities || [];

        // Filter for phoneme_hunt and calculate failures
        const mistakes = {};

        activities
            .filter(a => a.activity_type === 'phoneme_hunt' && a.is_correct === 0)
            .forEach(a => {
                let phoneme = null;
                // Parse challenge data safely
                try {
                    const challenge = typeof a.challenge_data === 'string' ? JSON.parse(a.challenge_data) : a.challenge_data;
                    phoneme = challenge?.phoneme;
                } catch (e) { }

                if (phoneme) {
                    mistakes[phoneme] = (mistakes[phoneme] || 0) + 1;
                }
            });

        // Return sorted list of phonemes by mistake count (descending)
        return Object.entries(mistakes)
            .sort(([, a], [, b]) => b - a)
            .map(([phoneme]) => phoneme);
    } catch (e) {
        console.warn('Error fetching metrics', e);
        return [];
    }
}

// Fetch game data from AI backend (New Endpoint)
async function fetchGameDataFromAI(forcePhoneme = null, mistakes = []) {
    try {
        const payload = {
            gameType: 'phoneme',
            difficulty: 'easy',
            limit: 4, // 3 correct + 1 distractor
            performance_context: {
                mistakes: mistakes
            }
        };

        if (forcePhoneme) {
            payload.target = forcePhoneme;
        }

        const res = await fetch(API_URL.replace('/api/generate', '/api/generate-levels'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('API error');
        const data = await res.json();

        // Transform backend format to game format if needed
        // Backend returns: { levels: [{ word, icon, isTarget }] }
        // We need: { targetPhoneme, correctWords, distractor } 
        // OR better: adapt the game to use the new list structure directly.

        // Let's adapt the response to match what the 'init' function expects for now,
        // OR better yet, let's just return the list and let init handle it.
        return data.levels;

    } catch (e) {
        console.warn('AI fetch error, using fallback', e);
        return null;
    }
}

// Main Game Controller
export class PhonemeHuntGame {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.targetPhoneme = 'R';
        this.items = [];
        this.score = 0;
        this.correctCount = 0;
    }

    async init(forcePhoneme = null) {
        this.container.innerHTML = '<p class="loading">🧠 Analizando tu progreso...</p>';

        // 1. Get weak phonemes
        const weakPhonemes = await getPhonemePerformance();
        console.log('Detected weak phonemes:', weakPhonemes);

        // 2. Fetch Level
        this.container.innerHTML = '<p class="loading">✨ Creando ejercicio personalizado...</p>';
        const levels = await fetchGameDataFromAI(forcePhoneme, weakPhonemes);

        if (levels && levels.length > 0) {
            this.items = levels.map(item => ({
                word: item.word,
                isCorrect: item.isTarget
            }));

            // Determine target phoneme from the correct items (first char of first correct word)
            const firstCorrect = this.items.find(i => i.isCorrect);
            if (firstCorrect) {
                this.targetPhoneme = firstCorrect.word.charAt(0).toUpperCase();
            }
        } else {
            // FALLBACK
            this.targetPhoneme = forcePhoneme || (weakPhonemes[0] || 'R');
            const data = getFallbackData(this.targetPhoneme);
            this.items = [
                ...data.correctWords.map(w => ({ word: w, isCorrect: true })),
                { word: data.distractor, isCorrect: false }
            ];
            // Shuffle
            this.items = this.items.sort(() => Math.random() - 0.5);
        }

        this.render();
    }

    render() {
        this.container.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.className = 'game-header';
        header.innerHTML = `
            <h2>🎯 Caza-Fonemas</h2>
            <p>Toca los objetos que empiezan con el sonido <strong>/${this.targetPhoneme}/</strong></p>
            <div class="score-display">Aciertos: <span id="score">${this.correctCount}</span> / ${this.items.filter(i => i.isCorrect).length}</div>
        `;

        // Grid
        const grid = document.createElement('div');
        grid.className = 'phoneme-grid';

        this.items.forEach((item, idx) => {
            const card = document.createElement('div');
            card.className = 'phoneme-card';
            card.dataset.index = idx;
            card.innerHTML = `
                <img src="${getAssetForWord(item.word)}" alt="${item.word}">
                <span class="card-label">${item.word}</span>
            `;
            card.onclick = () => this.handleClick(item, card);
            grid.appendChild(card);
        });

        // Back Button
        const backBtn = document.createElement('button');
        backBtn.className = 'back-btn';
        backBtn.textContent = '← Volver al Mapa';
        backBtn.onclick = () => window.location.href = 'index.html';

        this.container.appendChild(header);
        this.container.appendChild(grid);
        this.container.appendChild(backBtn);
    }

    handleClick(item, cardElement) {
        if (cardElement.classList.contains('disabled')) return;

        if (item.isCorrect) {
            playDing();
            cardElement.classList.add('correct', 'disabled');
            this.correctCount++;
            document.getElementById('score').textContent = this.correctCount;

            // Check win condition
            if (this.correctCount === this.items.filter(i => i.isCorrect).length) {
                setTimeout(() => this.showWin(), 500);
            }
        } else {
            playBoing();
            vibrate();
            cardElement.classList.add('wrong');
            setTimeout(() => cardElement.classList.remove('wrong'), 400);
        }
    }

    async showWin() {
        // Report success to backend
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            const childToken = sessionStorage.getItem('child_session_token');
            if (childToken) {
                headers['Authorization'] = `Bearer ${childToken}`;
            }

            await fetch('/api/metrics', {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify({
                    activityType: 'phoneme_hunt',
                    activityName: `Caza-Fonemas /${this.targetPhoneme}/`,
                    starsEarned: 5,
                    energyChange: 2,
                    isCorrect: true,
                    challengeData: { phoneme: this.targetPhoneme },
                    userResponse: { completed: true },
                    metadata: {
                        timestamp: Date.now(),
                        correctCount: this.correctCount
                    }
                })
            });
        } catch (e) {
            console.warn('Error saving metrics', e);
        }

        const modal = document.createElement('div');
        modal.className = 'win-modal';
        modal.innerHTML = `
            <div class="win-content">
                <h2>🎉 ¡Excelente!</h2>
                <p>Encontraste todos los objetos con /${this.targetPhoneme}/</p>
                <button onclick="location.reload()">Jugar de Nuevo</button>
                <button onclick="window.location.href='index.html'">Volver al Mapa</button>
            </div>
        `;
        this.container.appendChild(modal);
    }
}

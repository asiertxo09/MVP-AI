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

// Fetch game data from AI backend
async function fetchGameDataFromAI(phoneme) {
    const prompt = `Eres un tutor de fonética. Dame exactamente 3 palabras en español que empiecen con el sonido "${phoneme}" y 1 palabra distractora que NO empiece con ese sonido.
Responde SOLO en formato JSON así:
{
  "targetPhoneme": "${phoneme}",
  "correctWords": ["palabra1", "palabra2", "palabra3"],
  "distractor": "palabra_distractora"
}
Usa palabras simples de objetos o animales que se puedan representar con imágenes.`;

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        return JSON.parse(data.text);
    } catch (e) {
        console.warn('AI fetch error, using fallback', e);
        return null;
    }
}

// Fallback data for demo
function getFallbackData(phoneme) {
    const fallbacks = {
        'R': {
            targetPhoneme: 'R',
            correctWords: ['rana', 'rosa', 'roca'],
            distractor: 'gato'
        },
        'S': {
            targetPhoneme: 'S',
            correctWords: ['sol', 'silla', 'sapo'],
            distractor: 'perro'
        },
        'M': {
            targetPhoneme: 'M',
            correctWords: ['mano', 'mesa', 'mono'],
            distractor: 'flor'
        }
    };
    return fallbacks[phoneme.toUpperCase()] || fallbacks['R'];
}

// Map words to available assets (best effort)
const wordToAsset = {
    'rana': '../assets/gamification/animal_frog.png',
    'gato': '../assets/gamification/animal_cat.png',
    'rosa': '../assets/gamification/flower_rose.png',
    'roca': '../assets/gamification/object_rock.png',
    // Fallback for unknown words
    'default': '../assets/gamification/map_node_locked.png'
};

function getAssetForWord(word) {
    return wordToAsset[word.toLowerCase()] || wordToAsset['default'];
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

    async init(phoneme = 'R') {
        this.targetPhoneme = phoneme.toUpperCase();
        this.container.innerHTML = '<p class="loading">🧠 Cargando ejercicio con IA...</p>';

        // Try AI, fallback if fails
        let data = await fetchGameDataFromAI(this.targetPhoneme);
        if (!data) {
            data = getFallbackData(this.targetPhoneme);
        }

        // Build items array
        this.items = [
            ...data.correctWords.map(w => ({ word: w, isCorrect: true })),
            { word: data.distractor, isCorrect: false }
        ];

        // Shuffle
        this.items = this.items.sort(() => Math.random() - 0.5);

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

    showWin() {
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

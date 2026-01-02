import { requireSession, initLogoutButton } from "./auth.js";
import { GameManager } from "./game-manager.js";

// --- Game State & Configuration ---
const LEVELS = [
    { id: 1, type: 'phoneme_hunt', title: 'Caza-Fonemas', desc: '¡Encuentra las palabras con R!', icon: 'frog.svg' },
    { id: 2, type: 'math', title: 'Bosque de Números', desc: 'Resuelve sumas para cruzar el bosque.', icon: 'icon-frog.svg' },
    { id: 3, type: 'reading', title: 'Cueva de Letras', desc: 'Encuentra las palabras escondidas.', icon: 'icon-frog.svg' },
    { id: 4, type: 'speaking', title: 'Montaña del Eco', desc: 'Pronuncia las palabras mágicas.', icon: 'icon-frog.svg' },
    { id: 5, type: 'boss', title: 'Castillo del Sabio', desc: 'Demuestra todo lo que aprendiste.', icon: 'icon-frog.svg' }
];

const STATE = {
    currentLevel: 1, // Set to 1 to test Phoneme Hunt immediately
    streak: 5,
    coins: 120,
    completedLevels: []
};

// --- Elements ---
const pathContainer = document.getElementById('pathContainer');
const activityModal = document.getElementById('activityModal');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const btnPlay = document.getElementById('btnPlay');
const closeModal = document.getElementById('closeModal');
const streakValue = document.getElementById('streakValue');
const coinValue = document.getElementById('coinValue');

const gameManager = new GameManager('gameStage');

// --- Initialization ---
function init() {
    requireSession(); // Ensure user is logged in
    renderHUD();
    renderMap();
    setupListeners();
}

function renderHUD() {
    streakValue.textContent = `${STATE.streak} Días`;
    coinValue.textContent = `${STATE.coins}`;
}

function renderMap() {
    const existingNodes = pathContainer.querySelectorAll('.node');
    existingNodes.forEach(n => n.remove());

    LEVELS.forEach((level, index) => {
        const node = document.createElement('div');
        node.className = 'node';

        // Determine Status
        let status = 'locked';
        if (STATE.completedLevels.includes(level.id)) {
            status = 'completed';
        } else if (level.id === STATE.currentLevel) {
            status = 'current';
        }

        node.classList.add(status);
        node.dataset.id = level.id;

        // Content
        const img = document.createElement('img');
        if (status === 'completed') {
            img.src = '../assets/icons/icon-check.svg';
        } else if (status === 'locked') {
            img.src = '../assets/icons/icon-lock.svg';
        } else {
            // Check if icon exists in both paths or assume specific logic
            // For now, assume if it doesn't start with icon-, it's one of ours
            img.src = `../assets/icons/${level.icon}`;
        }

        node.appendChild(img);

        // Click Event
        node.addEventListener('click', () => handleNodeClick(level, status, node));

        pathContainer.appendChild(node);
    });
}

function handleNodeClick(level, status, nodeElement) {
    if (status === 'locked') {
        nodeElement.classList.add('shake');
        setTimeout(() => nodeElement.classList.remove('shake'), 500);
        return;
    }

    if (status === 'completed') {
        openModal(level, true);
        return;
    }

    if (status === 'current') {
        openModal(level, false);
    }
}

function openModal(level, isReplay) {
    modalTitle.textContent = level.title;
    modalDesc.textContent = isReplay ? "¡Ya completaste esto! ¿Jugar de nuevo?" : level.desc;

    activityModal.classList.remove('active');
    void activityModal.offsetWidth;
    activityModal.classList.add('active');

    btnPlay.onclick = () => {
        // Start Game
        console.log(`Starting level ${level.id}: ${level.type}`);
        activityModal.classList.remove('active');

        // Launch specific game
        // Ideally mapping level.type to gameId
        // For now, we only implemented 'phoneme_hunt'
        if (level.type === 'phoneme_hunt') {
            gameManager.startGame('phoneme_hunt');
        } else {
            alert("Juego no implementado aún: " + level.type);
        }
    };
}

function setupListeners() {
    closeModal.addEventListener('click', () => {
        activityModal.classList.remove('active');
    });

    activityModal.addEventListener('click', (e) => {
        if (e.target === activityModal) {
            activityModal.classList.remove('active');
        }
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);

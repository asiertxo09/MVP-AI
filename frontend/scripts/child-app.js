import { requireSession, initLogoutButton } from "./auth.js";

// --- Game State & Configuration ---
const LEVELS = [
    { id: 1, type: 'start', title: 'Inicio del Viaje', desc: '¡Comienza tu aventura!', icon: 'icon-frog.svg' },
    { id: 2, type: 'math', title: 'Bosque de Números', desc: 'Resuelve sumas para cruzar el bosque.', icon: 'icon-frog.svg' }, // Using frog as placeholder for now or specific icon
    { id: 3, type: 'reading', title: 'Cueva de Letras', desc: 'Encuentra las palabras escondidas.', icon: 'icon-frog.svg' },
    { id: 4, type: 'speaking', title: 'Montaña del Eco', desc: 'Pronuncia las palabras mágicas.', icon: 'icon-frog.svg' },
    { id: 5, type: 'boss', title: 'Castillo del Sabio', desc: 'Demuestra todo lo que aprendiste.', icon: 'icon-frog.svg' }
];

const STATE = {
    currentLevel: 2, // 0-based index? No, let's use ID. So level 2 is current.
    streak: 5,
    coins: 120,
    completedLevels: [1]
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
    // Keep the background, clear nodes
    // Actually, path-bg is static. We append nodes.
    // We need to clear existing nodes if re-rendering, but let's assume static container structure for now.
    // The path-bg is already there. We just append nodes.

    // Clear previous nodes if any (preserving the bg)
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
            // Current or just icon
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
        // Shake animation
        nodeElement.classList.add('shake');
        setTimeout(() => nodeElement.classList.remove('shake'), 500);
        return;
    }

    if (status === 'completed') {
        // Replay? For now just show modal as replay
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

    // Reset animation state
    activityModal.classList.remove('active');
    // Force reflow
    void activityModal.offsetWidth;
    activityModal.classList.add('active');

    btnPlay.onclick = () => {
        // Navigate to actual game logic or load game
        console.log(`Starting level ${level.id}: ${level.type}`);
        // Here we would swap the screen to the game interface
        // For now, let's simulate completion after a delay or alert
        alert("¡Cargando actividad...!");
    };
}

function setupListeners() {
    closeModal.addEventListener('click', () => {
        activityModal.classList.remove('active');
    });

    // Close on click outside
    activityModal.addEventListener('click', (e) => {
        if (e.target === activityModal) {
            activityModal.classList.remove('active');
        }
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);

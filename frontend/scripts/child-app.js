import { requireSession, initLogoutButton } from "./auth.js";
import { GameManager } from "./game-manager.js";
import { GameEngine } from "./GameEngine.js";

const engine = new GameEngine();
// engine.init is async now, but since it's at top level, we might want to wrap init in an async function
// or just call it and let it run. But for UI rendering it should be fine.
engine.init().then(() => console.log("Engine initialized with profile"));

// --- Game State & Configuration ---
const LEVELS = [
    { id: 1, type: 'phoneme_hunt', title: 'Caza-Fonemas', desc: '¡Encuentra las palabras con R!', icon: 'frog.svg' },
    { id: 2, type: 'math', title: 'Bosque de Números', desc: 'Resuelve sumas para cruzar el bosque.', icon: 'icon-frog.svg' },
    { id: 3, type: 'dictation', title: 'Dojo de Escritura', desc: 'Escucha y escribe la palabra correcta.', icon: 'icon-frog.svg' },
    { id: 4, type: 'speaking', title: 'Montaña del Eco', desc: 'Habla con la montaña mágica.', icon: 'icon-frog.svg' }
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

const gameManager = new GameManager('gameStage', engine);

// --- Initialization ---
function init() {
    // Check for child token in URL (from dashboard-parent playAsChild)
    const urlParams = new URLSearchParams(window.location.search);
    let childToken = urlParams.get('child_token');
    let childId = urlParams.get('child_id');

    // If not in URL, check sessionStorage (reload case)
    if (!childToken) {
        childToken = sessionStorage.getItem('child_session_token');
    }
    if (!childId) {
        childId = sessionStorage.getItem('eduplay_child_id');
    }

    if (childToken) {
        sessionStorage.setItem('child_session_token', childToken);
        if (childId) sessionStorage.setItem('eduplay_child_id', childId);

        localStorage.setItem('eduplay_session', 'active');

        // Clean URL if it was there
        if (urlParams.get('child_token')) {
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        }
    }

    requireSession(); // Ensure user is logged in

    // Session Isolation: specific to child ID if available, else token hash
    let storageKey;
    if (childId) {
        storageKey = `eduplay_completed_levels_${childId}`;
    } else {
        const tokenHash = childToken ? simpleHash(childToken) : 'guest';
        storageKey = `eduplay_completed_levels_${tokenHash}`;
    }

    STATE.storageKey = storageKey; // Store key for saving

    // Load progress
    const savedLevels = localStorage.getItem(storageKey);
    if (savedLevels) {
        STATE.completedLevels = JSON.parse(savedLevels);
    } else {
        STATE.completedLevels = [];
    }

    // Determine current level
    if (STATE.completedLevels.length > 0) {
        const maxCompleted = Math.max(...STATE.completedLevels);
        STATE.currentLevel = maxCompleted + 1;
    } else {
        STATE.currentLevel = 1;
    }

    renderHUD();
    renderMap();
    setupListeners();
}

// Simple string hash function
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}

function renderHUD() {
    streakValue.textContent = `${STATE.streak} Días`;
    coinValue.textContent = `${STATE.coins}`;

    // Add Parent Zone Button if not exists
    if (!document.getElementById('btnParentZone')) {
        const hudLeft = document.querySelector('.hud-left');
        const btnParent = document.createElement('button');
        btnParent.id = 'btnParentZone';
        btnParent.innerText = 'Padres';
        btnParent.className = 'btn-parent-zone'; // Add styles later or inline
        btnParent.style.marginLeft = '10px';
        btnParent.style.padding = '5px 10px';
        btnParent.style.backgroundColor = '#6c5ce7';
        btnParent.style.color = 'white';
        btnParent.style.border = 'none';
        btnParent.style.borderRadius = '5px';
        btnParent.style.cursor = 'pointer';

        btnParent.onclick = () => {
            engine.requestParentAccess((success) => {
                if (success) {
                    window.location.href = '/dashboard-parent';
                }
            });
        };

        hudLeft.appendChild(btnParent);
    }
}

function renderMap() {
    pathContainer.innerHTML = ''; // Clear existing

    // Check for Free Play Mode (All 4 levels completed)
    const allCompleted = LEVELS.every(l => STATE.completedLevels.includes(l.id));

    if (allCompleted) {
        renderFreePlayMode();
        return;
    }

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
            img.src = `../assets/icons/${level.icon}`;
        }

        node.appendChild(img);

        // Click Event
        node.addEventListener('click', () => handleNodeClick(level, status, node));

        pathContainer.appendChild(node);
    });
}

function renderFreePlayMode() {
    const container = document.createElement('div');
    container.className = 'free-play-container';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(2, 1fr)';
    container.style.gap = '20px';
    container.style.width = '100%';
    container.style.padding = '20px';

    const header = document.createElement('h2');
    header.innerText = "¡Juego Libre!";
    header.style.gridColumn = '1 / -1';
    header.style.textAlign = 'center';
    header.style.color = 'var(--color-primary)';
    container.appendChild(header);

    const games = [
        { id: 'phoneme', name: 'Fonemas', type: 'phoneme_hunt', color: '#ff7675' },
        { id: 'math', name: 'Números', type: 'math', color: '#74b9ff' },
        { id: 'dictation', name: 'Escritura', type: 'dictation', color: '#a29bfe' },
        { id: 'speaking', name: 'Hablar', type: 'speaking', color: '#55efc4' }
    ];

    games.forEach(g => {
        const btn = document.createElement('button');
        btn.innerText = g.name;
        btn.style.padding = '30px';
        btn.style.fontSize = '1.5rem';
        btn.style.borderRadius = '15px';
        btn.style.border = 'none';
        btn.style.backgroundColor = g.color;
        btn.style.color = 'white';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 5px 0 rgba(0,0,0,0.1)';
        btn.style.transition = 'transform 0.1s';

        btn.onmousedown = () => btn.style.transform = 'scale(0.95)';
        btn.onmouseup = () => btn.style.transform = 'scale(1)';

        btn.onclick = () => {
            // Launch game directly without modal or callback (free play doesn't need to unlock anything)
            if (g.type === 'phoneme_hunt') gameManager.startGame('phoneme_hunt');
            else if (g.type === 'math') gameManager.startGame('speed_math');
            else if (g.type === 'dictation') gameManager.startGame('dictation_dojo');
            else if (g.type === 'speaking') gameManager.startGame('speaking_dojo');
        };

        container.appendChild(btn);
    });

    pathContainer.appendChild(container);
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

        const onLevelComplete = () => {
            console.log(`Level ${level.id} completed!`);
            if (!STATE.completedLevels.includes(level.id)) {
                STATE.completedLevels.push(level.id);
                // Save to user-specific key
                localStorage.setItem(STATE.storageKey, JSON.stringify(STATE.completedLevels));

                // Advance current level
                if (level.id === STATE.currentLevel) {
                    STATE.currentLevel = level.id + 1;
                }

                // Refresh map
                renderMap();

                // Update coins/streak in UI (mock update)
                STATE.coins += 50;
                renderHUD();
            }
        };

        // Launch specific game
        // Ideally mapping level.type to gameId
        // For now, we only implemented 'phoneme_hunt'
        if (level.type === 'phoneme_hunt') {
            gameManager.startGame('phoneme_hunt', onLevelComplete);
        } else if (level.type === 'math') {
            gameManager.startGame('speed_math', onLevelComplete);
        } else if (level.type === 'dictation') {
            gameManager.startGame('dictation_dojo', onLevelComplete);
        } else if (level.type === 'speaking') {
            gameManager.startGame('speaking_dojo', onLevelComplete);
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

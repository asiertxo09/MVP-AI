// Game Configuration Data
const GAMES_DATA = {
    phoneme_hunt: {
        id: 'phoneme_hunt',
        type: 'phoneme_hunt',
        instruction: 'Toca las palabras que tienen la letra <span class="highlight-text">R</span>',
        targetPhoneme: 'r',
        levels: [
            {
                id: 1,
                cards: [
                    { id: 'c1', word: 'Rana', icon: 'frog', isTarget: true },
                    { id: 'c2', word: 'Gato', icon: 'cat', isTarget: false },
                    { id: 'c3', word: 'Rosa', icon: 'rose', isTarget: true },
                    { id: 'c4', word: 'Roca', icon: 'rock', isTarget: true },
                    { id: 'c5', word: 'Sol', icon: 'sun', isTarget: false }
                ]
            }
        ]
    },
    speed_math: {
        id: 'speed_math',
        type: 'math',
        instruction: '¡Calcula Rápido!',
        levels: [
            { id: 1, q: '5 + 3', a: 8 },
            { id: 2, q: '2 + 4', a: 6 },
            { id: 3, q: '10 - 2', a: 8 },
            { id: 4, q: '7 + 2', a: 9 },
            { id: 5, q: '12 - 4', a: 8 }
        ]
    },
    dictation_dojo: {
        id: 'dictation_dojo',
        type: 'dictation',
        instruction: 'Escucha y Escribe',
        levels: [
            { id: 1, word: 'Rana', icon: 'frog' },
            { id: 2, word: 'Gato', icon: 'cat' },
            { id: 3, word: 'Sol', icon: 'sun' },
            { id: 4, word: 'Arbol', icon: 'tree' },
            { id: 5, word: 'Flor', icon: 'rose' }
        ]
    }
};

import { AssetFactory } from './SvgFactory.js';

export class GameManager {
    constructor(containerId, engine) {
        this.container = document.getElementById(containerId);
        this.engine = engine; // Reference to GameEngine for reporting
        this.state = {
            gameId: null,
            currentLevelIndex: 0,
            score: 0,
            mistakes: 0,
            selectedCards: new Set(),
            isCompleted: false
        };

        // Bind methods
        this.handleCardClick = this.handleCardClick.bind(this);
        this.checkAnswers = this.checkAnswers.bind(this);
        this.closeGame = this.closeGame.bind(this);
        this.handleMathInput = this.handleMathInput.bind(this);
        this.handleDictationInput = this.handleDictationInput.bind(this);
        this.speakWord = this.speakWord.bind(this);
    }

    startGame(gameId) {
        const gameConfig = GAMES_DATA[gameId];
        if (!gameConfig) {
            console.error('Game not found:', gameId);
            return;
        }

        this.state = {
            gameId: gameId,
            currentLevelIndex: 0,
            score: 0,
            mistakes: 0,
            selectedCards: new Set(),
            isCompleted: false,
            // Math specific
            mathInput: ''
        };

        this.currentGameConfig = gameConfig;

        if (this.currentGameConfig.type === 'math') {
            this.renderMathGameStage();
        } else if (this.currentGameConfig.type === 'dictation') {
            this.renderDictationGameStage();
        } else {
            this.renderGameStage();
        }

        this.loadLevel(0);

        // Show container
        this.container.classList.add('active');
    }

    renderGameStage() {
        this.container.innerHTML = `
            <div class="game-header">
                <div class="progress-bar-container" id="progressBar">
                    <!-- Segments injected here -->
                </div>
                <button class="btn-close-game" id="btnCloseGame">X</button>
            </div>
            <div class="game-content" id="gameContent">
                <!-- Game specific content -->
            </div>
            <div class="game-footer">
                <button class="btn-primary-action" id="btnAction" disabled>COMPROBAR</button>
            </div>

            <!-- Overlays -->
            <div class="level-complete-overlay" id="levelCompleteOverlay">
                <div class="stars-container" id="starsContainer">
                    <span class="star">★</span><span class="star">★</span><span class="star">★</span>
                </div>
                <h2 style="color:var(--color-primary); font-size: 2rem;">¡Nivel Completado!</h2>
                <p style="color:var(--color-accent); font-weight:bold; font-size:1.5rem;">+100 Monedas</p>
                <button class="btn-primary-action" onclick="document.getElementById('btnCloseGame').click()">CONTINUAR</button>
            </div>
        `;

        document.getElementById('btnCloseGame').addEventListener('click', this.closeGame);
        document.getElementById('btnAction').addEventListener('click', this.checkAnswers);

        this.renderProgressBar();
    }

    renderMathGameStage() {
        this.container.innerHTML = `
            <div class="game-header">
                <div class="progress-bar-container" id="progressBar"></div>
                <button class="btn-close-game" id="btnCloseGame">X</button>
            </div>
            <div class="game-content math-mode" id="gameContent" style="justify-content: flex-start;">
                <!-- Math Content -->
            </div>
             <!-- No Footer needed for Math, instant check -->

             <!-- Overlay reused -->
            <div class="level-complete-overlay" id="levelCompleteOverlay">
                <div class="stars-container" id="starsContainer">
                    <span class="star">★</span><span class="star">★</span><span class="star">★</span>
                </div>
                <h2 style="color:var(--color-primary); font-size: 2rem;">¡Excelente!</h2>
                <button class="btn-primary-action" onclick="document.getElementById('btnCloseGame').click()">SALIR</button>
            </div>
        `;
        document.getElementById('btnCloseGame').addEventListener('click', this.closeGame);
        this.renderProgressBar();
    }

    renderDictationGameStage() {
        this.container.innerHTML = `
            <div class="game-header">
                <div class="progress-bar-container" id="progressBar"></div>
                <button class="btn-close-game" id="btnCloseGame">X</button>
            </div>
            <div class="game-content dictation-mode" id="gameContent">
                <!-- Dictation Content -->
            </div>
            <div class="game-footer">
                <button class="btn-primary-action" id="btnAction" disabled>COMPROBAR</button>
            </div>

            <!-- Overlay -->
            <div class="level-complete-overlay" id="levelCompleteOverlay">
                <div class="stars-container" id="starsContainer">
                    <span class="star">★</span><span class="star">★</span><span class="star">★</span>
                </div>
                <h2 style="color:var(--color-primary); font-size: 2rem;">¡Bien Escrito!</h2>
                <button class="btn-primary-action" onclick="document.getElementById('btnCloseGame').click()">SALIR</button>
            </div>
        `;
        document.getElementById('btnCloseGame').addEventListener('click', this.closeGame);
        document.getElementById('btnAction').addEventListener('click', () => this.checkDictationAnswer());
        this.renderProgressBar();
    }

    renderProgressBar() {
        const bar = document.getElementById('progressBar');
        bar.innerHTML = '';
        const total = this.currentGameConfig.levels.length;
        for(let i=0; i<total; i++) {
            const seg = document.createElement('div');
            seg.className = `progress-segment ${i < this.state.currentLevelIndex ? 'filled' : ''}`;
            bar.appendChild(seg);
        }
    }

    loadLevel(index) {
        if (index >= this.currentGameConfig.levels.length) {
            this.handleLevelComplete(this.state.mistakes);
            return;
        }

        const level = this.currentGameConfig.levels[index];
        const content = document.getElementById('gameContent');

        // Clear previous content
        content.innerHTML = '';

        if (this.currentGameConfig.type === 'math') {
            this.loadMathLevel(level, content);
        } else if (this.currentGameConfig.type === 'dictation') {
            this.loadDictationLevel(level, content);
        } else {
            this.loadPhonemeLevel(level, content);
        }

        // Animation
        content.animate([
            { transform: 'translateX(100%)', opacity: 0 },
            { transform: 'translateX(0)', opacity: 1 }
        ], { duration: 300, easing: 'ease-out' });
    }

    loadPhonemeLevel(level, content) {
        // Reset Level State
        this.state.selectedCards.clear();
        this.updateActionButton(false);

        // Render Instruction
        const instr = document.createElement('h2');
        instr.className = 'phoneme-instruction';
        instr.innerHTML = this.currentGameConfig.instruction;
        content.appendChild(instr);

        // Render Grid
        const grid = document.createElement('div');
        grid.className = 'grid-cards';

        level.cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'game-card';
            cardEl.dataset.id = card.id;

            const svgContent = AssetFactory.getSvg(card.icon, 80, 80);

            cardEl.innerHTML = `
                <div class="card-icon">${svgContent}</div>
                <span>${card.word}</span>
            `;
            cardEl.onclick = () => this.handleCardClick(card, cardEl);
            grid.appendChild(cardEl);
        });

        content.appendChild(grid);
    }

    loadMathLevel(level, content) {
        this.state.mathInput = '';

        // Question Display
        const qContainer = document.createElement('div');
        qContainer.style.flex = '1';
        qContainer.style.display = 'flex';
        qContainer.style.alignItems = 'center';
        qContainer.style.justifyContent = 'center';

        const qText = document.createElement('h1');
        qText.innerText = `${level.q} = ?`;
        qText.style.fontSize = '4rem';
        qText.style.color = 'var(--color-primary)';
        qText.id = 'mathQuestion';
        qContainer.appendChild(qText);

        // Numpad
        const padContainer = document.createElement('div');
        padContainer.style.display = 'grid';
        padContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        padContainer.style.gap = '15px';
        padContainer.style.width = '100%';
        padContainer.style.maxWidth = '300px';
        padContainer.style.marginBottom = '20px';

        [1,2,3,4,5,6,7,8,9,0].forEach(num => {
            const btn = document.createElement('button');
            btn.innerText = num;
            btn.style.fontSize = '2rem';
            btn.style.padding = '20px';
            btn.style.borderRadius = '15px';
            btn.style.border = 'none';
            btn.style.background = 'white';
            btn.style.boxShadow = '0 4px 0 #bdc3c7';
            btn.style.cursor = 'pointer';
            btn.onclick = () => this.handleMathInput(num);

            if(num === 0) btn.style.gridColumn = '2';

            padContainer.appendChild(btn);
        });

        content.appendChild(qContainer);
        content.appendChild(padContainer);
    }

    loadDictationLevel(level, content) {
        content.style.flexDirection = 'column';
        content.style.alignItems = 'center';
        content.style.justifyContent = 'center';

        // 1. Image Container (The Asset)
        const imgContainer = document.createElement('div');
        imgContainer.className = 'dictation-image';
        imgContainer.innerHTML = AssetFactory.getSvg(level.icon, 150, 150);
        imgContainer.style.marginBottom = '20px';
        imgContainer.style.animation = 'pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

        // 2. Play Button
        const playBtn = document.createElement('div');
        playBtn.className = 'btn-play-sound';
        playBtn.innerHTML = AssetFactory.getSvg('play', 80, 80);
        playBtn.style.cursor = 'pointer';
        playBtn.style.marginBottom = '30px';
        playBtn.style.transition = 'transform 0.1s';
        playBtn.onmousedown = () => playBtn.style.transform = 'scale(0.9)';
        playBtn.onmouseup = () => playBtn.style.transform = 'scale(1)';
        playBtn.onclick = () => this.speakWord(level.word);

        // 3. Input Field (Dashed Lines)
        const inputContainer = document.createElement('div');
        inputContainer.style.position = 'relative';
        inputContainer.style.width = '80%';
        inputContainer.style.maxWidth = '400px';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'dictationInput';
        input.autocomplete = 'off';
        input.style.width = '100%';
        input.style.background = 'transparent';
        input.style.border = 'none';
        input.style.borderBottom = '4px dashed var(--color-primary)';
        input.style.fontSize = '2.5rem';
        input.style.textAlign = 'center';
        input.style.fontFamily = "'Fredoka', sans-serif";
        input.style.color = '#2d3436';
        input.style.outline = 'none';
        input.style.letterSpacing = '5px';
        input.style.textTransform = 'uppercase'; // Force uppercase visual

        input.oninput = (e) => this.handleDictationInput(e.target.value);

        // Backup Text Prompt (Hidden by default or subtle)
        const backupText = document.createElement('div');
        backupText.innerText = level.word.toUpperCase();
        backupText.style.fontSize = '1.5rem';
        backupText.style.color = '#bdc3c7';
        backupText.style.marginTop = '10px';
        backupText.style.opacity = '0.5';

        inputContainer.appendChild(input);

        content.appendChild(imgContainer);
        content.appendChild(playBtn);
        content.appendChild(inputContainer);
        content.appendChild(backupText); // Added as requested backup

        // Auto-play sound once on load? Maybe too intrusive.
        // Let's rely on user clicking play or auto-play after 500ms
        setTimeout(() => this.speakWord(level.word), 500);
    }

    speakWord(word) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = 'es-ES';
            utterance.rate = 0.8; // Slower for kids
            window.speechSynthesis.speak(utterance);
        } else {
            console.warn("TTS not supported");
        }
    }

    handleDictationInput(value) {
        const btn = document.getElementById('btnAction');
        btn.disabled = value.length === 0;
    }

    checkDictationAnswer() {
        const level = this.currentGameConfig.levels[this.state.currentLevelIndex];
        const input = document.getElementById('dictationInput');
        const value = input.value.trim().toUpperCase();
        const target = level.word.toUpperCase();

        // Normalize (remove accents for easier matching if needed, but strict dictation might require accents)
        // For this prototype, let's compare directly.

        // Simple Levenshtein or direct comparison?
        if (value === target) {
            // Correct
            input.style.borderBottomColor = 'var(--color-success)';
            input.style.color = 'var(--color-success)';

            if (this.engine) this.engine.reportResult(true, 'dictation');

            setTimeout(() => {
                this.state.currentLevelIndex++;
                // Check if all levels done
                if (this.state.currentLevelIndex >= this.currentGameConfig.levels.length) {
                    // Show Overlay
                    const overlay = document.getElementById('levelCompleteOverlay');
                    const starEls = document.querySelectorAll('.star');
                    overlay.classList.add('active');
                    starEls.forEach((el, idx) => {
                        setTimeout(() => el.classList.add('filled'), idx * 200);
                    });
                } else {
                    this.renderProgressBar();
                    this.loadLevel(this.state.currentLevelIndex);
                }
            }, 1000);

        } else {
            // Wrong
            input.style.borderBottomColor = 'var(--color-error)';
            input.classList.add('shake');

            if (this.engine) this.engine.reportResult(false, 'dictation');

            setTimeout(() => {
                input.classList.remove('shake');
                input.style.borderBottomColor = 'var(--color-primary)';
            }, 1000);
        }
    }

    handleMathInput(num) {
        // Build answer string or check immediately
        // For Speed Math, maybe check immediately if answer length matches?
        // Or check every input.

        const currentLevel = this.currentGameConfig.levels[this.state.currentLevelIndex];
        const target = currentLevel.a.toString();

        const nextInput = this.state.mathInput + num;

        // If length matches target length, validate
        if (nextInput.length >= target.length) {
             if (nextInput === target) {
                 // Correct
                 document.getElementById('mathQuestion').style.color = 'var(--color-success)';

                 if (this.engine) this.engine.reportResult(true, 'math');

                 setTimeout(() => {
                     this.state.currentLevelIndex++;
                     this.renderProgressBar();
                     this.loadLevel(this.state.currentLevelIndex);
                 }, 500);
             } else {
                 // Wrong
                 document.getElementById('mathQuestion').style.color = 'var(--color-error)';
                 document.getElementById('mathQuestion').classList.add('shake');
                 if (this.engine) this.engine.reportResult(false, 'math');

                 setTimeout(() => {
                    document.getElementById('mathQuestion').classList.remove('shake');
                    document.getElementById('mathQuestion').style.color = 'var(--color-primary)';
                 }, 500);

                 this.state.mathInput = ''; // Reset input
             }
        } else {
            this.state.mathInput = nextInput;
            document.getElementById('mathQuestion').innerText = `${currentLevel.q} = ${nextInput}`;
        }
    }

    handleCardClick(cardData, cardElement) {
        if (this.state.isCompleted) return;

        const id = cardData.id;
        if (this.state.selectedCards.has(id)) {
            this.state.selectedCards.delete(id);
            cardElement.classList.remove('selected');
        } else {
            this.state.selectedCards.add(id);
            cardElement.classList.add('selected');
        }

        // Enable button if at least one selected
        this.updateActionButton(this.state.selectedCards.size > 0);
    }

    updateActionButton(enabled) {
        const btn = document.getElementById('btnAction');
        btn.disabled = !enabled;
    }

    checkAnswers() {
        const level = this.currentGameConfig.levels[this.state.currentLevelIndex];
        const correctIds = level.cards.filter(c => c.isTarget).map(c => c.id);
        const selectedIds = Array.from(this.state.selectedCards);

        let allCorrect = true;
        let mistakesInRound = 0;

        // Visual Validation
        const cards = document.querySelectorAll('.game-card');
        cards.forEach(cardEl => {
            const id = cardEl.dataset.id;
            const isSelected = selectedIds.includes(id);
            const isTarget = correctIds.includes(id);

            if (isSelected && isTarget) {
                // Correct Selection
                cardEl.classList.add('correct');
                cardEl.classList.remove('selected');
            } else if (isSelected && !isTarget) {
                // Wrong Selection
                cardEl.classList.add('wrong');
                cardEl.classList.remove('selected');
                allCorrect = false;
                mistakesInRound++;
            } else if (!isSelected && isTarget) {
                // Missed Target
                allCorrect = false;
                // Maybe hint?
            }
        });

        if (allCorrect && selectedIds.length === correctIds.length) {
            // Success
            this.handleLevelComplete(mistakesInRound);
        } else {
            // Feedback
            this.state.mistakes += mistakesInRound;

            // Report to Engine
            if (this.engine) {
                this.engine.reportResult(false, this.currentGameConfig.type);
            }

            // Play "Boing" sound (mock)
            console.log("Mistakes made.");
            // Reset selection for wrong ones? Or keep them to show error?
            // Requirement: "Wrong: Card turns Red, shakes". This is done via CSS class.

            // Allow retry after delay?
            setTimeout(() => {
                cards.forEach(c => c.classList.remove('wrong'));
            }, 1000);
        }
    }

    handleLevelComplete(mistakesInRound) {
        this.state.isCompleted = true;
        console.log("Level Complete!");

        // Report to Engine
        if (this.engine) {
            this.engine.reportResult(true, this.currentGameConfig.type);
        }

        // Calculate Stars (Simple logic)
        // 0 mistakes = 3 stars, 1 mistake = 2 stars, >1 = 1 star
        const stars = this.state.mistakes === 0 ? 3 : (this.state.mistakes === 1 ? 2 : 1);

        // Show Overlay
        const overlay = document.getElementById('levelCompleteOverlay');
        const starEls = document.querySelectorAll('.star');

        overlay.classList.add('active');

        // Animate stars
        starEls.forEach((el, idx) => {
            if (idx < stars) {
                setTimeout(() => el.classList.add('filled'), idx * 200);
            }
        });
    }

    closeGame() {
        this.container.classList.remove('active');
        this.container.innerHTML = ''; // Clean up
    }
}

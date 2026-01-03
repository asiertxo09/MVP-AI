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
        levels: [{}, {}, {}, {}, {}] // Dynamic levels, require length > 0
    },
    speaking_dojo: {
        id: 'speaking_dojo',
        type: 'speaking',
        instruction: 'Habla conmigo',
        levels: [
            { id: 1, prompt: "¿Cuál es tu animal favorito?", icon: 'cat' },
            { id: 2, prompt: "¿Qué te gusta comer?", icon: 'frog' },
            { id: 3, prompt: "Dí 'Hola Mundo'", icon: 'sun' }
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

    async startGame(gameId, onComplete) {
        const gameConfig = GAMES_DATA[gameId];
        if (!gameConfig) {
            console.error('Game not found:', gameId);
            return;
        }

        this.onComplete = onComplete; // Store callback

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

        // Dynamic Loading Logic
        if (this.currentGameConfig.type === 'math' || this.currentGameConfig.type === 'phoneme_hunt') {
            // Show Loading Overlay
            this.container.innerHTML = `
                <div style="height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; color:var(--color-primary);">
                    <div class="loader" style="font-size:3rem; margin-bottom:20px;">🤖</div>
                    <h2>Creando tu aventura con IA...</h2>
                </div>
             `;
            this.container.classList.add('active');

            try {
                const response = await fetch('http://localhost:5001/api/generate-levels', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        gameType: this.currentGameConfig.type === 'phoneme_hunt' ? 'phoneme' : 'math',
                        difficulty: 'medium',
                        limit: 5
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.levels && data.levels.length > 0) {
                        // Merge or Replace Levels
                        // For math: Map simple objects {q, a} to level objects
                        if (this.currentGameConfig.type === 'math') {
                            this.currentGameConfig.levels = data.levels.map((item, idx) => ({
                                id: idx + 1,
                                q: item.q,
                                a: item.a
                            }));
                        }
                        // For Phoneme hunt, we need complex mapping?
                        // Backend prompt for phoneme was: [{word, icon, isTarget}]
                        // Frontend expects: level.cards = [...]
                    }
                }
            } catch (e) {
                console.error("AI Generation failed, using offline fallback", e);
                // Fallback is usage of existing config or random generation
            }
        }

        if (this.currentGameConfig.type === 'math') {
            this.renderMathGameStage();
        } else if (this.currentGameConfig.type === 'dictation') {
            this.renderDictationGameStage();
        } else if (this.currentGameConfig.type === 'speaking') {
            this.renderSpeakingGameStage();
        } else {
            this.renderGameStage();
        }

        this.loadLevel(0);

        // Show container (ensure it's active)
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
        for (let i = 0; i < total; i++) {
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
        } else if (this.currentGameConfig.type === 'speaking') {
            this.loadSpeakingLevel(level, content);
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

    renderSpeakingGameStage() {
        this.container.innerHTML = `
            <div class="game-header">
                <div class="progress-bar-container" id="progressBar"></div>
                <button class="btn-close-game" id="btnCloseGame">X</button>
            </div>
            <div class="game-content speaking-mode" id="gameContent" style="flex-direction: column; align-items: center; justify-content: center;">
                <!-- Speaking Content -->
            </div>
            <div class="game-footer">
                <button class="btn-primary-action" id="btnAction" disabled>SIGUIENTE</button>
            </div>
             <!-- Overlay -->
            <div class="level-complete-overlay" id="levelCompleteOverlay">
                <div class="stars-container" id="starsContainer">
                    <span class="star">★</span><span class="star">★</span><span class="star">★</span>
                </div>
                <h2 style="color:var(--color-primary); font-size: 2rem;">¡Bien Hablado!</h2>
                <button class="btn-primary-action" onclick="document.getElementById('btnCloseGame').click()">SALIR</button>
            </div>
        `;
        document.getElementById('btnCloseGame').addEventListener('click', this.closeGame);
        // Action is handled by voice result or manual skip
        document.getElementById('btnAction').onclick = () => {
            this.handleLevelComplete(0);
        };
        this.renderProgressBar();
    }

    loadMathLevel(level, content) {
        this.state.mathInput = '';

        // Adaptive Question Generation or Use Dynamic Level
        let q, a;

        if (level.q && level.a !== undefined) {
            q = level.q;
            a = level.a;
        } else {
            // Fallback: Random Generation
            const diff = this.engine ? this.engine.difficultyMultiplier : 1.0;

            if (diff < 1.2) {
                // Simple Addition
                const x = Math.floor(Math.random() * 5) + 1;
                const y = Math.floor(Math.random() * 5) + 1;
                q = `${x} + ${y}`;
                a = x + y;
            } else if (diff < 1.6) {
                // Harder Addition
                const x = Math.floor(Math.random() * 10) + 1;
                const y = Math.floor(Math.random() * 10) + 1;
                q = `${x} + ${y}`;
                a = x + y;
            } else if (diff < 2.0) {
                // Subtraction
                const x = Math.floor(Math.random() * 10) + 5;
                const y = Math.floor(Math.random() * 5) + 1;
                q = `${x} - ${y}`;
                a = x - y;
            } else if (diff < 2.5) {
                // Multiplication
                const x = Math.floor(Math.random() * 5) + 1;
                const y = Math.floor(Math.random() * 5) + 1;
                q = `${x} X ${y}`;
                a = x * y;
            } else {
                // Division (Simple)
                const y = Math.floor(Math.random() * 4) + 2;
                const res = Math.floor(Math.random() * 5) + 1;
                const x = y * res;
                q = `${x} / ${y}`;
                a = res;
            }
        }

        // Store Answer for validation
        this.currentGameConfig.currentAnswer = a;

        // Question Display
        const qContainer = document.createElement('div');
        qContainer.style.flex = '1';
        qContainer.style.display = 'flex';
        qContainer.style.alignItems = 'center';
        qContainer.style.justifyContent = 'center';

        const qText = document.createElement('h1');
        qText.innerText = `${q} = ?`;
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

        [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach(num => {
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

            if (num === 0) btn.style.gridColumn = '2';

            padContainer.appendChild(btn);
        });

        content.appendChild(qContainer);
        content.appendChild(padContainer);
    }

    loadSpeakingLevel(level, content) {
        // Simple Interaction: Computer speaks prompt -> User speaks (simulated or real) -> Computer responds

        // Icon / Avatar
        const imgContainer = document.createElement('div');
        imgContainer.innerHTML = AssetFactory.getSvg(level.icon, 120, 120);
        imgContainer.className = 'pulse'; // CSS animation

        // Prompt Text
        const text = document.createElement('h2');
        text.innerText = level.prompt;
        text.style.textAlign = 'center';
        text.style.marginTop = '20px';
        text.style.color = 'var(--color-primary)';

        // Mic Button
        const micBtn = document.createElement('button');
        micBtn.innerText = "🎤 Hablar";
        micBtn.style.marginTop = '30px';
        micBtn.className = 'btn-primary-action';
        micBtn.style.background = '#e74c3c'; // Red for recording

        const feedback = document.createElement('p');
        feedback.id = 'speechFeedback';
        feedback.style.marginTop = '20px';
        feedback.style.fontStyle = 'italic';
        feedback.style.color = '#7f8c8d';
        feedback.innerText = "Presiona hablar...";

        micBtn.onclick = () => {
            // Web Speech API Mock / Implementation
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                const recognition = new SpeechRecognition();
                recognition.lang = 'es-ES';
                recognition.start();

                feedback.innerText = "Escuchando...";
                micBtn.disabled = true;

                recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    feedback.innerText = `Dijiste: "${transcript}"`;
                    this.speakWord(`¡Qué interesante! Dijiste ${transcript}`);
                    document.getElementById('btnAction').disabled = false;
                    micBtn.disabled = false;
                    // Determine sentiment or keyword? For now just allow pass.
                    if (this.engine) this.engine.reportResult(true, 'speaking', 'speaking_dojo');
                };

                recognition.onerror = (event) => {
                    feedback.innerText = "No te entendí bien, intenta de nuevo.";
                    micBtn.disabled = false;
                };
            } else {
                // Fallback
                alert("Tu navegador no soporta reconocimiento de voz.");
                feedback.innerText = "Simulando voz...";
                setTimeout(() => {
                    feedback.innerText = "Dijiste: 'Me gustan los gatos'";
                    document.getElementById('btnAction').disabled = false;
                    if (this.engine) this.engine.reportResult(true, 'speaking', 'speaking_dojo');
                }, 1000);
            }
        };

        content.appendChild(imgContainer);
        content.appendChild(text);
        content.appendChild(micBtn);
        content.appendChild(feedback);

        this.speakWord(level.prompt);
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

            if (this.engine) this.engine.reportResult(true, 'dictation', 'dictation_dojo');

            setTimeout(() => {
                this.state.currentLevelIndex++;
                // Check if all levels done
                if (this.state.currentLevelIndex >= this.currentGameConfig.levels.length) {
                    this.handleLevelComplete(0);
                } else {
                    this.renderProgressBar();
                    this.loadLevel(this.state.currentLevelIndex);
                }
            }, 1000);

        } else {
            // Wrong
            input.style.borderBottomColor = 'var(--color-error)';
            input.classList.add('shake');

            if (this.engine) this.engine.reportResult(false, 'dictation', 'dictation_dojo');

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

        const target = this.currentGameConfig.currentAnswer.toString();

        const nextInput = this.state.mathInput + num;

        // Visual Update First - Fix for missing second digit
        this.state.mathInput = nextInput;
        const qText = document.getElementById('mathQuestion').innerText.split('=')[0];
        document.getElementById('mathQuestion').innerText = `${qText}= ${nextInput}`;

        // If length matches target length, validate
        if (nextInput.length >= target.length) {

            // Temporary block interactions if needed?
            // With delay of 500ms, user sees the number.

            setTimeout(() => {
                if (nextInput === target) {
                    // Correct
                    document.getElementById('mathQuestion').style.color = 'var(--color-success)';

                    if (this.engine) this.engine.reportResult(true, 'math', 'speed_math');

                    setTimeout(() => {
                        this.state.currentLevelIndex++;

                        // Adaptive Infinite Levels for Math? Or Cap at 5?
                        if (this.state.currentLevelIndex >= 5) {
                            this.handleLevelComplete(0);
                        } else {
                            this.renderProgressBar();
                            // For math with empty levels array, we pass dummy object or handle in loadMathLevel
                            this.loadLevel(this.state.currentLevelIndex);
                        }
                    }, 500); // Wait to see green
                } else {
                    // Wrong
                    document.getElementById('mathQuestion').style.color = 'var(--color-error)';
                    document.getElementById('mathQuestion').classList.add('shake');
                    if (this.engine) this.engine.reportResult(false, 'math', 'speed_math');

                    setTimeout(() => {
                        document.getElementById('mathQuestion').classList.remove('shake');
                        document.getElementById('mathQuestion').style.color = 'var(--color-primary)';

                        // Clear input visually and in state
                        const originalQ = document.getElementById('mathQuestion').innerText.split('=')[0];
                        document.getElementById('mathQuestion').innerText = `${originalQ}= ?`;
                        this.state.mathInput = '';
                    }, 1000);
                }
            }, 300); // 300ms delay to allow visual update of 2nd digit
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
                this.engine.reportResult(false, this.currentGameConfig.type, this.currentGameConfig.id);
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
            this.engine.reportResult(true, this.currentGameConfig.type, this.currentGameConfig.id);
        }

        // Notify App to Unlock Next Level
        if (this.onComplete) {
            this.onComplete();
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

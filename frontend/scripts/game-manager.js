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
                    { id: 'c1', word: 'Rana', icon: 'frog.svg', isTarget: true },
                    { id: 'c2', word: 'Gato', icon: 'cat.svg', isTarget: false },
                    { id: 'c3', word: 'Rosa', icon: 'rose.svg', isTarget: true },
                    { id: 'c4', word: 'Roca', icon: 'rock.svg', isTarget: true }
                ]
            }
        ]
    }
};

export class GameManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
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
            isCompleted: false
        };

        this.currentGameConfig = gameConfig;
        this.renderGameStage();
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
        const level = this.currentGameConfig.levels[index];
        const content = document.getElementById('gameContent');

        // Clear previous content
        content.innerHTML = '';

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
            cardEl.innerHTML = `
                <img src="../assets/icons/${card.icon}" alt="${card.word}">
                <span>${card.word}</span>
            `;
            cardEl.onclick = () => this.handleCardClick(card, cardEl);
            grid.appendChild(cardEl);
        });

        content.appendChild(grid);

        // Animation
        content.animate([
            { transform: 'translateX(100%)', opacity: 0 },
            { transform: 'translateX(0)', opacity: 1 }
        ], { duration: 300, easing: 'ease-out' });
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

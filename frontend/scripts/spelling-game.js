// =========================================================
// Spelling Sanctuaries - Orthography & Tracing
// =========================================================

import { GameEngine } from './GameEngine.js';

export class SpellingGame {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.engine = new GameEngine();
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.strokes = []; // Array of [{x, y, time}]
        this.targetLetter = 'b';
        this.currentPoints = [];
    }

    init() {
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        this.container.className = 'spelling-container';

        // Header
        const header = document.createElement('div');
        header.innerHTML = `<h2>✍️ Santuario de Escritura</h2>`;
        this.container.appendChild(header);

        // Instruction
        const instruction = document.createElement('p');
        instruction.innerText = `Traza la letra: ${this.targetLetter}`;
        instruction.style.fontSize = '2rem';
        this.container.appendChild(instruction);

        // Canvas Overlay Wrapper
        const canvasWrapper = document.createElement('div');
        canvasWrapper.style.position = 'relative';
        canvasWrapper.style.width = '300px';
        canvasWrapper.style.height = '300px';
        canvasWrapper.style.margin = '0 auto';
        canvasWrapper.style.border = '2px dashed #ccc';
        canvasWrapper.style.borderRadius = '20px';
        canvasWrapper.style.backgroundColor = '#fff';

        // Background Letter Guide
        const guide = document.createElement('div');
        guide.innerText = this.targetLetter;
        guide.style.position = 'absolute';
        guide.style.top = '0';
        guide.style.left = '0';
        guide.style.width = '100%';
        guide.style.height = '100%';
        guide.style.lineHeight = '300px';
        guide.style.fontSize = '200px';
        guide.style.textAlign = 'center';
        guide.style.color = '#eee'; // Faint guide
        guide.style.userSelect = 'none';
        guide.style.fontFamily = "'Baloo 2', sans-serif";
        canvasWrapper.appendChild(guide);

        // Drawing Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = 300;
        this.canvas.height = 300;
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.cursor = 'crosshair';

        // Events
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseleave', this.stopDrawing.bind(this));
        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent("mousedown", {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent("mousemove", {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });
        this.canvas.addEventListener('touchend', (e) => {
            const mouseEvent = new MouseEvent("mouseup", {});
            this.canvas.dispatchEvent(mouseEvent);
        });

        canvasWrapper.appendChild(this.canvas);
        this.container.appendChild(canvasWrapper);

        this.ctx = this.canvas.getContext('2d');
        this.ctx.lineWidth = 15;
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = '#6C5CE7'; // Primary color

        // Controls
        const controls = document.createElement('div');
        controls.style.marginTop = '20px';
        controls.style.display = 'flex';
        controls.style.flexDirection = 'column';
        controls.style.gap = '10px';
        controls.style.alignItems = 'center';

        // Letter Selector
        const letterSelect = document.createElement('select');
        letterSelect.style.padding = '5px';
        letterSelect.style.fontSize = '1.2rem';
        ['b', 'd', 'p', 'a'].forEach(l => {
            const opt = document.createElement('option');
            opt.value = l;
            opt.innerText = `Letra "${l}"`;
            if (l === this.targetLetter) opt.selected = true;
            letterSelect.appendChild(opt);
        });
        letterSelect.onchange = (e) => {
            this.targetLetter = e.target.value;
            this.clearCanvas();
            this.init(); // Re-render to update guide
        };
        controls.appendChild(letterSelect);

        const btnRow = document.createElement('div');
        const btnCheck = document.createElement('button');
        btnCheck.innerText = "✅ Verificar Trazo";
        btnCheck.onclick = () => this.analyzeStroke();

        const btnClear = document.createElement('button');
        btnClear.innerText = "🔄 Borrar";
        btnClear.onclick = () => this.clearCanvas();

        btnRow.appendChild(btnCheck);
        btnRow.appendChild(btnClear);
        controls.appendChild(btnRow);

        this.container.appendChild(controls);

        // Back Button
        const backBtn = document.createElement('button');
        backBtn.className = 'back-btn';
        backBtn.innerText = '← Volver';
        backBtn.onclick = () => window.location.href = 'index.html';
        this.container.appendChild(backBtn);
    }

    startDrawing(e) {
        this.isDrawing = true;
        this.currentPoints = [];
        this.draw(e);
    }

    draw(e) {
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.currentPoints.push({ x, y, t: Date.now() });

        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.ctx.beginPath();
            if (this.currentPoints.length > 0) {
                this.strokes.push([...this.currentPoints]);
            }
        }
    }

    clearCanvas() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.strokes = [];
    }

    analyzeStroke() {
        if (this.strokes.length === 0) {
            alert("¡Intenta trazar la letra primero!");
            return;
        }

        let isCorrect = true;
        let feedback = "¡Buen trabajo!";

        // Calculate Bounding Box and Total Length
        let minX = 300, maxX = 0, minY = 300, maxY = 0, totalLength = 0;
        this.strokes.forEach(stroke => {
            if (stroke.length === 0) return;
            // Update bounds for first point too
            minX = Math.min(minX, stroke[0].x);
            maxX = Math.max(maxX, stroke[0].x);
            minY = Math.min(minY, stroke[0].y);
            maxY = Math.max(maxY, stroke[0].y);

            for (let i = 1; i < stroke.length; i++) {
                const dx = stroke[i].x - stroke[i - 1].x;
                const dy = stroke[i].y - stroke[i - 1].y;
                totalLength += Math.sqrt(dx * dx + dy * dy);
                minX = Math.min(minX, stroke[i].x);
                maxX = Math.max(maxX, stroke[i].x);
                minY = Math.min(minY, stroke[i].y);
                maxY = Math.max(maxY, stroke[i].y);
            }
        });

        const width = maxX - minX;
        const height = maxY - minY;
        const ratio = height / (width || 1);

        // Basic Size Checks
        if (totalLength < 100) {
            alert("💡 ¡Dibuja la letra completa!");
            this.clearCanvas();
            return;
        }
        if (width < 30 || height < 50) {
            alert("💡 ¡Intenta hacerlo más grande!");
            this.clearCanvas();
            return;
        }

        // Letter Specific Rules
        // Check first stroke direction
        const firstStroke = this.strokes[0];
        let isTopDown = false;
        if (firstStroke && firstStroke.length > 5) {
            const startY = firstStroke[0].y;
            const endY = firstStroke[firstStroke.length - 1].y;
            isTopDown = startY < endY;
        } else {
            // Fallback for very short moves? Should be covered by totalLength but just in case
            isTopDown = true;
        }

        const isRound = ratio >= 0.8 && ratio <= 1.3;
        const isTall = ratio > 1.3;

        switch (this.targetLetter) {
            case 'b':
                // 'b' needs tall stem, top-down start preferred
                if (!isTopDown) { isCorrect = false; feedback = "Empieza desde arriba (palo)."; }
                else if (!isTall) { isCorrect = false; feedback = "Haz el palo más alto (parece una 'a')."; }
                break;
            case 'd':
                // 'd' tall stem
                if (!isTall) { isCorrect = false; feedback = "Haz el palo más alto (parece una 'a')."; }
                break;
            case 'p':
                // 'p' tall stem (descender), top-down
                if (!isTopDown) { isCorrect = false; feedback = "Empieza el palo desde arriba hacia abajo."; }
                else if (!isTall) { isCorrect = false; feedback = "Haz el palo más largo."; }
                break;
            case 'a':
                // 'a' should be round/square-ish
                if (!isRound) { isCorrect = false; feedback = "La 'a' debe ser redondita (no tan alta)."; }
                break;
        }

        this.engine.reportResult(isCorrect, 'spelling_trace', {
            letter: this.targetLetter,
            metrics: { ratio, isTopDown, strokeCount: this.strokes.length, width, height }
        });

        if (isCorrect) {
            alert("✨ " + feedback);
        } else {
            alert("💡 " + feedback);
            this.clearCanvas();
        }
    }
}

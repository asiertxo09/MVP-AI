export class MapController {
    constructor(containerId, progressData) {
        this.container = document.getElementById(containerId);
        this.progress = progressData || { current_level: 1, current_node_index: 0, stars: 0, coins: 0 };
        this.nodes = [];
    }

    render() {
        this.container.innerHTML = '';

        // HUD
        const hud = document.createElement('div');
        hud.className = 'hud-container';
        hud.innerHTML = `
            <div class="hud-item">
                <div class="hud-icon"><img src="../assets/gamification/avatar_placeholder.png" onerror="this.src='/assets/logo.png'"></div>
                <span>Héroe</span>
            </div>
            <div class="hud-item">
                <div class="hud-icon"><img src="../assets/gamification/badge_star_reading.png"></div>
                <span>${this.progress.stars}</span>
            </div>
            <div class="hud-item">
                <div class="hud-icon"><img src="../assets/gamification/ui_coin.png"></div>
                <span>${this.progress.coins}</span>
            </div>
        `;

        // Map Viewport
        const viewport = document.createElement('div');
        viewport.className = 'map-viewport';

        const svgContainer = document.createElement('div');
        svgContainer.className = 'map-svg-container';

        // Defined Path (Snake shape for mobile vertical scroll)
        // Using percentages for responsiveness within the container
        const pathCoords = [
            { x: 50, y: 90 }, // Start (Bottom)
            { x: 20, y: 75 },
            { x: 50, y: 60 },
            { x: 80, y: 45 },
            { x: 50, y: 30 },
            { x: 50, y: 10 }  // End (Top)
        ];

        // 1. Draw Path
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "map-path-svg");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("preserveAspectRatio", "none");

        let d = `M ${pathCoords[0].x} ${pathCoords[0].y}`;
        for (let i = 1; i < pathCoords.length; i++) {
            // Cubic bezier for smooth curves
            // Simple curve strategy: control points interpolated
            // For now, just straight lines or simple quadratic logic could work, but let's try a smooth curve
            const start = pathCoords[i - 1];
            const end = pathCoords[i];
            const cp1 = { x: start.x, y: (start.y + end.y) / 2 };
            const cp2 = { x: end.x, y: (start.y + end.y) / 2 };
            d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
        }

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("class", "map-path-line");
        svg.appendChild(path);
        svgContainer.appendChild(svg);

        // 2. Draw Nodes
        const levels = [
            { id: 1, type: 'start', label: 'Inicio' },
            { id: 2, type: 'math', label: 'Matemáticas' },
            { id: 3, type: 'reading', label: 'Lectura' },
            { id: 4, type: 'speaking', label: 'Habla' },
            { id: 5, type: 'boss', label: 'Reto Final' },
            { id: 6, type: 'chest', label: 'Tesoro' } // Extra node at top
        ];

        levels.forEach((level, index) => {
            if (index >= pathCoords.length) return; // Safety

            const coord = pathCoords[index];
            const node = document.createElement('div');
            // Determine state
            let state = 'locked';
            if (index < this.progress.current_node_index) state = 'done';
            if (index === this.progress.current_node_index) state = 'current';

            node.className = `map-node node-${state}`;
            node.style.left = `${coord.x}%`;
            node.style.top = `${coord.y}%`;

            // Asset selection
            let imgSrc = '../assets/gamification/map_node_locked.png';
            if (state === 'done') imgSrc = '../assets/gamification/map_node_done.png';
            if (state === 'current') imgSrc = '../assets/gamification/map_node_current.png';

            // HTML Structure
            node.innerHTML = `
                <img src="${imgSrc}" alt="Nivel ${index + 1}">
                <div class="node-label">${level.label}</div>
            `;

            // Click Handler
            node.onclick = () => {
                if (state === 'locked') {
                    // Shake animation or sound?
                    alert("¡Nivel bloqueado! Completa el anterior primero.");
                    return;
                }
                this.handleNodeClick(level, state);
            };

            svgContainer.appendChild(node);
        });

        viewport.appendChild(svgContainer);
        this.container.appendChild(hud);
        this.container.appendChild(viewport);
    }

    handleNodeClick(level, state) {
        // Trigger event or callback
        console.log("Clicked node", level);
        // Dispatch custom event
        const event = new CustomEvent('node-selected', { detail: { level, state } });
        document.dispatchEvent(event);
    }
}

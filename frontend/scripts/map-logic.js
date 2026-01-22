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

/**
 * WorldScrollController
 * Detects scroll position in the adventure map and smoothly
 * transitions background gradients between worlds.
 * 
 * World Zones (based on scroll percentage):
 * - Jungle: 0% - 33% (bottom of map)
 * - Sky:    33% - 66% (middle of map)
 * - Space:  66% - 100% (top of map)
 */
export class WorldScrollController {
    constructor(viewportSelector = '.map-viewport') {
        this.viewport = document.querySelector(viewportSelector);
        this.currentWorld = null;
        this.isActive = false;

        // World thresholds (percentage of scroll)
        this.thresholds = {
            jungle: { min: 0, max: 0.33 },
            sky: { min: 0.33, max: 0.66 },
            space: { min: 0.66, max: 1.0 }
        };

        this.init();
    }

    init() {
        if (!this.viewport) {
            console.warn('WorldScrollController: viewport not found');
            return;
        }

        // Bind scroll handler with throttle for performance
        this.handleScroll = this.throttle(this.onScroll.bind(this), 50);
        this.viewport.addEventListener('scroll', this.handleScroll);
        this.isActive = true;

        // Set initial world based on current scroll
        this.onScroll();
    }

    /**
     * Calculate scroll progress (0 = bottom, 1 = top)
     * Note: We invert because scrollTop increases as you scroll down,
     * but our map goes from bottom (jungle) to top (space)
     */
    getScrollProgress() {
        const { scrollTop, scrollHeight, clientHeight } = this.viewport;
        const maxScroll = scrollHeight - clientHeight;

        if (maxScroll <= 0) return 0.5; // Default to sky if no scroll

        // Invert: scrollTop 0 = bottom (jungle), max = top (space)
        const progress = scrollTop / maxScroll;
        return Math.min(1, Math.max(0, progress));
    }

    /**
     * Determine world based on scroll progress
     */
    getWorldFromProgress(progress) {
        // Map is scrolled from bottom to top, so:
        // - When at top (scrollTop = max), progress = 1 → Space
        // - When at bottom (scrollTop = 0), progress = 0 → Jungle
        if (progress < this.thresholds.jungle.max) return 'jungle';
        if (progress < this.thresholds.sky.max) return 'sky';
        return 'space';
    }

    /**
     * Handle scroll event
     */
    onScroll() {
        const progress = this.getScrollProgress();
        const newWorld = this.getWorldFromProgress(progress);

        if (newWorld !== this.currentWorld) {
            this.setWorld(newWorld);
        }
    }

    /**
     * Apply world theme to viewport
     */
    setWorld(world) {
        if (!this.viewport) return;

        // Remove old world classes
        this.viewport.classList.remove('world-jungle', 'world-sky', 'world-space');

        // Apply new world
        this.viewport.classList.add(`world-${world}`);
        this.viewport.setAttribute('data-world', world);

        this.currentWorld = world;

        // Dispatch event for external listeners
        const event = new CustomEvent('world-changed', {
            detail: { world, viewport: this.viewport }
        });
        document.dispatchEvent(event);

        console.log(`🌍 World changed to: ${world}`);
    }

    /**
     * Manually set a world (for testing or direct control)
     */
    forceWorld(world) {
        if (['jungle', 'sky', 'space'].includes(world)) {
            this.setWorld(world);
        }
    }

    /**
     * Throttle utility for scroll performance
     */
    throttle(fn, wait) {
        let lastTime = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastTime >= wait) {
                lastTime = now;
                fn.apply(this, args);
            }
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.viewport && this.handleScroll) {
            this.viewport.removeEventListener('scroll', this.handleScroll);
        }
        this.isActive = false;
    }
}

/**
 * Initialize world scroll controller when DOM is ready
 * Can be called manually or auto-initialized
 */
export function initWorldScroll(viewportSelector = '.map-viewport') {
    return new WorldScrollController(viewportSelector);
}

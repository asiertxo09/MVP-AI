
export class AssetFactory {
    static getSvg(name, width = 64, height = 64) {
        const icons = {
            frog: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <!-- Face -->
                    <circle cx="50" cy="50" r="45" fill="#2ecc71" />
                    <!-- Eyes -->
                    <circle cx="30" cy="35" r="10" fill="#ffffff" />
                    <circle cx="70" cy="35" r="10" fill="#ffffff" />
                    <circle cx="30" cy="35" r="5" fill="#000000" />
                    <circle cx="70" cy="35" r="5" fill="#000000" />
                    <!-- Smile -->
                    <path d="M 30 65 Q 50 80 70 65" stroke="#000000" stroke-width="3" fill="none" />
                </svg>`,
            coin: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="45" fill="#f1c40f" stroke="#f39c12" stroke-width="5" />
                    <circle cx="50" cy="50" r="30" fill="#f39c12" opacity="0.5" />
                    <text x="50" y="65" font-family="Arial" font-size="40" font-weight="bold" fill="#ffffff" text-anchor="middle">$</text>
                </svg>`,
            rock: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 20 80 L 10 50 L 30 20 L 70 15 L 90 45 L 80 80 Z" fill="#95a5a6" stroke="#7f8c8d" stroke-width="3" />
                </svg>`,
            rose: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <!-- Stem -->
                    <rect x="48" y="50" width="4" height="40" fill="#27ae60" />
                    <!-- Petals -->
                    <circle cx="50" cy="40" r="25" fill="#e74c3c" />
                    <circle cx="50" cy="40" r="15" fill="#c0392b" />
                </svg>`,
            cat: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <!-- Ears -->
                    <path d="M 20 30 L 20 10 L 40 20 Z" fill="#e67e22" />
                    <path d="M 80 30 L 80 10 L 60 20 Z" fill="#e67e22" />
                    <!-- Face -->
                    <circle cx="50" cy="50" r="40" fill="#e67e22" />
                    <!-- Eyes -->
                    <circle cx="35" cy="45" r="5" fill="#000" />
                    <circle cx="65" cy="45" r="5" fill="#000" />
                    <!-- Nose -->
                    <polygon points="50,60 45,55 55,55" fill="#ffb7b2" />
                </svg>`,
            sun: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <!-- Rays -->
                    <g stroke="#f1c40f" stroke-width="5">
                        <line x1="50" y1="0" x2="50" y2="100" />
                        <line x1="0" y1="50" x2="100" y2="50" />
                        <line x1="15" y1="15" x2="85" y2="85" />
                        <line x1="85" y1="15" x2="15" y2="85" />
                    </g>
                    <!-- Core -->
                    <circle cx="50" cy="50" r="30" fill="#f1c40f" stroke="#f39c12" stroke-width="3" />
                </svg>`,
            lock: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <rect x="25" y="45" width="50" height="40" rx="5" fill="#e74c3c" />
                    <path d="M 35 45 L 35 30 A 15 15 0 0 1 65 30 L 65 45" stroke="#e74c3c" stroke-width="8" fill="none" />
                    <circle cx="50" cy="65" r="5" fill="#fff" />
                </svg>`,
            star: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill="#f1c40f" />
                </svg>`
        };

        const icon = icons[name];
        if (!icon) {
            console.warn(`Icon ${name} not found in AssetFactory.`);
            // Return a placeholder or empty string
            return `<svg width="${width}" height="${height}"></svg>`;
        }
        return icon;
    }
}

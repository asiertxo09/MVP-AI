
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
                </svg>`,
            play: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="45" fill="#2ecc71" />
                    <polygon points="40,30 70,50 40,70" fill="#ffffff" />
                </svg>`,
            tree: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <rect x="40" y="60" width="20" height="30" fill="#8B4513" />
                    <path d="M 20 60 L 50 10 L 80 60 Z" fill="#2ecc71" />
                    <path d="M 20 40 L 50 0 L 80 40 Z" fill="#27ae60" opacity="0.8" />
                </svg>`,
            house: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="10,40 50,10 90,40" fill="#e74c3c" />
                    <rect x="20" y="40" width="60" height="50" fill="#ecf0f1" />
                    <rect x="40" y="60" width="20" height="30" fill="#8B4513" />
                </svg>`,
            car: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <rect x="10" y="40" width="80" height="30" rx="5" fill="#3498db" />
                    <rect x="20" y="20" width="60" height="20" rx="5" fill="#2980b9" />
                    <circle cx="25" cy="70" r="10" fill="#333" />
                    <circle cx="75" cy="70" r="10" fill="#333" />
                </svg>`,
            moon: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 50 10 A 40 40 0 1 0 50 90 A 30 30 0 1 1 50 10" fill="#f1c40f" />
                </svg>`,
            book: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <rect x="20" y="20" width="60" height="60" fill="#e67e22" />
                    <rect x="25" y="25" width="50" height="50" fill="#ecf0f1" />
                    <line x1="50" y1="20" x2="50" y2="80" stroke="#d35400" stroke-width="2" />
                </svg>`,
            dog: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="35" fill="#f4a261" />
                    <ellipse cx="35" cy="40" rx="5" ry="10" fill="#000" />
                    <ellipse cx="65" cy="40" rx="5" ry="10" fill="#000" />
                    <circle cx="50" cy="65" r="10" fill="#000" />
                    <path d="M 10 30 L 25 50 L 25 20 Z" fill="#e76f51" />
                    <path d="M 90 30 L 75 50 L 75 20 Z" fill="#e76f51" />
                </svg>`,
            flower: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="15" fill="#f1c40f" />
                    <circle cx="50" cy="20" r="15" fill="#e91e63" opacity="0.8" />
                    <circle cx="50" cy="80" r="15" fill="#e91e63" opacity="0.8" />
                    <circle cx="20" cy="50" r="15" fill="#e91e63" opacity="0.8" />
                    <circle cx="80" cy="50" r="15" fill="#e91e63" opacity="0.8" />
                </svg>`,
            cloud: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 25,60 Q 30,30 50,45 Q 70,25 85,50 Q 100,60 85,80 L 30,80 Q 10,75 25,60" fill="#ecf0f1" stroke="#bdc3c7" stroke-width="2" />
                </svg>`,
            bird: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 30 50 Q 10 30 30 10 Q 50 30 70 20 L 80 30 Q 60 50 30 50 L 20 60 L 30 50" fill="#3498db" />
                    <circle cx="35" cy="25" r="3" fill="#000" />
                    <path d="M 25 25 L 15 30 L 25 35" fill="#f1c40f" />
                    <path d="M 50 30 Q 60 10 70 30" fill="#2980b9" />
                </svg>`,
            fish: `
                <svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 80 50 Q 60 20 30 50 Q 60 80 80 50 Z" fill="#e67e22" />
                    <path d="M 30 50 L 10 30 L 10 70 Z" fill="#e67e22" />
                    <circle cx="65" cy="45" r="5" fill="#000" />
                </svg>`
        };

        const icon = icons[name];
        if (!icon) {
            // Fallback: Try to load from generated assets
            // Since we can't return async fetch result here easily, we return an IMG tag
            // pointing to the generated file.
            return `<img src="../assets/icons/${name}.svg" width="${width}" height="${height}" onerror="this.onerror=null; this.src='../assets/icons/icon-frog.svg';"/>`;
        }
        return icon;
    }
}

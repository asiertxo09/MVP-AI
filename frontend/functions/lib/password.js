const ITERATIONS = 150000;
const KEY_LENGTH = 32; // bytes (256 bits)
const encoder = new TextEncoder();

export async function hashPassword(password) {
    if (typeof password !== 'string' || password.length === 0) {
        throw new Error('Password vacío');
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await deriveBits(password, salt, ITERATIONS);
    return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password, stored) {
    if (typeof stored !== 'string' || !stored) return false;
    const parts = stored.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
        // Fallback para contraseñas antiguas en texto plano
        return stored === password;
    }

    const iterations = Number(parts[1]);
    if (!Number.isFinite(iterations) || iterations < 10000) return false;

    const salt = fromBase64(parts[2]);
    const expected = fromBase64(parts[3]);
    const hash = await deriveBits(password, salt, iterations);
    return timingSafeEqual(expected, hash);
}

async function deriveBits(password, salt, iterations) {
    const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        keyMaterial,
        KEY_LENGTH * 8
    );
    return new Uint8Array(bits);
}

function toBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function fromBase64(str) {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

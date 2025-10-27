export const DEFAULT_ALGORITHM = "pbkdf2-sha256";
export const DEFAULT_ITERATIONS = 100_000;
const KEY_LENGTH = 32; // 256 bits

/**
 * Generates a secure random salt.
 * @param {number} length Number of bytes.
 * @returns {Uint8Array}
 */
export function generateSalt(length = 16) {
    if (!Number.isInteger(length) || length <= 0) {
        throw new TypeError("Salt length must be a positive integer");
    }
    const salt = new Uint8Array(length);
    crypto.getRandomValues(salt);
    return salt;
}

/**
 * Derives a key using PBKDF2 (SHA-256).
 * @param {string} password Plain password provided by user.
 * @param {Uint8Array} salt Salt bytes.
 * @param {number} iterations Number of iterations.
 * @param {number} length Length of derived key in bytes.
 * @returns {Promise<Uint8Array>} Derived key bytes.
 */
async function derivePbkdf2(password, salt, iterations, length = KEY_LENGTH) {
    if (typeof password !== "string" || password.length === 0) {
        throw new TypeError("Password must be a non-empty string");
    }
    if (!(salt instanceof Uint8Array)) {
        throw new TypeError("Salt must be a Uint8Array");
    }
    if (!Number.isInteger(iterations) || iterations <= 0) {
        throw new TypeError("Iterations must be a positive integer");
    }

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            hash: "SHA-256",
            salt,
            iterations
        },
        keyMaterial,
        length * 8
    );

    return new Uint8Array(derivedBits);
}

function toBase64(bytes) {
    let binary = "";
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
}

function fromBase64(str) {
    const binary = atob(str);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function timingSafeEqual(a, b) {
    if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) {
        throw new TypeError("timingSafeEqual expects Uint8Array arguments");
    }

    const len = Math.max(a.length, b.length);
    let mismatch = a.length ^ b.length;
    for (let i = 0; i < len; i++) {
        const av = i < a.length ? a[i] : 0;
        const bv = i < b.length ? b[i] : 0;
        mismatch |= av ^ bv;
    }
    return mismatch === 0;
}

/**
 * Hashes the password and returns persistent metadata.
 * @param {string} password
 * @param {{ iterations?: number, saltLength?: number }} [options]
 */
export async function hashPassword(password, options = {}) {
    const iterations = options.iterations ?? DEFAULT_ITERATIONS;
    const saltLength = options.saltLength ?? 16;
    const salt = generateSalt(saltLength);
    const hashBytes = await derivePbkdf2(password, salt, iterations);
    return {
        algorithm: DEFAULT_ALGORITHM,
        iterations,
        salt: toBase64(salt),
        hash: toBase64(hashBytes)
    };
}

/**
 * Verifies if a password matches stored hash metadata.
 * @param {string} password
 * @param {{ password_hash?: string, password_salt?: string, password_iterations?: number, password_algo?: string, hash?: string, salt?: string, iterations?: number, algorithm?: string }} stored
 */
export async function verifyPassword(password, stored) {
    if (!stored) return false;

    const algorithm = (stored.password_algo || stored.algorithm || DEFAULT_ALGORITHM).toLowerCase();
    if (algorithm !== DEFAULT_ALGORITHM) {
        // Unknown algorithm; safest to reject.
        return false;
    }

    const saltB64 = stored.password_salt || stored.salt;
    const hashB64 = stored.password_hash || stored.hash;
    const iterations = Number(stored.password_iterations || stored.iterations || 0);

    if (!saltB64 || !hashB64 || !iterations) return false;

    const saltBytes = fromBase64(saltB64);
    const storedHash = fromBase64(hashB64);
    const derived = await derivePbkdf2(password, saltBytes, iterations, storedHash.length);
    return timingSafeEqual(derived, storedHash);
}

/**
 * Helper to expose the metadata in column order for INSERT statements.
 * @param {{ algorithm: string, iterations: number, salt: string, hash: string }} data
 * @returns {Array}
 */
export function toColumnTuple(data) {
    return [data.hash, data.salt, data.iterations, data.algorithm];
}

export function base64ToBytes(b64) {
    return fromBase64(b64);
}

export function bytesToBase64(bytes) {
    return toBase64(bytes);
}

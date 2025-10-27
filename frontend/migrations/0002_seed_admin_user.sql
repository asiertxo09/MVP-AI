-- Seed default admin user with PBKDF2 hash for password "admin1234".
INSERT INTO users (username, password_hash, password_salt, password_iterations, password_algo)
VALUES (
    'admin',
    'XtMct1ezRn0//uhO90BxEvJKEGMMy7m7y9uck+9WL/w=',
    'MZhMLe2EyJPrYTDhdc/1VQ==',
    100000,
    'pbkdf2-sha256'
);

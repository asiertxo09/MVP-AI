// Configuración de URLs de servicios
// Backend unificado en Render que maneja todo: transcripción, TTS y chat

window.ENV = {
    // Backend unificado (Groq API + gTTS)
    BACKEND_URL: 'https://eduplay-backend.onrender.com',

    // Para compatibilidad, usamos el mismo backend para audio
    AUDIO_SERVICE_URL: 'https://eduplay-backend.onrender.com',

    // Ambiente
    ENVIRONMENT: 'production'
};

// Detectar si estamos en desarrollo local
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.ENV.BACKEND_URL = 'http://localhost:5001';  // Puerto del backend Python
    window.ENV.AUDIO_SERVICE_URL = 'http://localhost:5001';
    window.ENV.ENVIRONMENT = 'development';
}

console.log('🔧 Configuración cargada:', window.ENV);

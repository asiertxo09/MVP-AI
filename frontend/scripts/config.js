// Configuración de URLs de servicios
// En producción, estas URLs apuntan a los servicios desplegados en Render
// En desarrollo local, puedes cambiarlas a localhost

window.ENV = {
    // Servicio de audio (transcripción y TTS)
    AUDIO_SERVICE_URL: 'https://mvp-ai.onrender.com',

    // Servicio de backend (Groq)
    BACKEND_URL: 'https://eduplay-backend.onrender.com',

    // Ambiente
    ENVIRONMENT: 'production'
};

// Detectar si estamos en desarrollo local
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.ENV.AUDIO_SERVICE_URL = 'http://localhost:5006';
    window.ENV.BACKEND_URL = 'http://localhost:3000';
    window.ENV.ENVIRONMENT = 'development';
}

console.log('🔧 Configuración cargada:', window.ENV);


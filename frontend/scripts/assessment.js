// Script para manejar la evaluación inicial
import { requireSession } from "./auth.js";

let assessmentId = null;
let currentTestIndex = 0;
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let timerInterval = null;

// Estado de las pruebas
const testState = {
    reading: { completed: false, data: null },
    phonological: { completed: false, data: null },
    math: { completed: false, data: null },
    dictation: { completed: false, data: null }
};

// Datos de las pruebas
const READING_TEXT = `El sol brillaba en el cielo azul mientras María y su perro corrían por el parque. Los pájaros cantaban en los árboles y las flores de colores alegraban el camino. María se sintió muy feliz ese día de primavera.`;

const PHONOLOGICAL_QUESTIONS = [
    {
        id: 1,
        question: "¿Qué palabras riman?",
        options: ["gato - pato", "casa - mesa", "sol - pan", "perro - gato"],
        correct: 0,
        type: "rima"
    },
    {
        id: 2,
        question: "¿Cuántas sílabas tiene 'mariposa'?",
        options: ["2", "3", "4", "5"],
        correct: 2,
        type: "silaba"
    },
    {
        id: 3,
        question: "¿Con qué sonido empieza 'pelota'?",
        options: ["/p/", "/b/", "/t/", "/l/"],
        correct: 0,
        type: "fonema"
    },
    {
        id: 4,
        question: "¿Qué palabras riman con 'sol'?",
        options: ["caracol - farol", "luna - cuna", "mar - sal", "día - noche"],
        correct: 0,
        type: "rima"
    },
    {
        id: 5,
        question: "¿Cuántas sílabas tiene 'elefante'?",
        options: ["2", "3", "4", "5"],
        correct: 2,
        type: "silaba"
    }
];

const MATH_QUESTIONS = [
    { id: 1, question: "3 + 5 = ", answer: 8, operation: "suma" },
    { id: 2, question: "7 - 2 = ", answer: 5, operation: "resta" },
    { id: 3, question: "4 + 6 = ", answer: 10, operation: "suma" },
    { id: 4, question: "9 - 3 = ", answer: 6, operation: "resta" },
    { id: 5, question: "2 + 8 = ", answer: 10, operation: "suma" },
    { id: 6, question: "10 - 4 = ", answer: 6, operation: "resta" },
    { id: 7, question: "5 + 5 = ", answer: 10, operation: "suma" },
    { id: 8, question: "8 - 1 = ", answer: 7, operation: "resta" }
];

const DICTATION_TEXT = "Los niños juegan en el patio. Hace mucho calor hoy.";
let dictationPlaysLeft = 2;


// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
    await requireSession();
    await createAssessment();
});

// Crear nueva evaluación
async function createAssessment() {
    try {
        const response = await fetch('/api/assessment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({})
        });

        if (!response.ok) throw new Error('Error al crear evaluación');

        const data = await response.json();
        assessmentId = data.assessmentId;
        console.log('Evaluación creada:', assessmentId);
    } catch (error) {
        console.error('Error:', error);
        alert('Error al iniciar la evaluación');
    }
}

// TEST 1: LECTURA EN VOZ ALTA
window.startReadingTest = function() {
    document.getElementById('test1Card').classList.add('active');
    document.getElementById('readingTest').classList.add('active');
    document.querySelector('#test1Card .btn-primary').style.display = 'none';
};

window.toggleRecording = async function() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        await startRecording();
    } else {
        stopRecording();
    }
};

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 16000
            }
        });

        // Reiniciar chunks
        audioChunks = [];

        // Detectar formato soportado
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
            mimeType = 'audio/ogg;codecs=opus';
        }

        mediaRecorder = new MediaRecorder(stream, { mimeType });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            // Crear Blob del audio grabado
            const audioBlob = new Blob(audioChunks, {
                type: mediaRecorder.mimeType || 'audio/webm'
            });

            console.log('Audio grabado:', {
                size: audioBlob.size,
                type: audioBlob.type
            });

            const audioUrl = URL.createObjectURL(audioBlob);

            const audioPlayer = document.getElementById('audioPlayback');
            audioPlayer.src = audioUrl;
            audioPlayer.style.display = 'block';

            // Guardar el Blob, NO el base64
            testState.reading.data = {
                audioBlob: audioBlob,  // Cambiar esto
                duration: (Date.now() - recordingStartTime) / 1000
            };

            document.getElementById('submitReadingBtn').style.display = 'block';
        };

        mediaRecorder.start(100); // Capturar cada 100ms
        recordingStartTime = Date.now();

        const recordBtn = document.getElementById('recordBtn');
        recordBtn.classList.add('recording');
        recordBtn.innerHTML = '⏹️';

        startTimer();

        document.getElementById('recordingStatus').innerHTML =
            '<p style="color: #fa5252; font-weight: bold;">🔴 Grabando... Lee el texto en voz alta</p>';

    } catch (error) {
        console.error('Error al acceder al micrófono:', error);
        alert('No se pudo acceder al micrófono. Por favor, permite el acceso.');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        // Detener todos los tracks del stream
        if (mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }

        const recordBtn = document.getElementById('recordBtn');
        recordBtn.classList.remove('recording');
        recordBtn.innerHTML = '🎤';

        clearInterval(timerInterval);

        document.getElementById('recordingStatus').innerHTML =
            '<p style="color: #51cf66; font-weight: bold;">✓ Grabación completada</p>';
    }
}

function startTimer() {
    let seconds = 0;
    timerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        document.getElementById('readingTimer').textContent =
            `${mins}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

window.submitReading = async function() {
    if (!testState.reading.data || !testState.reading.data.audioBlob) {
        alert('Por favor, graba tu lectura primero');
        return;
    }

    try {
        showLoading('Analizando tu lectura...');

        // Transcribir el audio pasando el Blob directamente
        const transcription = await transcribeAudio(testState.reading.data.audioBlob);

        // Convertir Blob a base64 para guardar en la BD
        const audioBase64 = await blobToBase64(testState.reading.data.audioBlob);

        // Contar palabras correctas
        const expectedWords = READING_TEXT.toLowerCase().split(/\s+/);
        const readWords = transcription.toLowerCase().split(/\s+/);

        const wordsRead = countCorrectWords(expectedWords, readWords);

        const response = await fetch('/api/assessment-reading', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                assessmentId,
                readingText: READING_TEXT,
                audioRecording: audioBase64,
                transcription: transcription,
                durationSeconds: testState.reading.data.duration,
                wordsRead: wordsRead,
                wordsExpected: expectedWords.length
            })
        });

        if (!response.ok) throw new Error('Error al guardar lectura');

        const data = await response.json();
        testState.reading.completed = true;
        testState.reading.metrics = data.metrics;

        hideLoading();
        completeTest('test1Card', 'startPhonBtn');

        alert(`¡Bien hecho! PCPM: ${data.metrics.pcpm.toFixed(1)}, Precisión: ${data.metrics.accuracy.toFixed(1)}%`);

    } catch (error) {
        hideLoading();
        console.error('Error:', error);
        alert('Error al procesar la lectura');
    }
};

// Función para transcribir audio (llamada al servicio local)
async function transcribeAudio(audioBlob) {
    try {
        if (!(audioBlob instanceof Blob)) {
            throw new Error('Audio inválido');
        }

        // Convertir a WAV en el cliente
        const wavBlob = await convertBlobToWav(audioBlob);
        const base64Audio = await blobToBase64(wavBlob);

        const response = await fetch('http://localhost:5006/transcribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                audio: base64Audio,
                format: 'wav', // Enviar como WAV
                language: 'es'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        return result.text;

    } catch (error) {
        console.error('Error en transcripción:', error);
        console.log('Servicio de transcripción no disponible, usando simulación');
        // Fallback de simulación
        return 'El sol brillaba en el cielo azul mientras los niños jugaban en el parque.';
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // Extraer solo base64 (sin "data:audio/webm;base64,")
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Nueva función para convertir Blob a WAV
async function convertBlobToWav(blob) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Resample a 16kHz si es necesario (aunque ya lo pedimos en getUserMedia)
    if (audioBuffer.sampleRate !== 16000) {
        console.warn(`Resampling from ${audioBuffer.sampleRate} to 16000`);
        const offlineContext = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.duration * 16000, 16000);
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start();
        const resampledBuffer = await offlineContext.startRendering();
        return bufferToWav(resampledBuffer);
    }

    return bufferToWav(audioBuffer);
}

// Helper para crear un Blob WAV desde un AudioBuffer
function bufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferOut = new ArrayBuffer(length);
    const view = new DataView(bufferOut);
    const channels = [];
    let i, sample;
    let offset = 0;
    let pos = 0;

    // Escribir cabecera WAV
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length of format data
    setUint16(1); // PCM - integer samples
    setUint16(numOfChan); // two channels
    setUint32(buffer.sampleRate); // sample rate
    setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2); // block align
    setUint16(16); // bits per sample
    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([view], { type: 'audio/wav' });

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}


// Contar palabras correctas
function countCorrectWords(expected, actual) {
    let correct = 0;
    const maxLen = Math.min(expected.length, actual.length);

    for (let i = 0; i < maxLen; i++) {
        if (expected[i] === actual[i] || similarity(expected[i], actual[i]) > 0.8) {
            correct++;
        }
    }

    return correct;
}

// Calcular similitud entre palabras
function similarity(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

// TEST 2: CONCIENCIA FONOLÓGICA
window.startPhonologicalTest = function() {
    document.getElementById('test2Card').classList.add('active');
    document.getElementById('phonologicalTest').classList.add('active');
    document.querySelector('#test2Card .test-actions').style.display = 'none';

    renderPhonologicalQuestions();
};

function renderPhonologicalQuestions() {
    const container = document.getElementById('phonologicalQuestions');
    container.innerHTML = '';

    PHONOLOGICAL_QUESTIONS.forEach((q, index) => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.innerHTML = `
            <div class="question-text">${index + 1}. ${q.question}</div>
            <div class="options">
                ${q.options.map((opt, i) => `
                    <button class="option-btn" onclick="selectPhonOption(${index}, ${i})">
                        ${opt}
                    </button>
                `).join('')}
            </div>
        `;
        container.appendChild(card);
    });

    document.getElementById('submitPhonBtn').style.display = 'block';
}

const phonologicalAnswers = [];

window.selectPhonOption = function(questionIndex, optionIndex) {
    phonologicalAnswers[questionIndex] = optionIndex;

    const card = document.querySelectorAll('.question-card')[questionIndex];
    const buttons = card.querySelectorAll('.option-btn');

    buttons.forEach((btn, i) => {
        btn.classList.remove('selected');
        if (i === optionIndex) {
            btn.classList.add('selected');
        }
    });
};

window.submitPhonological = async function() {
    if (phonologicalAnswers.length !== PHONOLOGICAL_QUESTIONS.length) {
        alert('Por favor, responde todas las preguntas');
        return;
    }

    try {
        showLoading('Evaluando respuestas...');

        let correctAnswers = 0;
        PHONOLOGICAL_QUESTIONS.forEach((q, i) => {
            if (phonologicalAnswers[i] === q.correct) {
                correctAnswers++;
            }
        });

        const response = await fetch('/api/assessment-phonological', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                assessmentId,
                testType: 'mixto',
                questionsData: PHONOLOGICAL_QUESTIONS.map((q, i) => ({
                    question: q.question,
                    userAnswer: phonologicalAnswers[i],
                    correctAnswer: q.correct,
                    type: q.type
                })),
                correctAnswers,
                totalQuestions: PHONOLOGICAL_QUESTIONS.length,
                timeSeconds: 0 // Podríamos medir el tiempo
            })
        });

        if (!response.ok) throw new Error('Error al guardar');

        const data = await response.json();
        testState.phonological.completed = true;
        testState.phonological.metrics = data.metrics;

        hideLoading();
        completeTest('test2Card', 'startMathBtn');

        alert(`¡Completado! Aciertos: ${data.metrics.accuracy.toFixed(1)}%`);

    } catch (error) {
        hideLoading();
        console.error('Error:', error);
        alert('Error al procesar respuestas');
    }
};

// TEST 3: CÁLCULO BÁSICO
let mathStartTime = null;

window.startMathTest = function() {
    document.getElementById('test3Card').classList.add('active');
    document.getElementById('mathTest').classList.add('active');
    document.querySelector('#test3Card .test-actions').style.display = 'none';

    mathStartTime = Date.now();
    renderMathQuestions();
};

function renderMathQuestions() {
    const container = document.getElementById('mathQuestions');
    container.innerHTML = '';

    MATH_QUESTIONS.forEach((q, index) => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.innerHTML = `
            <div class="question-text">
                ${q.question}
                <input type="number" class="math-input" id="math-${index}" 
                       placeholder="?" min="0" max="100">
            </div>
        `;
        container.appendChild(card);
    });

    document.getElementById('submitMathBtn').style.display = 'block';
}

window.submitMath = async function() {
    try {
        showLoading('Evaluando respuestas...');

        const timeSeconds = (Date.now() - mathStartTime) / 1000;
        let correctAnswers = 0;
        const answers = [];

        MATH_QUESTIONS.forEach((q, i) => {
            const input = document.getElementById(`math-${i}`);
            const userAnswer = parseInt(input.value) || 0;
            answers.push({
                question: q.question,
                userAnswer,
                correctAnswer: q.answer,
                correct: userAnswer === q.answer
            });

            if (userAnswer === q.answer) {
                correctAnswers++;
            }
        });

        const response = await fetch('/api/assessment-math', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                assessmentId,
                difficultyLevel: 'basico',
                questionsData: answers,
                correctAnswers,
                totalQuestions: MATH_QUESTIONS.length,
                timeSeconds
            })
        });

        if (!response.ok) throw new Error('Error al guardar');

        const data = await response.json();
        testState.math.completed = true;
        testState.math.metrics = data.metrics;

        hideLoading();
        completeTest('test3Card', 'startDictBtn');

        alert(`¡Completado! EPM: ${data.metrics.epm.toFixed(1)}, Aciertos: ${data.metrics.accuracy.toFixed(1)}%`);

    } catch (error) {
        hideLoading();
        console.error('Error:', error);
        alert('Error al procesar respuestas');
    }
};

// TEST 4: DICTADO
window.startDictationTest = function() {
    document.getElementById('test4Card').classList.add('active');
    document.getElementById('dictationTest').classList.add('active');
    document.querySelector('#test4Card .test-actions').style.display = 'none';
    // Resetear contador de reproducciones
    dictationPlaysLeft = 2;
    document.getElementById('playsLeft').textContent = '2';
    const playBtn = document.getElementById('playDictationBtn');
    playBtn.disabled = false;
    playBtn.style.opacity = '1';
    playBtn.style.cursor = 'pointer';
    playBtn.textContent = '▶️ Reproducir dictado';


    // Generar audio del dictado
    generateDictationAudio();
};

async function generateDictationAudio() {
    try {
        // Intentar usar el servicio TTS local
        const response = await fetch('http://localhost:5006/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: DICTATION_TEXT,
                voice: 'default',
                speed: 0.9
            })
        });

        if (response.ok) {
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            document.getElementById('dictationAudio').src = audioUrl;
        }
    } catch (error) {
        console.warn('Servicio TTS no disponible:', error);
    }
}

window.playDictation = function() {
    if (dictationPlaysLeft <= 0) {
        alert('Ya has escuchado el dictado 2 veces. Por favor, escribe lo que recuerdes.');
        return;
    }

    const audio = document.getElementById('dictationAudio');
    const playBtn = document.getElementById('playDictationBtn');

    if (audio.src) {
        audio.play();
        dictationPlaysLeft--;

        // Actualizar contador visual
        document.getElementById('playsLeft').textContent = dictationPlaysLeft;

        // Si no quedan reproducciones, deshabilitar el botón
        if (dictationPlaysLeft === 0) {
            playBtn.disabled = true;
            playBtn.style.opacity = '0.5';
            playBtn.style.cursor = 'not-allowed';
            playBtn.textContent = '🔇 Sin reproducciones restantes';
        } else {
            playBtn.textContent = `▶️ Reproducir dictado (${dictationPlaysLeft} restante${dictationPlaysLeft > 1 ? 's' : ''})`;
        }
    } else {
        alert('Audio no disponible. Escribe: "' + DICTATION_TEXT + '"');
    }
};

window.submitDictation = async function() {
    const studentResponse = document.getElementById('dictationInput').value.trim();

    if (!studentResponse) {
        alert('Por favor, escribe el dictado');
        return;
    }

    try {
        showLoading('Evaluando dictado...');

        const response = await fetch('/api/assessment-dictation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                assessmentId,
                dictationText: DICTATION_TEXT,
                audioDictation: null,
                studentResponse
            })
        });

        if (!response.ok) throw new Error('Error al guardar');

        const data = await response.json();
        testState.dictation.completed = true;
        testState.dictation.metrics = data.metrics;

        hideLoading();
        completeTest('test4Card', null);

        // Todas las pruebas completadas
        await finishAssessment();

    } catch (error) {
        hideLoading();
        console.error('Error:', error);
        alert('Error al procesar dictado');
    }
};

// Completar prueba
function completeTest(cardId, nextButtonId) {
    const card = document.getElementById(cardId);
    card.classList.remove('active');
    card.classList.add('completed');

    if (nextButtonId) {
        document.getElementById(nextButtonId).disabled = false;
    }

    updateProgress();
}

// Actualizar barra de progreso
function updateProgress() {
    const completed = Object.values(testState).filter(t => t.completed).length;
    const progress = (completed / 4) * 100;

    const progressBar = document.getElementById('overallProgress');
    progressBar.style.width = progress + '%';
    progressBar.textContent = Math.round(progress) + '%';
}

// Finalizar evaluación
async function finishAssessment() {
    try {
        // Marcar evaluación como completada
        await fetch('/api/assessment', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                assessmentId,
                completed: true,
                overallScore: calculateOverallScore()
            })
        });

        // Generar perfil del estudiante
        const profileResponse = await fetch('/api/student-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ assessmentId })
        });

        const profileData = await profileResponse.json();

        // Mostrar resultados
        displayResults(profileData.profile);

    } catch (error) {
        console.error('Error:', error);
        alert('Evaluación completada, pero hubo un error al generar el perfil');
    }
}

function calculateOverallScore() {
    let totalScore = 0;
    let count = 0;

    if (testState.reading.metrics) {
        totalScore += testState.reading.metrics.accuracy;
        count++;
    }
    if (testState.phonological.metrics) {
        totalScore += testState.phonological.metrics.accuracy;
        count++;
    }
    if (testState.math.metrics) {
        totalScore += testState.math.metrics.accuracy;
        count++;
    }
    if (testState.dictation.metrics) {
        totalScore += testState.dictation.metrics.accuracy;
        count++;
    }

    return count > 0 ? totalScore / count : 0;
}

function displayResults(profile) {
    const metricsHtml = `
        <div class="metric-card">
            <div class="metric-value">${profile.overallPcpm?.toFixed(1) || 0}</div>
            <div class="metric-label">PCPM (Palabras/min)</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${profile.overallEpm?.toFixed(1) || 0}</div>
            <div class="metric-label">EPM (Ejercicios/min)</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${profile.overallAccuracy?.toFixed(1) || 0}%</div>
            <div class="metric-label">Precisión general</div>
        </div>
    `;

    document.getElementById('metricsDisplay').innerHTML = metricsHtml;
    document.getElementById('resultsSection').classList.remove('hidden');

    // Scroll suave a resultados
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

window.goToApp = function() {
    window.location.href = '/app/';
};

// Utilidades
function showLoading(message) {
    // Implementar loading overlay
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
        font-size: 20px;
    `;
    overlay.innerHTML = `
        <div style="text-align: center;">
            <div class="spinner"></div>
            <p style="margin-top: 20px;">${message}</p>
        </div>
    `;
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.remove();
    }
}


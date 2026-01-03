document.addEventListener('DOMContentLoaded', () => {
    // 1. Check Auth
    // We check if the cookie exists (client-side check only, real check is API)
    // Or we rely on the API call failing to redirect.
    // For better UX, we can check localStorage for a flag or try a profile fetch.

    initDashboard();
});

let dashboardData = null;
let weeklyChartInstance = null;
let skillsChartInstance = null;

async function initDashboard() {
    const urlParams = new URLSearchParams(window.location.search);
    const childId = urlParams.get('childId');

    // Construct URL with childId if present, otherwise API will use session user
    const apiUrl = childId ? `/api/parent/stats?childId=${childId}` : '/api/parent/stats';

    try {
        const response = await fetch(apiUrl);
        if (response.status === 401 || response.status === 403) {
            // Unauthorized, redirect to login
            window.location.href = 'parent-login.html';
            return;
        }
        if (!response.ok) throw new Error('Failed to load stats');

        dashboardData = await response.json();
        renderDashboard(dashboardData);
    } catch (error) {
        console.error("Error loading dashboard:", error);
        document.querySelector('.dashboard-container').innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; grid-column:1/-1;">
                <h2>Error cargando datos</h2>
                <p>${error.message}</p>
                <button onclick="window.location.reload()" style="margin-top:1rem; padding:0.5rem 1rem; cursor:pointer;">Reintentar</button>
            </div>
        `;
    }
}

function renderDashboard(data) {
    // 1. Profile
    document.getElementById('user-name').innerText = data.profile.username;
    document.getElementById('user-avatar').innerText = data.profile.username.charAt(0).toUpperCase();
    document.getElementById('streak-days').innerText = `${data.profile.streak} días`;

    // 2. Weekly Activity Chart
    renderWeeklyChart(data.weekly_activity);

    // 3. Fluency
    document.getElementById('pcpm-value').innerText = data.profile.pcpm || "--";

    // 4. Skills Chart
    renderSkillsChart(data.skills);

    // 5. Recent Session & 24h Stats
    if (data.recent_session) {
        document.getElementById('last-game-name').innerText = data.recent_session.activity_name || data.recent_session.activity_type;
        document.getElementById('last-score').innerText = (data.recent_session.stars_earned || 0) + " ★";
    } else {
        document.getElementById('last-game-name').innerText = "Sin actividad";
        document.getElementById('last-score').innerText = "--";
    }

    const totalMinutes = Math.round((data.stats_24h.total_time || 0) / 60);
    document.getElementById('total-time-24h').innerText = `${totalMinutes}m`;
    document.getElementById('accuracy-24h').innerText = `${data.stats_24h.accuracy}%`;
}

function renderWeeklyChart(activityData) {
    const ctx = document.getElementById('weeklyChart').getContext('2d');

    // activityData is now pre-filled by backend with last 7 days
    const labels = activityData.map(d => {
        const date = new Date(d.day);
        return date.toLocaleDateString('es-ES', { weekday: 'short' });
    });
    const dataPoints = activityData.map(d => Math.round(d.duration / 60));

    weeklyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Minutos jugados',
                data: dataPoints,
                backgroundColor: '#6C5CE7',
                borderRadius: 4,
                barThickness: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderSkillsChart(skills) {
    const ctx = document.getElementById('skillsChart').getContext('2d');

    skillsChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Matemáticas', 'Lectura', 'Escritura'],
            datasets: [{
                label: 'Habilidad',
                data: [skills.math || 0, skills.reading || 0, skills.writing || 0],
                backgroundColor: 'rgba(108, 92, 231, 0.2)',
                borderColor: '#6C5CE7',
                pointBackgroundColor: '#6C5CE7',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                r: {
                    angleLines: { color: '#dfe6e9' },
                    grid: { color: '#dfe6e9' },
                    pointLabels: { font: { family: 'Inter', size: 12 } },
                    suggestedMin: 0,
                    suggestedMax: 100
                }
            }
        }
    });
}

// ZOOM / MODAL LOGIC
window.openZoom = function(cardType) {
    const modal = document.getElementById('zoom-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    modal.classList.add('active');

    if (cardType === 'profile') {
        title.innerText = "Detalle del Perfil";
        body.innerHTML = `
            <div style="display:grid; gap:1rem;">
                <p><strong>Usuario:</strong> ${dashboardData.profile.username}</p>
                <p><strong>Racha Actual:</strong> ${dashboardData.profile.streak} días</p>
                <p><strong>Total Estrellas:</strong> ${dashboardData.profile.stars}</p>
                <hr>
                <h3>Historial</h3>
                <p>Nivel Matemáticas: ${dashboardData.profile.math_level || 'N/A'}</p>
                <p>Nivel Lectura: ${dashboardData.profile.reading_level || 'N/A'}</p>
            </div>
        `;
    } else if (cardType === 'activity') {
        title.innerText = "Actividad Detallada (30 días)";
        body.innerHTML = '<div style="height:300px; width:100%"><canvas id="detailedActivityChart"></canvas></div>';
        // Render chart after DOM update
        setTimeout(() => renderDetailedActivityChart(dashboardData.history_30d), 100);
    } else if (cardType === 'fluency') {
        title.innerText = "Progreso de Lectura";
        body.innerHTML = `
            <div style="text-align:center; margin-bottom:2rem;">
                <h1>${dashboardData.profile.pcpm} PCPM</h1>
                <p>Palabras Correctas Por Minuto</p>
            </div>
            <p>Velocidad basada en la última evaluación de lectura.</p>
        `;
    } else if (cardType === 'skills') {
        title.innerText = "Desglose de Habilidades";
        body.innerHTML = `
            <div style="display:flex; justify-content:space-around; text-align:center;">
                <div>
                    <h3>Matemáticas</h3>
                    <div style="font-size:2rem; color:#6C5CE7">${dashboardData.skills.math}%</div>
                </div>
                <div>
                    <h3>Lectura</h3>
                    <div style="font-size:2rem; color:#00B894">${dashboardData.skills.reading}%</div>
                </div>
                <div>
                    <h3>Escritura</h3>
                    <div style="font-size:2rem; color:#FF7675">${dashboardData.skills.writing}%</div>
                </div>
            </div>
            <div style="margin-top:2rem;">
                <h3>Recomendaciones</h3>
                <ul>
                    <li>Practicar más ejercicios de ${dashboardData.skills.math < 70 ? 'Matemáticas' : 'Escritura'}.</li>
                </ul>
            </div>
        `;
    } else if (cardType === 'recent') {
        title.innerText = "Última Sesión Detallada";
        if (dashboardData.recent_session) {
            const s = dashboardData.recent_session;
            body.innerHTML = `
                <p><strong>Juego:</strong> ${s.activity_name}</p>
                <p><strong>Fecha:</strong> ${new Date(s.completed_at).toLocaleString()}</p>
                <p><strong>Duración:</strong> ${s.duration_seconds} segundos</p>
                <p><strong>Estrellas:</strong> ${s.stars_earned}</p>
                <p><strong>Resultado:</strong> ${s.is_correct ? 'Correcto' : 'Incorrecto'}</p>
                <hr>
                <h3>Detalles Técnicos</h3>
                <pre style="background:#f1f1f1; padding:1rem; border-radius:8px; overflow:auto;">${JSON.stringify(JSON.parse(s.metadata || '{}'), null, 2)}</pre>
            `;
        } else {
            body.innerHTML = "<p>No hay datos recientes.</p>";
        }
    }
}

window.closeZoom = function(event) {
    if (event.target.id === 'zoom-modal' || event.target.classList.contains('modal-close')) {
        document.getElementById('zoom-modal').classList.remove('active');
    }
}

function renderDetailedActivityChart(historyData) {
    if (!historyData || historyData.length === 0) return;

    const ctx = document.getElementById('detailedActivityChart').getContext('2d');

    const labels = historyData.map(d => d.day.substring(5)); // MM-DD
    const dataPoints = historyData.map(d => Math.round(d.duration / 60)); // Minutes

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Actividad (min)',
                data: dataPoints,
                borderColor: '#6C5CE7',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(108, 92, 231, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y + ' min';
                        }
                    }
                }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// Global logout function
window.logout = async function() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        // Clear cookies/storage
        localStorage.removeItem('parent_token'); // Just in case, though we rely on httpOnly cookies now
        window.location.href = 'index.html';
    } catch (e) {
        window.location.href = 'index.html';
    }
}

import { requireSession, initLogoutButton } from "./auth.js";

const METRICS_KEY = "eduplay_metrics";

const ACTIVITY_LIBRARY = {
  lenguaje: {
    title: "Historias con ritmo",
    instructions:
      "Escucha la historia y elige un emoji que muestre cómo se siente el personaje. Luego responde la pregunta final.",
    reward: { stars: 2, energy: 1, streak: 1 },
  },
  sensorial: {
    title: "Pausa arcoíris",
    instructions:
      "Haz tres respiraciones lentas, estira tus brazos y elige el color que describe tu energía. ¿Es azul calmado o rojo potente?",
    reward: { stars: 1, energy: 2, streak: 1 },
  },
  matematicas: {
    title: "Laboratorio numérico",
    instructions:
      "Cuenta las fichas brillantes, canta el resultado y selecciona la respuesta correcta. Si fallas vuelve a intentarlo con ayuda.",
    reward: { stars: 3, energy: -1, streak: 1 },
  },
};

const defaultMetrics = () => ({
  totalStars: 0,
  energyLevel: 5,
  streak: 0,
  lastActivity: null,
  history: [],
});

const loadMetrics = () => {
  try {
    const stored = localStorage.getItem(METRICS_KEY);
    if (!stored) return defaultMetrics();
    const parsed = JSON.parse(stored);
    return { ...defaultMetrics(), ...parsed };
  } catch (error) {
    console.warn("No se pudieron cargar las métricas guardadas", error);
    return defaultMetrics();
  }
};

const saveMetrics = (metrics) => {
  localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
};

const updateBoard = (metrics) => {
  const list = document.getElementById("progressList");
  const status = document.getElementById("progresoEstado");
  if (!list || !status) return;
  list.innerHTML = "";

  const items = [
    {
      label: "Estrellas ganadas",
      value: metrics.totalStars,
      detail: `${metrics.totalStars} ⭐`,
      trend: metrics.totalStars >= 10 ? "up" : "neutral",
    },
    {
      label: "Nivel de energía",
      value: Math.max(0, Math.min(10, metrics.energyLevel)),
      detail: `${metrics.energyLevel}/10`,
      trend: metrics.energyLevel >= 5 ? "up" : "down",
    },
    {
      label: "Racha de días felices",
      value: metrics.streak,
      detail: `${metrics.streak} días`,
      trend: metrics.streak >= 3 ? "up" : "neutral",
    },
  ];

  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "progress-item";
    const label = document.createElement("strong");
    label.textContent = item.label;
    const badge = document.createElement("span");
    badge.className = "metric-badge";
    if (item.trend === "down") {
      badge.dataset.trend = "down";
    }
    badge.textContent = item.detail;
    li.append(label, badge);
    fragment.appendChild(li);
  });

  list.appendChild(fragment);

  if (metrics.lastActivity && metrics.lastActivity.title) {
    const reference = metrics.lastActivity.at ?? new Date().toISOString();
    const humanTime = relativeTime(reference);
    status.textContent = `Tu última misión fue «${metrics.lastActivity.title}» ${humanTime}. ¡Sigue así!`;
  } else {
    status.textContent =
      "Completa tu primera misión para ver tus estrellas y energía.";
  }
};

const relativeTime = (dateString) => {
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const now = Date.now();
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) {
    return "hace un ratito";
  }
  const diffMinutes = Math.round((then - now) / 60000);
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }
  const diffHours = Math.round((then - now) / 3600000);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }
  const diffDays = Math.round((then - now) / 86400000);
  return rtf.format(diffDays, "day");
};

const openDialog = (activityKey) => {
  const backdrop = document.getElementById("activityDialog");
  const title = document.getElementById("dialogTitle");
  const instruction = document.getElementById("dialogInstruction");
  const activity = ACTIVITY_LIBRARY[activityKey];
  if (!backdrop || !activity) return;
  backdrop.dataset.activity = activityKey;
  title.textContent = activity.title;
  instruction.textContent = activity.instructions;
  backdrop.setAttribute("aria-hidden", "false");
  backdrop.querySelector('[data-action="cancel"]').focus();
};

const closeDialog = () => {
  const backdrop = document.getElementById("activityDialog");
  if (!backdrop) return;
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.removeAttribute("data-activity");
};

const completeActivity = (activityKey, metrics) => {
  const config = ACTIVITY_LIBRARY[activityKey];
  if (!config) return metrics;
  const updated = { ...metrics };
  updated.totalStars = Math.max(
    0,
    updated.totalStars + (config.reward.stars ?? 0),
  );
  updated.energyLevel = Math.max(
    0,
    Math.min(10, updated.energyLevel + (config.reward.energy ?? 0)),
  );
  updated.streak = Math.max(0, updated.streak + (config.reward.streak ?? 0));
  const now = new Date().toISOString();
  updated.lastActivity = {
    key: activityKey,
    title: config.title,
    at: now,
  };
  updated.history = [
    {
      key: activityKey,
      at: now,
      reward: config.reward,
    },
    ...(metrics.history ?? []),
  ].slice(0, 20);

  // Sincronizar con la base de datos
  syncMetricsToDatabase(activityKey, config);

  return updated;
};

// Nueva función para sincronizar métricas con la base de datos
const syncMetricsToDatabase = async (activityKey, config) => {
  try {
    await fetch('/api/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        activityType: activityKey,
        activityName: config.title,
        starsEarned: config.reward.stars || 0,
        energyChange: config.reward.energy || 0,
        isCorrect: true, // Las actividades del sistema de misiones se consideran completadas
        challengeData: { type: 'mission', activity: activityKey },
        userResponse: { completed: true },
        metadata: {
          timestamp: Date.now(),
          source: 'child-app'
        }
      })
    });
  } catch (error) {
    console.warn('Error sincronizando métrica:', error);
    // No bloquear la experiencia del usuario si falla el guardado
  }
};

const attachActivityListeners = (metrics) => {
  const cards = document.querySelectorAll(
    '.activity-card [data-action="start"]',
  );
  cards.forEach((button) => {
    button.addEventListener("click", () => {
      const activityKey = button.closest(".activity-card")?.dataset.activity;
      openDialog(activityKey);
    });
  });

  const dialog = document.getElementById("activityDialog");
  if (!dialog) return;
  dialog.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action === "cancel") {
      closeDialog();
    }
    if (target.dataset.action === "complete") {
      const activityKey = dialog.dataset.activity;
      const nextMetrics = completeActivity(activityKey, metrics);
      metrics.totalStars = nextMetrics.totalStars;
      metrics.energyLevel = nextMetrics.energyLevel;
      metrics.streak = nextMetrics.streak;
      metrics.lastActivity = nextMetrics.lastActivity;
      metrics.history = nextMetrics.history;
      saveMetrics(metrics);
      updateBoard(metrics);
      closeDialog();
    }
  });
};

const init = () => {
  requireSession();
  const metrics = loadMetrics();
  updateBoard(metrics);
  attachActivityListeners(metrics);
  initLogoutButton("logoutButton");
};

window.addEventListener("DOMContentLoaded", init);

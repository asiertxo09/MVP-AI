import { post, ApiError } from "./api-client.js";

const SESSION_KEY = "eduplay_session";

const showStatus = (element, message, variant = "info") => {
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  element.classList.remove("error", "success");
  if (variant === "error") {
    element.classList.add("error");
  } else if (variant === "success") {
    element.classList.add("success");
  }
};

const hideStatus = (element) => {
  if (!element) return;
  element.hidden = true;
  element.textContent = "";
  element.classList.remove("error", "success");
};

const setFieldError = (form, fieldName, message = "") => {
  const errorElement = form?.querySelector(`[data-error-for="${fieldName}"]`);
  if (errorElement) {
    if (message) {
      errorElement.textContent = message;
      errorElement.hidden = false;
    } else {
      errorElement.hidden = true;
      errorElement.textContent = "";
    }
  }
};

const clearErrors = (form) => {
  form?.querySelectorAll("[data-error-for]").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });
};

const validateRegister = (form) => {
  const username = form.username.value.trim();
  const password = form.password.value.trim();
  const confirm = form.passwordConfirm.value.trim();
  const consent = form.querySelector("#register-consent");
  const role = form.role.value
  let hasError = false;

  clearErrors(form);

  if (!username) {
    setFieldError(form, "register-username", "El correo es obligatorio.");
    hasError = true;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) {
    setFieldError(form, "register-username", "Introduce un correo válido.");
    hasError = true;
  }

  if (!password) {
    setFieldError(form, "register-password", "Escribe una contraseña.");
    hasError = true;
  } else if (password.length < 8) {
    setFieldError(
      form,
      "register-password",
      "Debe tener al menos 8 caracteres.",
    );
    hasError = true;
  }

  if (confirm !== password) {
    setFieldError(form, "register-confirm", "Las contraseñas no coinciden.");
    hasError = true;
  }

  if (!consent.checked) {
    setFieldError(
      form,
      "register-consent",
      "Necesitamos tu consentimiento para continuar.",
    );
    hasError = true;
  }

  return {
    valid: !hasError,
    values: {
      username,
      password, role,
    },
  };
};

const validateLogin = (form) => {
  const username = form.username.value.trim();
  const password = form.password.value.trim();
  let hasError = false;

  clearErrors(form);

  if (!username) {
    setFieldError(form, "login-username", "Escribe tu usuario.");
    hasError = true;
  }

  if (!password) {
    setFieldError(form, "login-password", "Escribe tu contraseña.");
    hasError = true;
  }

  return {
    valid: !hasError,
    values: {
      username,
      password,
    },
  };
};

const register = async (payload) => {
  return post("/api/register", payload);
};

const login = async (payload) => {
  const response = await post("/api/login", payload);
  // Registrar la sesión en la tabla sessions
  try {
    await post("/api/sessions", {
      username: payload.username // Enviar el username en lugar de id_user
    });
  } catch (error) {
    console.warn("No se pudo registrar la sesión", error);
  }
  return response;
};



const rememberSession = () => {
  localStorage.setItem(SESSION_KEY, "active");
};

const hasActiveSession = () => localStorage.getItem(SESSION_KEY) === "active";

const requireSession = () => {
  if (!hasActiveSession()) {
    window.location.replace("/login.html?redirect=protected");
  }
};

const initRegisterForm = ({ formId, statusId, submitId, onSuccess } = {}) => {
  const form = document.getElementById(formId);
  const statusElement = document.getElementById(statusId);
  const submitButton = document.getElementById(submitId);
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { valid, values } = validateRegister(form);
    if (!valid) {
      return;
    }

    submitButton?.setAttribute("disabled", "true");
    showStatus(statusElement, "Creando tu cuenta…");

    try {
      // Limpiar localStorage antes de registrar para evitar bucle infinito
      localStorage.removeItem(SESSION_KEY);

      await register(values);
      showStatus(
        statusElement,
        "¡Tu cuenta está lista! Iniciando sesión…",
        "success",
      );

      // Hacer login automático después del registro
      try {
        await login({ username: values.username, password: values.password });
        rememberSession();

        showStatus(
          statusElement,
          "Redirigiendo a la evaluación inicial…",
          "success",
        );

        if (typeof onSuccess === "function") {
          onSuccess();
        } else {
          setTimeout(() => {
            window.location.assign("/dashboard-parent.html");
          }, 800);
        }
      } catch (loginError) {
        // Si falla el login automático, redirigir a login manual
        console.error("Error en login automático:", loginError);
        showStatus(
          statusElement,
          "Cuenta creada. Por favor, inicia sesión.",
          "success",
        );
        setTimeout(() => {
          window.location.assign("/login.html");
        }, 1200);
      }
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Ocurrió un problema al crear tu cuenta.";
      showStatus(statusElement, message, "error");
      submitButton?.removeAttribute("disabled");
    }
  });
};

const initLoginForm = ({ formId, statusId, submitId, onSuccess } = {}) => {
  const form = document.getElementById(formId);
  const statusElement = document.getElementById(statusId);
  const submitButton = document.getElementById(submitId);
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { valid, values } = validateLogin(form);
    if (!valid) return;

    submitButton?.setAttribute("disabled", "true");
    showStatus(statusElement, "Estamos verificando tus datos…");

    try {
      const response = await login(values);
      rememberSession();
      showStatus(
        statusElement,
        "¡Bienvenida/o de nuevo! Redirigiendo…",
        "success",
      );

      const data = await response.json();
      const role = data.role;

      if (typeof onSuccess === "function") {
        onSuccess(role);
      } else {
        setTimeout(() => {
          if (role === 'Padre' || role === 'parent') {
            window.location.assign("/dashboard-parent.html");
          } else if (role === 'Médico' || role === 'medical' || role === 'specialist') { // Accommodate likely schema values
            window.location.assign("/portal-specialist.html");
          } else if (role === 'Hijo' || role === 'child') {
            window.location.assign("/app/index.html"); // Or wherever the child app lives
          } else {
            window.location.assign("/app/index.html"); // Fallback
          }
        }, 600);
      }
    } catch (error) {
      console.error(error); // Debug
      const message =
        error instanceof ApiError
          ? error.message
          : "No pudimos iniciar sesión. Intenta de nuevo.";
      showStatus(statusElement, message, "error");
    } finally {
      submitButton?.removeAttribute("disabled");
    }
  });
};

const initLogoutButton = (buttonId) => {
  const button = document.getElementById(buttonId);
  if (!button) return;
  button.addEventListener("click", async () => {
    button.setAttribute("disabled", "true");
    button.textContent = "Cerrando sesión…";
    try {
      await logout();
    } catch (error) {
      console.error("No se pudo cerrar la sesión", error);
      button.removeAttribute("disabled");
      button.textContent = "Cerrar sesión";
    }
  });
};

// GLOBAL LOGOUT SYNC
const authChannel = new BroadcastChannel('auth_channel');
authChannel.onmessage = (event) => {
  if (event.data === 'logout') {
    // Received logout signal from another tab
    console.log("Logged out from another tab");
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('child_session_token'); // Clear child token too
    window.location.assign("/index.html");
  }
};

const logout = async () => {
  // Notify other tabs
  authChannel.postMessage('logout');

  await post("/api/logout", {});
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('child_session_token');
  window.location.assign("/index.html");
};

const SESSION_COOKIE_NAME = SESSION_KEY;

export {
  login,
  register,
  logout,
  initRegisterForm,
  initLoginForm,
  initLogoutButton,
  requireSession,
  hasActiveSession,
  SESSION_COOKIE_NAME
};

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
      password,
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
  return post("/api/login", payload);
};

const logout = async () => {
  await post("/api/logout", {});
  localStorage.removeItem(SESSION_KEY);
  window.location.assign("/login.html");
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
      await register(values);
      showStatus(
        statusElement,
        "¡Tu cuenta está lista! Revisa tu correo para confirmar.",
        "success",
      );
      if (typeof onSuccess === "function") {
        onSuccess();
      } else {
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
    } finally {
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
      await login(values);
      rememberSession();
      showStatus(
        statusElement,
        "¡Bienvenida/o de nuevo! Redirigiendo…",
        "success",
      );
      if (typeof onSuccess === "function") {
        onSuccess();
      } else {
        setTimeout(() => {
          window.location.assign("/app.html");
        }, 600);
      }
    } catch (error) {
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

export {
  login,
  register,
  logout,
  initRegisterForm,
  initLoginForm,
  initLogoutButton,
  requireSession,
  hasActiveSession,
};

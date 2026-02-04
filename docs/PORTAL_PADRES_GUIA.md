# Portal de Padres - Guía de Uso

## 🎯 Resumen del Sistema

El portal de padres te permite:
- Ver métricas en tiempo real del progreso de tu hijo/a
- Analizar actividades completadas (matemáticas, escritura, pronunciación)
- Revisar la evaluación inicial
- Monitorear tendencias de aprendizaje

---

## 🚀 Configuración Inicial

### 1. Configurar Contraseña Parental (Primera vez)

Como padre/madre, necesitas configurar una contraseña de seguridad que es **diferente** a la contraseña del niño.

**Opción A: Desde la cuenta del niño (recomendado)**

Puedes crear un endpoint o página para que cuando el niño se registre, automáticamente se configure la contraseña parental.

**Opción B: Mediante API**

```javascript
// Ejemplo: llamar desde el registro del niño
await fetch('/api/parent-setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
        parentPassword: 'contraseña_segura_padres'
    })
});
```

### 2. Acceder al Portal

1. Ve a: **`/parent-login.html`**
2. Ingresa el **usuario del niño** (mismo que usa para jugar)
3. Ingresa tu **contraseña parental** (la que configuraste)
4. Serás redirigido al dashboard de métricas

---

## 📊 Métricas Disponibles

### Métricas Principales (Tarjetas Superiores)

| Métrica | Descripción | Fuente |
|---------|-------------|--------|
| ⭐ **Estrellas Totales** | Logros acumulados en todas las actividades | Base de datos |
| ⚡ **Nivel de Energía** | Motivación actual (0-10) | Base de datos |
| 🔥 **Racha de Días** | Días consecutivos con actividades | Base de datos |
| 🎯 **Actividades Completadas** | Total de ejercicios realizados | Base de datos |
| ⏱️ **Tiempo de Juego** | Horas/minutos totales jugando | Base de datos |
| 📅 **Última Actividad** | Cuándo y qué tipo de actividad | Base de datos |

### Gráfica de Actividades por Tipo

Muestra la distribución de actividades en los últimos 7 días:
- 🔢 Matemáticas
- ✍️ Escritura
- 🗣️ Pronunciación
- 📚 Lenguaje (misiones)
- 🧘 Sensorial (pausas)

### Actividades Recientes

Lista las últimas 50 actividades con:
- ✓ Correctas / ✗ Incorrectas
- Estrellas ganadas
- Tiempo relativo (hace 5 min, hace 2 horas, etc.)
- Filtros por tipo de actividad

### Evaluación Inicial

Si el niño completó el assessment inicial, muestra:
- 📖 Nivel de Lectura
- 🔤 Nivel Fonológico
- 🔢 Nivel Matemático
- ✍️ Nivel de Escritura

---

## 🔧 Arquitectura Técnica

### Base de Datos (D1)

**Tablas Creadas:**

1. **`parent_accounts`**: Almacena contraseñas parentales vinculadas a cuentas de niños
2. **`activity_metrics`**: Cada interacción del niño (problema matemático, palabra escrita, etc.)
3. **`daily_metrics`**: Métricas agregadas por día (optimización)
4. **`user_current_state`**: Snapshot del estado actual (estrellas, energía, racha)
5. **`student_complete_metrics`**: Vista consolidada de todas las métricas

### Endpoints API

**`/api/parent-login`** (POST)
- Autentica a padres usando contraseña parental
- Retorna cookie de sesión con rol 'parent'

**`/api/parent-setup`** (POST)
- Configura/actualiza contraseña parental
- Requiere sesión activa del niño

**`/api/metrics`** (POST)
- Guarda nueva métrica de actividad
- Actualiza automáticamente daily_metrics y user_current_state

**`/api/metrics`** (GET)
- Parámetros: `?type=current|daily|activities|complete&days=30`
- Retorna métricas según el tipo solicitado

### Sincronización Automática

Cada vez que el niño completa una actividad:

1. **`/frontend/app/index.html`** (juegos principales)
   - Matemáticas, Escritura, Pronunciación
   - Función: `saveMetricToDatabase()`

2. **`/frontend/scripts/child-app.js`** (sistema de misiones)
   - Lenguaje, Sensorial, Laboratorio numérico
   - Función: `syncMetricsToDatabase()`

Ambos envían a `/api/metrics` con:
```json
{
  "activityType": "math",
  "activityName": "Problema Matemático",
  "starsEarned": 3,
  "energyChange": 1,
  "isCorrect": true,
  "challengeData": { "challenge": "5 + 3" },
  "userResponse": { "response": "8" }
}
```

---

## 🎨 Sistema de Juegos Actualizado

### Juegos Disponibles (coinciden con assessment)

| Juego | Tipo | Habilidad |
|-------|------|-----------|
| ➕ **Matemáticas** | Adaptativo con IA | Cálculo básico, suma/resta/multiplicación |
| ✏️ **Escritura** | Adaptativo con IA | Ortografía, dictado |
| 🎤 **Habla** | Reconocimiento de voz | Pronunciación, fonología |
| 📚 **Historias con ritmo** | Misiones | Comprensión lectora, lenguaje |
| 🧘 **Pausa arcoíris** | Misiones | Regulación sensorial |
| 🔢 **Laboratorio numérico** | Misiones | Conteo, operaciones básicas |

### Adaptación por Rendimiento

Los juegos principales (Math, Write, Speak) se adaptan automáticamente:
- **Alto rendimiento** → Incrementa dificultad
- **Bajo rendimiento** → Simplifica ejercicios
- **Sin historial** → Nivel básico inicial

---

## 📱 Flujo de Usuario

### Para Padres:
1. Niño se registra con usuario/contraseña
2. Sistema crea cuenta parental (necesita configurar contraseña parental)
3. Niño juega y completa actividades → métricas se guardan automáticamente
4. Padre accede a `/parent-login.html` con usuario del niño + contraseña parental
5. Ve dashboard completo en `/parents.html`

### Para Niños:
1. Login normal en `/login.html`
2. Juega en `/app/index.html`
3. Cada actividad envía métricas a la base de datos
4. Métricas se acumulan para el portal de padres

---

## 🔐 Seguridad

- **Dos contraseñas separadas**: Una para el niño, otra para padres
- **Sesiones diferenciadas**: Las sesiones de padres incluyen claim `role: 'parent'`
- **Protección de datos**: Solo el padre del niño específico puede ver sus métricas
- **Verificación PBKDF2**: Contraseñas hasheadas con 100k iteraciones

---

## 🚦 Próximos Pasos

### Para activar el sistema:

1. **Aplicar migración**:
```bash
cd frontend
npx wrangler d1 execute eduplay-db --file=migrations/0005_create_parent_accounts_and_metrics.sql
```

2. **Configurar contraseña parental** para usuarios existentes:
   - Necesitarás crear una página o flujo para que padres configuren su contraseña
   - O usar el endpoint `/api/parent-setup` manualmente

3. **Probar el flujo**:
   - Crear cuenta de niño
   - Configurar contraseña parental
   - Jugar algunas actividades
   - Acceder al portal de padres

---

## 📈 Visualización de Métricas

El portal usa gráficos de barras CSS puro (sin librerías externas) para:
- Mantener la página ligera
- Evitar dependencias
- Garantizar compatibilidad

Si necesitas gráficos más avanzados, puedes integrar:
- Chart.js
- Recharts
- D3.js

---

## 🎯 Mejoras Futuras

1. **Exportar reportes PDF** con métricas del niño
2. **Notificaciones push** cuando el niño complete actividades
3. **Comparativas** con otros niños de la misma edad (anónimas)
4. **Recomendaciones IA** basadas en el progreso
5. **Objetivos personalizables** por los padres
6. **Integración con calendarios** para programar sesiones

---

## ❓ FAQ

**P: ¿Puedo cambiar la contraseña parental?**
R: Sí, vuelve a llamar `/api/parent-setup` con la nueva contraseña.

**P: ¿Qué pasa si olvido la contraseña parental?**
R: Necesitarás implementar un sistema de recuperación (email, preguntas de seguridad, etc.).

**P: ¿Las métricas se sincronizan en tiempo real?**
R: Sí, cada actividad completada se guarda inmediatamente en la base de datos.

**P: ¿Puedo ver métricas de varios niños?**
R: Necesitarías vincular múltiples cuentas a una cuenta parental (feature por implementar).

---

## 📞 Soporte

Para dudas técnicas o sugerencias:
- Email: hola@eduplay.app
- Repositorio: Crea un issue en GitHub


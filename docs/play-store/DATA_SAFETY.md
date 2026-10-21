# Formulario de Seguridad de los Datos (Data Safety) — SpaceTracker

Este documento contiene las respuestas recomendadas para rellenar el formulario de **Seguridad de los datos** en Google Play Console para la aplicación **SpaceTracker**.

---

### 1. ¿Recopila o comparte la aplicación datos de los usuarios?
- **Respuesta:** **Sí**, la aplicación recopila datos de ubicación aproximada o precisa (solo si el usuario concede el permiso de geolocalización o introduce su ciudad).

### 2. ¿Se cifran los datos en tránsito?
- **Respuesta:** **Sí**. Todas las comunicaciones de red (descarga de TLEs, clima y teselas de mapas) se realizan exclusivamente mediante **HTTPS cifrado (TLS 1.2 o superior)**.

### 3. ¿Ofrece la aplicación la posibilidad de eliminar los datos?
- **Respuesta:** **Sí**. Como todos los datos (ubicación del observador, favoritos y preferencias) se almacenan localmente en el dispositivo (`localStorage`), el usuario puede borrarlos en cualquier momento borrando los datos de la aplicación desde la configuración de Android o desinstalándola.

### 4. Detalle de Datos Recopilados:
| Tipo de Dato | Recopilado | Compartido | Propósito | Cifrado en tránsito |
|---|---|---|---|---|
| **Ubicación** (Precisa o aproximada) | Sí (Opcional) | No | Funcionalidad de la app (cálculo de pases y radar local) | Sí (HTTPS) |
| **Identificadores / Datos personales** | No | No | N/A | N/A |
| **Historial de navegación / Actividad** | No | No | N/A | N/A |

### 5. Declaraciones adicionales de Google Play:
- **Público objetivo:** No está dirigida a niños (clasificación general / apto para todo público).
- **Publicidad:** La aplicación **no contiene anuncios** ni SDKs de publicidad.
- **Acceso a la app:** No requiere inicio de sesión ni registro de cuenta de usuario.
- **Gobierno / Cumplimiento:** No es una app gubernamental oficial.

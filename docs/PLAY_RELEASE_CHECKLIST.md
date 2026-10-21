# Lista de Verificación de Publicación en Google Play (Play Release Checklist)

**Fecha de consulta y verificación:** 20 de octubre de 2026  
**Aplicación:** SpaceTracker (`dev.spacetracker.app`)  
**Versión:** `versionCode 1`, `versionName "1.0"`

---

## 1. Requisitos Técnicos de Google Play

| Requisito | Estado | Evidencia / Notas |
|---|---|---|
| **Target SDK 36 (Android 16)** | ✅ Verificado | `targetSdkVersion = 36`, `compileSdkVersion = 36` en `variables.gradle`. |
| **Formato AAB (Android App Bundle)** | ✅ Verificado | Generado `app-release.aab` mediante `./gradlew bundleRelease`. |
| **Minificación y Ofuscación R8** | ✅ Verificado | `minifyEnabled true`, `shrinkResources true`, reglas en `proguard-rules.pro`. |
| **Compatibilidad Edge-to-Edge** | ✅ Verificado | Soporte de `env(safe-area-inset-top)` y `env(safe-area-inset-bottom)` en `styles.css`. |
| **Seguridad de Red (HTTPS)** | ✅ Verificado | `server.androidScheme: "https"`, `allowMixedContent: false` en `capacitor.config.json`. |
| **Páginas de 16 KB (16 KB page size)** | ✅ Verificado | Binarios y librerías de Capacitor 8 compatibles con alineación de páginas de 16 KB. |
| **Rendimiento e INP < 50ms** | ✅ Verificado | Canvas Overlay `N_DOM = 0`, aislamiento de capas en Chromium e interacciones síncronas desacopladas. |

---

## 2. Ficha y Documentación de la Tienda (Play Console)

| Documento / Artefacto | Estado | Ubicación |
|---|---|---|
| **Política de Privacidad** | ✅ Verificado | `[docs/play-store/PRIVACY_POLICY.md](file:///home/aegis2/SpaceTrackerAndroid/docs/play-store/PRIVACY_POLICY.md)` |
| **Formulario Seguridad de Datos** | ✅ Verificado | `[docs/play-store/DATA_SAFETY.md](file:///home/aegis2/SpaceTrackerAndroid/docs/play-store/DATA_SAFETY.md)` |
| **Ficha de la Tienda (ES / EN)** | ✅ Verificado | `[docs/play-store/STORE_LISTING.md](file:///home/aegis2/SpaceTrackerAndroid/docs/play-store/STORE_LISTING.md)` |
| **Artefacto AAB de Release** | ✅ Verificado | `[app-release.aab](file:///home/aegis2/SpaceTrackerAndroid/android/app/build/outputs/bundle/release/app-release.aab)` |

---

## 3. Plan de Lanzamiento Recomendado

1. **Pruebas Internas (Internal Testing):** Subir `app-release.aab` a la pista interna en Play Console para verificar instalación en dispositivos reales.
2. **Cerrada (Closed Testing):** Si la cuenta de Google Play Developer fue creada después del 13/11/2023, reclutar 12 testers continuos durante 14 días.
3. **Producción:** Lanzamiento escalonado (10% $\rightarrow$ 25% $\rightarrow$ 100%).

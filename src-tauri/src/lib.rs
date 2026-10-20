//! SpaceTracker — punto de entrada Tauri v2 (desktop y móvil).
//!
//! La WebView nativa (WebView2 / WKWebView / WebKitGTK) compone por GPU por
//! defecto: los filtros `drop-shadow`, `backdrop-filter` y las animaciones
//! `transform` del HUD se aceleran por hardware sin configuración extra.
//! En Linux con GPUs caprichosas, si hubiera parpadeo de composición,
//! ejecutar con `WEBKIT_DISABLE_DMABUF_RENDERER=1`.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

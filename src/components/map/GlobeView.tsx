/**
 * GlobeView — globo terráqueo en PROYECCIÓN ORTOGRÁFICA 2D con respiración canvas y alto rendimiento.
 *
 * Garantía SIN rotación perpetua: el globo está ESTÁTICO por defecto; el giro
 * es explícito (botón «Girar») y el centrado solo ocurre con lock de seguimiento.
 *
 * Rendimiento (2026-10-30): la flota se dibuja agrupada por color SIN shadowBlur
 * por punto (antes ~15k save/shadow/restore → FPS 1).
 */

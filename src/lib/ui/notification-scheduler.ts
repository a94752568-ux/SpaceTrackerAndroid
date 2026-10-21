/**
 * NotificationScheduler — interfaz para programación de notificaciones.
 *
 * Esta capa prepara la arquitectura para notificaciones de pases satelitales.
 * En Android nativo (Capacitor), esto debería usar WorkManager para
 * notificaciones fiables incluso cuando la app está en segundo plano.
 *
 * Implementación actual: STUB que registra en consola.
 * Futuro: integrar con @capacitor/local-notifications o bridge nativo.
 */

import type { Pass } from "../space/types";

export interface NotificationSchedule {
  /** ID único de la notificación */
  id: string;
  /** NORAD ID del satélite */
  satId: number;
  /** Nombre del satélite */
  satName: string;
  /** Instante del pase (epoch ms UTC) */
  passTime: number;
  /** Minutos antes del pase para notificar */
  minutesBefore: number;
  /** Título de la notificación */
  title: string;
  /** Cuerpo de la notificación */
  body: string;
  /** Datos adicionales para deep link */
  data?: Record<string, unknown>;
}

export interface NotificationSchedulerOptions {
  /** Si true, programa notificaciones para 10, 5 y 1 minuto antes */
  enablePrePassAlerts?: boolean;
  /** Si true, permite notificaciones cuando la app está en segundo plano */
  enableBackground?: boolean;
}

/**
 * Programador de notificaciones.
 *
 * Implementación actual: stub que simula programación.
 * Futuro: usar Capacitor Local Notifications o bridge nativo Android.
 */
export class NotificationScheduler {
  private scheduled = new Map<string, NotificationSchedule>();
  private enabled = false;

  /**
   * Inicializa el programador de notificaciones.
   *
   * En Android nativo, esto debería:
   * - Solicitar permisos de notificación
   * - Configurar canales de notificación
   * - Inicializar WorkManager si se usa backend nativo
   */
  async initialize(opts: NotificationSchedulerOptions = {}): Promise<void> {
    // STUB: en implementación real, solicitar permisos aquí
    this.enabled = opts.enableBackground ?? false;
    console.log("[NotificationScheduler] initialized", opts);
  }

  /**
   * Programa notificaciones para un pase específico.
   *
   * @param pass - Pase orbital
   * @param satName - Nombre del satélite
   * @param satId - NORAD ID
   * @param opts - Opciones de programación
   */
  async schedulePass(
    pass: Pass,
    satName: string,
    satId: number,
    opts: NotificationSchedulerOptions = {},
  ): Promise<void> {
    if (!this.enabled) {
      console.log("[NotificationScheduler] not enabled, skipping schedule");
      return;
    }

    const alerts = opts.enablePrePassAlerts !== false ? [10, 5, 1] : [];

    for (const minutesBefore of alerts) {
      const notifyTime = pass.aosMs - minutesBefore * 60_000;
      if (notifyTime < Date.now()) continue; // Ya pasó

      const schedule: NotificationSchedule = {
        id: `${satId}-${pass.aosMs}-${minutesBefore}m`,
        satId,
        satName,
        passTime: pass.aosMs,
        minutesBefore,
        title: `${satName} visible en ${minutesBefore} min`,
        body: `Elevación máxima: ${pass.maxElDeg.toFixed(1)}° · Duración: ${pass.durationMin.toFixed(0)} min`,
        data: { satId, passTime: pass.aosMs },
      };

      this.scheduled.set(schedule.id, schedule);

      // STUB: en implementación real, programar notificación nativa aquí
      console.log("[NotificationScheduler] scheduled", schedule);
    }
  }

  /**
   * Programa notificaciones para múltiples pases (útil para favoritos).
   *
   * @param passes - Array de pases
   * @param satName - Nombre del satélite
   * @param satId - NORAD ID
   * @param opts - Opciones de programación
   */
  async scheduleBatch(
    passes: Pass[],
    satName: string,
    satId: number,
    opts: NotificationSchedulerOptions = {},
  ): Promise<void> {
    for (const pass of passes) {
      await this.schedulePass(pass, satName, satId, opts);
    }
  }

  /**
   * Cancela una notificación programada.
   *
   * @param id - ID de la notificación
   */
  async cancel(id: string): Promise<void> {
    this.scheduled.delete(id);
    console.log("[NotificationScheduler] cancelled", id);
    // STUB: en implementación real, cancelar notificación nativa aquí
  }

  /**
   * Cancela todas las notificaciones para un satélite.
   *
   * @param satId - NORAD ID del satélite
   */
  async cancelAllForSat(satId: number): Promise<void> {
    const toDelete: string[] = [];
    for (const [id, schedule] of this.scheduled.entries()) {
      if (schedule.satId === satId) {
        toDelete.push(id);
      }
    }
    for (const id of toDelete) {
      await this.cancel(id);
    }
  }

  /**
   * Cancela todas las notificaciones programadas.
   */
  async cancelAll(): Promise<void> {
    const ids = Array.from(this.scheduled.keys());
    for (const id of ids) {
      await this.cancel(id);
    }
  }

  /**
   * Devuelve todas las notificaciones programadas.
   */
  getScheduled(): NotificationSchedule[] {
    return Array.from(this.scheduled.values());
  }

  /**
   * Devuelve notificaciones programadas para un satélite específico.
   */
  getScheduledForSat(satId: number): NotificationSchedule[] {
    return Array.from(this.scheduled.values()).filter((s) => s.satId === satId);
  }

  /**
   * Limpia notificaciones expiradas (cuyo pase ya pasó).
   */
  async pruneExpired(): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];
    for (const [id, schedule] of this.scheduled.entries()) {
      if (schedule.passTime < now) {
        toDelete.push(id);
      }
    }
    for (const id of toDelete) {
      await this.cancel(id);
    }
  }

  /**
   * Verifica si el programador está habilitado.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Habilita o deshabilita el programador.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log("[NotificationScheduler] enabled =", enabled);
  }
}

/**
 * Instancia singleton para uso en toda la aplicación.
 */
export const notificationScheduler = new NotificationScheduler();

/**
 * Bridge para integración con Capacitor/Android nativo.
 *
 * Esta interfaz define cómo se conectaría con WorkManager en Android.
 * Documentación para implementación futura:
 *
 * 1. Crear plugin nativo de Capacitor que exponga:
 *    - scheduleNotification(options): programa notificación
 *    - cancelNotification(id): cancela notificación
 *    - cancelAll(): cancela todas
 *
 * 2. En Android, usar WorkManager con constraints:
 *    - NetworkType.NOT_REQUIRED
 *    - BatteryNotLow
 *    - DeviceIdle (opcional)
 *
 * 3. Crear canal de notificación con importancia HIGH para pases.
 *
 * 4. Usar AlarmManager para precisión en alertas críticas (1 min antes).
 */
export interface NativeNotificationBridge {
  schedule(options: NotificationSchedule): Promise<void>;
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  requestPermission(): Promise<boolean>;
}

/**
 * Implementación stub del bridge nativo.
 */
export const nativeNotificationBridge: NativeNotificationBridge = {
  async schedule(options: NotificationSchedule): Promise<void> {
    console.log("[NativeBridge] STUB: schedule", options);
  },
  async cancel(id: string): Promise<void> {
    console.log("[NativeBridge] STUB: cancel", id);
  },
  async cancelAll(): Promise<void> {
    console.log("[NativeBridge] STUB: cancelAll");
  },
  async requestPermission(): Promise<boolean> {
    console.log("[NativeBridge] STUB: requestPermission");
    return true;
  },
};

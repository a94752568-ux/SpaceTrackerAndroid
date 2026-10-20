/**
 * Bus de eventos de telemetría (Flight Log).
 *
 * Diseño de rendimiento: el buffer vive FUERA de React (singleton). Solo el
 * componente consola se suscribe, así ningún evento re-renderiza el mapa ni
 * los paneles. Buffer anular con tope (400 en store / 200 en vista).
 *
 * Niveles y código de color (styles.css):
 *   SYS   gris técnico   — sistema, tiempo, paneles, observador
 *   ORBIT cian           — motor SGP4: selección, telemetría, pases
 *   TLE   verde          — sincronización/edad de elementos TLE
 *   WARN  naranja suave  — degradaciones (fuente caída, TLE viejo)
 *   ALRT  naranja SpaceX — alertas (fallback seed, AOS de un pase)
 */
import { useEffect, useState } from "react";

export const LOG_LEVELS = ["SYS", "ORBIT", "TLE", "WARN", "ALRT"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LogEvent {
  id: number;
  tMs: number;
  level: LogLevel;
  msg: string;
}

const STORE_CAP = 400;
const VIEW_CAP = 200;

export class TelemetryLogStore {
  private buf: LogEvent[] = [];
  private seq = 0;
  private listeners = new Set<(e: LogEvent) => void>();

  push(level: LogLevel, msg: string, tMs: number = Date.now()): LogEvent {
    const e: LogEvent = { id: ++this.seq, tMs, level, msg };
    this.buf.push(e);
    if (this.buf.length > STORE_CAP) this.buf.splice(0, this.buf.length - STORE_CAP);
    this.listeners.forEach((fn) => fn(e));
    return e;
  }

  subscribe(fn: (e: LogEvent) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  snapshot(): LogEvent[] {
    return [...this.buf];
  }

  clear(): void {
    this.buf = [];
    this.push("SYS", "consola purgada por el operador");
  }
}

export const teleLog = new TelemetryLogStore();

/** Hook de suscripción: solo el componente que lo usa se re-renderiza. */
export function useTelemetryLog(): LogEvent[] {
  const [events, setEvents] = useState<LogEvent[]>(() => teleLog.snapshot());
  useEffect(
    () =>
      teleLog.subscribe((e) => {
        setEvents((prev) => {
          const next = prev.length >= VIEW_CAP ? prev.slice(prev.length - VIEW_CAP + 1) : prev.slice();
          next.push(e);
          return next;
        });
      }),
    [],
  );
  return events;
}

/** Marca de tiempo UTC hh:mm:ssZ para la consola. */
export function fmtUtc(tMs: number): string {
  return `${new Date(tMs).toISOString().slice(11, 19)}Z`;
}

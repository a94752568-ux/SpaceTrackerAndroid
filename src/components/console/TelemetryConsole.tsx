/**
 * Consola de telemetría inferior (Flight Log): cajón colapsable estilo
 * terminal de lanzamiento con flujo de eventos UTC codificado por nivel.
 *
 * Rendimiento: única suscriptora del bus `teleLog`; el mapa y los paneles no
 * se re-renderizan por eventos de consola. Auto-scroll solo si el operador
 * tiene el scroll anclado al final.
 */
import { useEffect, useRef, useState } from "react";

import {
  fmtUtc,
  LOG_LEVELS,
  teleLog,
  useTelemetryLog,
  type LogLevel,
} from "../../lib/ui/telemetry-log";

interface TelemetryConsoleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TelemetryConsole({ open, onOpenChange }: TelemetryConsoleProps) {
  const events = useTelemetryLog();
  const [filters, setFilters] = useState<Set<LogLevel>>(() => new Set(LOG_LEVELS));
  const [clock, setClock] = useState(() => fmtUtc(Date.now()));
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);

  /* Reloj UTC de la cabecera (aislado: solo re-renderiza esta consola). */
  useEffect(() => {
    const id = window.setInterval(() => setClock(fmtUtc(Date.now())), 1000);
    return () => window.clearInterval(id);
  }, []);

  /* Auto-scroll si está anclada al final. */
  useEffect(() => {
    const el = bodyRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [events, open]);

  const visible = events.filter((e) => filters.has(e.level));
  const warns = events.filter((e) => e.level === "WARN" || e.level === "ALRT").length;

  const toggleFilter = (lv: LogLevel) =>
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(lv)) next.delete(lv);
      else next.add(lv);
      return next;
    });

  return (
    <section className={open ? "st-console open hud-panel" : "st-console hud-panel"} aria-label="Consola de telemetría">
      <button className="st-console-head" onClick={() => onOpenChange(!open)} aria-expanded={open}>
        <span className="st-console-title">▮ FLIGHT LOG · TELEMETRÍA</span>
        <span className="st-console-count">
          {visible.length} ev{warns > 0 ? ` · ${warns} WARN/ALRT` : ""}
        </span>
        <span className="st-console-clock">{clock}</span>
        <span className="st-chevron">{open ? "▾" : "▸"}</span>
      </button>
      <div
        className="st-console-body"
        ref={bodyRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinnedRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
        }}
      >
        {visible.length === 0 && (
          <div className="st-log st-log-SYS">
            <span className="st-log-t">{clock}</span>
            <span className="st-log-l">[SYS]</span>
            <span className="st-log-m">sin eventos todavía — el flujo arranca con la sincronización TLE</span>
          </div>
        )}
        {visible.map((e) => (
          <div key={e.id} className={`st-log st-log-${e.level}`}>
            <span className="st-log-t">{fmtUtc(e.tMs)}</span>
            <span className="st-log-l">[{e.level}]</span>
            <span className="st-log-m">{e.msg}</span>
          </div>
        ))}
      </div>
      <div className="st-console-foot">
        {LOG_LEVELS.map((lv) => (
          <button
            key={lv}
            className={filters.has(lv) ? `st-logfilter on st-logfilter-${lv}` : `st-logfilter st-logfilter-${lv}`}
            onClick={() => toggleFilter(lv)}
            title={`Mostrar/ocultar ${lv}`}
          >
            {lv}
          </button>
        ))}
        <span className="st-spacer" />
        <button className="st-logfilter" onClick={() => teleLog.clear()} title="Purgar buffer">
          CLEAR
        </button>
      </div>
    </section>
  );
}

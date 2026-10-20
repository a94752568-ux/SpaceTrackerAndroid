/**
 * Cliente del worker SGP4: single-flight con semántica latest-wins y fallback
 * síncrono automático si el entorno no tiene Worker (SSR, tests, onerror).
 *
 * - request(tMs) nunca acumula backlog: si llega un pedido nuevo antes de la
 *   respuesta anterior, el pendiente se resuelve con `null` y se descarta.
 * - Los frames vuelven como Float64Array/Int32Array transferidos (zero-copy).
 */
import { computeFleet, idsOf, type FleetSat } from "./fleet-compute";
import type { Sat } from "./types";

export interface FleetFrame {
  tMs: number;
  ids: Int32Array;
  data: Float64Array;
}

export class FleetClient {
  private worker: Worker | null = null;
  private catalog: FleetSat[] = [];
  private seq = 0;
  private lastSeq = 0;
  private waiter: ((f: FleetFrame | null) => void) | null = null;

  constructor() {
    if (typeof Worker === "undefined") return;
    try {
      this.worker = new Worker(new URL("../../workers/sgp4.worker.ts", import.meta.url), {
        type: "module",
      });
      this.worker.onmessage = (e: MessageEvent) => {
        const m = e.data as { type: string; seq: number; tMs: number; data: Float64Array; ids: Int32Array };
        if (m.type === "positions" && m.seq > this.lastSeq) {
          this.lastSeq = m.seq;
          const w = this.waiter;
          this.waiter = null;
          w?.({ tMs: m.tMs, ids: m.ids, data: m.data });
        }
      };
      this.worker.onerror = () => {
        // Worker roto → degradar a cálculo síncrono sin romper la UI.
        this.worker?.terminate();
        this.worker = null;
      };
    } catch {
      this.worker = null;
    }
  }

  get usingWorker(): boolean {
    return this.worker !== null;
  }

  setCatalog(sats: Sat[]): void {
    this.catalog = sats.map((s) => ({ id: s.id, line1: s.line1, line2: s.line2 }));
    this.worker?.postMessage({ type: "init", sats: this.catalog });
  }

  request(tMs: number): Promise<FleetFrame | null> {
    if (!this.worker) {
      return Promise.resolve({
        tMs,
        ids: idsOf(this.catalog),
        data: computeFleet(this.catalog, tMs),
      });
    }
    // latest-wins: descarta el pedido anterior sin responder.
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w(null);
    }
    const s = ++this.seq;
    this.worker.postMessage({ type: "compute", seq: s, tMs });
    return new Promise((resolve) => {
      this.waiter = resolve;
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.waiter = null;
  }
}

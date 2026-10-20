/**
 * Web Worker dedicado al SGP4 masivo de la flota.
 *
 * Protocolo (postMessage):
 *   main → worker  { type: "init",    sats: FleetSat[] }          (catálogo)
 *   main → worker  { type: "compute", seq: number, tMs: number }  (pedido)
 *   worker → main  { type: "positions", seq, tMs, data: Float64Array, ids: Int32Array }
 *                  (buffers TRANSFERIBLES: zero-copy de vuelta al hilo principal)
 *
 * El worker mantiene su propia caché de SatRecs (clave id:line1:line2), así un
 * "init" repetido (radar on/off, búsqueda) no reparsea TLEs inalterados.
 */
import { computeFleet, idsOf, type FleetSat } from "../lib/space/fleet-compute";

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (msg: unknown, transfer?: Transferable[]) => void;
};

let catalog: FleetSat[] = [];

ctx.onmessage = (e: MessageEvent) => {
  const m = e.data as
    | { type: "init"; sats: FleetSat[] }
    | { type: "compute"; seq: number; tMs: number };
  if (m.type === "init") {
    catalog = m.sats;
    return;
  }
  if (m.type === "compute") {
    const data = computeFleet(catalog, m.tMs);
    const ids = idsOf(catalog);
    ctx.postMessage(
      { type: "positions", seq: m.seq, tMs: m.tMs, data, ids },
      [data.buffer, ids.buffer],
    );
  }
};

/**
 * Shim mínimo de d3-array (ISC) con ÚNICAMENTE lo que consume d3-geo:
 * range, merge y Adder (suma compensada de Neumaier).
 * Evita venderizar d3-array completo e internmap.
 * Derivado de d3-array 3.2.4 (https://github.com/d3/d3-array, ISC).
 */
export function range(start, stop, step) {
  const nArgs = arguments.length;
  if (nArgs < 2) {
    stop = start;
    start = 0;
    step = 1;
  } else if (nArgs < 3) {
    step = 1;
  } else {
    step = Number(step);
  }
  start = Number(start);
  stop = Number(stop);
  const n = Math.max(0, Math.ceil((stop - start) / step)) | 0;
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = start + i * step;
  return out;
}

export function merge(arrays) {
  return Array.prototype.concat.apply([], arrays);
}

export class Adder {
  constructor() {
    this._s = 0;
    this._p = 0;
  }
  add(x) {
    const s = this._s;
    const p = this._p;
    const t = s + x;
    if (Math.abs(s) >= Math.abs(x)) this._p = p + (s - t + x);
    else this._p = p + (x - t + s);
    this._s = t;
    return this;
  }
  valueOf() {
    return this._s + this._p;
  }
}

/**
 * Validación estructural de TLE (dos líneas NORAD).
 *
 * Comprueba: ID NORAD, longitud exacta de 69 caracteres por línea, prefijos y
 * formato de campos, coincidencia del ID en los campos de ambas líneas y
 * checksum módulo 10 (los guiones cuentan como 1).
 */

export interface TleValidation {
  valid: boolean;
  errors: string[];
}

const LINE_LENGTH = 69;

/** Checksum TLE: suma módulo 10 de dígitos; '-' cuenta como 1; resto ignora. */
export function tleChecksum(line: string): number {
  let sum = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i];
    if (c >= "0" && c <= "9") sum += Number(c);
    else if (c === "-") sum += 1;
  }
  return sum % 10;
}

function isDigits(s: string): boolean {
  return s.length > 0 && /^[0-9]+$/.test(s);
}

/** Campo numérico de punto flotante TLE (admite espacios iniciales). */
function isTleFloat(s: string): boolean {
  const t = s.trim();
  if (t.length === 0) return false;
  return /^[+-]?\d*\.?\d+([eE][+-]?\d+)?$/.test(t) || /^[+-]?\.\d+$/.test(t);
}

/**
 * Campo "exponente TLE" tipo ` 12345-3` / `+12345-3` (mantisa + exponente pegados).
 */
function isTleExpField(s: string): boolean {
  const t = s.trim();
  return /^[+-]?\d+[+-]\d+$/.test(t);
}

export function validateTle(
  id: number | string,
  line1: string,
  line2: string,
): TleValidation {
  const errors: string[] = [];

  // --- ID NORAD ---
  const idNum = typeof id === "string" ? Number(id) : id;
  if (!Number.isInteger(idNum) || idNum < 1 || idNum > 99999) {
    errors.push(`ID NORAD inválido: ${String(id)}`);
  }

  if (typeof line1 !== "string" || typeof line2 !== "string") {
    return { valid: false, errors: [...errors, "Las líneas TLE deben ser cadenas"] };
  }

  // --- Longitud exacta ---
  if (line1.length !== LINE_LENGTH) {
    errors.push(`Línea 1: longitud ${line1.length}, esperada ${LINE_LENGTH}`);
  }
  if (line2.length !== LINE_LENGTH) {
    errors.push(`Línea 2: longitud ${line2.length}, esperada ${LINE_LENGTH}`);
  }
  if (errors.length > 0 && (line1.length < 43 || line2.length < 51)) {
    // Sin longitud mínima no se pueden inspeccionar campos.
    return { valid: false, errors };
  }

  // --- Prefijos y clasificación ---
  if (line1[0] !== "1") errors.push("Línea 1: debe comenzar con '1'");
  if (line2[0] !== "2") errors.push("Línea 2: debe comenzar con '2'");
  if (!"UCS".includes(line1[7])) {
    errors.push(`Línea 1: clasificación '${line1[7]}' no es U/C/S`);
  }

  // --- Coincidencia del ID en ambas líneas (columnas 3-7) ---
  const id1 = Number(line1.slice(2, 7).trim());
  const id2 = Number(line2.slice(2, 7).trim());
  if (!isDigits(line1.slice(2, 7).trim()) || Number.isNaN(id1)) {
    errors.push("Línea 1: número de satélite no numérico");
  } else if (Number.isInteger(idNum) && id1 !== idNum) {
    errors.push(`Línea 1: número ${id1} no coincide con el ID ${idNum}`);
  }
  if (!isDigits(line2.slice(2, 7).trim()) || Number.isNaN(id2)) {
    errors.push("Línea 2: número de satélite no numérico");
  } else if (Number.isInteger(idNum) && id2 !== idNum) {
    errors.push(`Línea 2: número ${id2} no coincide con el ID ${idNum}`);
  }

  // --- Línea 1: designador internacional, época, derivadas y bstar ---
  if (line1.length >= 17) {
    const launchYear = line1.slice(9, 11).trim();
    if (launchYear.length > 0 && !isDigits(launchYear)) {
      errors.push("Línea 1: año del designador internacional no numérico");
    }
  }
  if (line1.length >= 32) {
    const epochYear = line1.slice(18, 20);
    const epochDay = line1.slice(20, 32).trim();
    if (!isDigits(epochYear)) errors.push("Línea 1: año de época no numérico");
    if (!isTleFloat(epochDay)) errors.push("Línea 1: día de época no numérico");
  }
  if (line1.length >= 52 && !isTleFloat(line1.slice(33, 43).trim())) {
    errors.push("Línea 1: primera derivada del movimiento medio no numérica");
  }
  if (line1.length >= 59 && !isTleExpField(line1.slice(44, 52))) {
    errors.push("Línea 1: segunda derivada con formato inválido");
  }
  if (line1.length >= 64 && !isTleExpField(line1.slice(53, 61))) {
    errors.push("Línea 1: bstar con formato inválido");
  }

  // --- Línea 2: elementos orbitales ---
  if (line2.length >= 51) {
    const inc = line2.slice(8, 16).trim();
    const raan = line2.slice(17, 25).trim();
    const ecc = line2.slice(26, 33);
    const argp = line2.slice(34, 42).trim();
    const ma = line2.slice(43, 51).trim();
    if (!isTleFloat(inc) || Number(inc) < 0 || Number(inc) > 180) {
      errors.push("Línea 2: inclinación fuera de rango [0, 180]");
    }
    if (!isTleFloat(raan) || Number(raan) < 0 || Number(raan) >= 360) {
      errors.push("Línea 2: RAAN fuera de rango [0, 360)");
    }
    if (!isDigits(ecc)) {
      errors.push("Línea 2: excentricidad debe ser 7 dígitos (decimal implícito)");
    }
    if (!isTleFloat(argp) || Number(argp) < 0 || Number(argp) >= 360) {
      errors.push("Línea 2: argumento del perigeo fuera de rango [0, 360)");
    }
    if (!isTleFloat(ma) || Number(ma) < 0 || Number(ma) >= 360) {
      errors.push("Línea 2: anomalía media fuera de rango [0, 360)");
    }
  }
  if (line2.length >= 63) {
    const mm = line2.slice(52, 63).trim();
    if (!isTleFloat(mm) || Number(mm) <= 0) {
      errors.push("Línea 2: movimiento medio debe ser > 0");
    }
  }
  if (line2.length === LINE_LENGTH) {
    // Campo de revolución (columnas 64-68): los TLE reales pueden traerlo con
    // espacios iniciales (p. ej. GEO jóvenes como GOES 18: " 1345").
    const rev = line2.slice(63, 68).trim();
    if (rev.length > 0 && !isDigits(rev)) {
      errors.push("Línea 2: número de revolución no numérico");
    }
  }

  // --- Checksums ---
  if (line1.length === LINE_LENGTH) {
    const cs = Number(line1[68]);
    if (!isDigits(line1[68])) errors.push("Línea 1: checksum no es un dígito");
    else if (tleChecksum(line1) !== cs) {
      errors.push(`Línea 1: checksum incorrecto (esperado ${tleChecksum(line1)}, presente ${cs})`);
    }
  }
  if (line2.length === LINE_LENGTH) {
    const cs = Number(line2[68]);
    if (!isDigits(line2[68])) errors.push("Línea 2: checksum no es un dígito");
    else if (tleChecksum(line2) !== cs) {
      errors.push(`Línea 2: checksum incorrecto (esperado ${tleChecksum(line2)}, presente ${cs})`);
    }
  }

  return { valid: errors.length === 0, errors };
}

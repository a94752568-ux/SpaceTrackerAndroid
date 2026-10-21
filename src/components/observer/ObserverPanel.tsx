/**
 * Panel del observador: nombre, país, latitud, longitud, zona horaria y
 * elevación opcional. Precarga desde lugares conocidos o geolocalización.
 * La persistencia la gestiona App (localStorage).
 */
import { memo, useEffect, useState } from "react";

import type { Observer } from "../../lib/space/types";
import { PLACES } from "../../lib/ui/places";
import { availableTimezones } from "../../lib/ui/persistence";
import { fetchElevation } from "../../lib/ui/elevation";
import MoonWidget from "../hud/MoonWidget";

interface ObserverPanelProps {
  observer: Observer | null;
  onSave: (obs: Observer) => void;
  onClear: () => void;
  date: Date;
}

interface FormState {
  name: string;
  country: string;
  latitude: string;
  longitude: string;
  timezone: string;
  elevationM: string;
}

function toForm(obs: Observer | null): FormState {
  return {
    name: obs?.name ?? "",
    country: obs?.country ?? "",
    latitude: obs ? String(obs.latitude) : "",
    longitude: obs ? String(obs.longitude) : "",
    timezone: obs?.timezone ?? "UTC",
    elevationM: obs?.elevationM !== undefined ? String(obs.elevationM) : "",
  };
}

export function ObserverPanel({ observer, onSave, onClear, date }: ObserverPanelProps) {
  const [form, setForm] = useState<FormState>(() => toForm(observer));
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(observer === null);
  const [fetchingElevation, setFetchingElevation] = useState(false);
  const timezones = useState(availableTimezones)[0];

  useEffect(() => {
    setForm(toForm(observer));
  }, [observer]);

  // Obtener elevación manualmente (solo cuando el usuario lo solicita)
  const fetchElevationForCoords = async () => {
    const lat = Number(form.latitude);
    const lon = Number(form.longitude);
    
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setError("Coordenadas inválidas para obtener elevación.");
      return;
    }

    setFetchingElevation(true);
    const elev = await fetchElevation(lat, lon);
    if (elev != null) {
      setForm((f) => ({ ...f, elevationM: elev.toString() }));
    } else {
      setError("No se pudo obtener la elevación (límite de API o error de red).");
    }
    setFetchingElevation(false);
  };

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = Number(form.latitude);
    const lon = Number(form.longitude);
    if (!form.name.trim()) return setError("Indica un nombre para el observador.");
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return setError("Latitud fuera de rango (−90…90).");
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) return setError("Longitud fuera de rango (−180…180).");
    const elev = form.elevationM.trim() === "" ? undefined : Number(form.elevationM);
    if (elev !== undefined && (!Number.isFinite(elev) || elev < -500 || elev > 9000)) {
      return setError("Elevación opcional fuera de rango (−500…9000 m).");
    }
    setError(null);
    onSave({
      name: form.name.trim(),
      country: form.country.trim() || undefined,
      latitude: lat,
      longitude: lon,
      timezone: form.timezone,
      elevationM: elev,
    });
    setOpen(false);
  };

  const useGeolocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocalización no disponible en este navegador.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const alt = pos.coords.altitude;
        
        // Obtener elevación de Open-Meteo si el navegador no la proporciona
        let elevation: string | undefined;
        if (alt != null && Number.isFinite(alt)) {
          elevation = Math.round(alt).toString();
        } else {
          const apiElevation = await fetchElevation(lat, lon);
          if (apiElevation != null) {
            elevation = apiElevation.toString();
          }
        }
        
        setForm((f) => ({
          ...f,
          latitude: lat.toFixed(5),
          longitude: lon.toFixed(5),
          elevationM: elevation ?? f.elevationM,
          name: f.name || "Mi ubicación",
        }));
        setError(null);
      },
      () => setError("No se pudo obtener la ubicación (permiso denegado o no disponible)."),
      { timeout: 8000 },
    );
  };

  const applyPlace = (name: string) => {
    const p = PLACES.find((x) => x.name === name);
    if (!p) return;
    setForm({
      name: p.name,
      country: p.country ?? "",
      latitude: String(p.latitude),
      longitude: String(p.longitude),
      timezone: p.timezone,
      elevationM: p.elevationM !== undefined ? String(p.elevationM) : "",
    });
    setError(null);
  };

  return (
    <section className="st-observer">
      <button className="st-observer-head" onClick={() => setOpen((v) => !v)}>
        <h3>
          Observador {observer && !open ? `— ${observer.name}` : ""}
        </h3>
        <span>{open ? "▾" : "▸"}</span>
      </button>
      <MoonWidget date={date} />
      {open && (
        <form onSubmit={submit} className="st-observer-form">
          <div className="st-row">
            <label>
              Nombre
              <input value={form.name} onChange={set("name")} placeholder="p. ej. Casa, Observatorio…" />
            </label>
            <label>
              País (opcional)
              <input value={form.country} onChange={set("country")} placeholder="p. ej. España" />
            </label>
          </div>
          <div className="st-row">
            <label>
              Latitud (°)
              <input value={form.latitude} onChange={set("latitude")} inputMode="decimal" placeholder="40.4168" />
            </label>
            <label>
              Longitud (°)
              <input value={form.longitude} onChange={set("longitude")} inputMode="decimal" placeholder="-3.7038" />
            </label>
            <label>
              Elevación (m, opcional)
              <div className="st-input-with-btn">
                <input value={form.elevationM} onChange={set("elevationM")} inputMode="decimal" placeholder="667" />
                <button
                  type="button"
                  className="st-ghost"
                  onClick={fetchElevationForCoords}
                  disabled={fetchingElevation}
                  title="Obtener elevación desde API"
                >
                  {fetchingElevation ? "…" : "⬇"}
                </button>
              </div>
            </label>
          </div>
          <div className="st-row">
            <label className="st-grow">
              Zona horaria
              <select value={form.timezone} onChange={set("timezone")}>
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="st-row st-actions">
            <select
              defaultValue=""
              onChange={(e) => e.target.value && applyPlace(e.target.value)}
              aria-label="Lugares predefinidos"
            >
              <option value="" disabled>
                Lugares predefinidos…
              </option>
              {PLACES.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                  {p.country ? ` (${p.country})` : ""}
                </option>
              ))}
            </select>
            <button type="button" className="st-ghost" onClick={useGeolocation}>
              📍 Usar mi ubicación
            </button>
            <span className="st-spacer" />
            {observer && (
              <button type="button" className="st-ghost" onClick={onClear}>
                Borrar
              </button>
            )}
            <button type="submit" className="st-primary">
              Guardar observador
            </button>
          </div>
          {error && <p className="st-error">{error}</p>}
        </form>
      )}
    </section>
  );
}

export default memo(ObserverPanel);

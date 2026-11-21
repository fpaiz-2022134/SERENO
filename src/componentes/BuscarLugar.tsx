/**
 * Buscar la parcela por nombre de lugar.
 *
 * El camino corto: el productor escribe «Chiantla» y el mapa se va para allá.
 * Arrastrar desde el otro lado del país sería absurdo.
 *
 * La búsqueda sale del servidor (`/api/lugares`), que pregunta al
 * geocodificador de Open-Meteo — la misma casa que da el pronóstico. El
 * navegador del productor no habla con ninguna API de terceros.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Mira } from "@/componentes/Iconos";

export interface Lugar {
  nombre: string;
  detalle: string;
  latitud: number;
  longitud: number;
  altitudMetros: number | null;
}

export function BuscarLugar({
  alElegir,
  deshabilitado,
}: {
  alElegir: (l: Lugar) => void;
  deshabilitado?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vacio, setVacio] = useState(false);
  const corte = useRef<AbortController | null>(null);

  // Espera a que deje de teclear: una petición por búsqueda, no por letra.
  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) {
      setLugares([]);
      setVacio(false);
      setError(null);
      return;
    }

    const reloj = setTimeout(async () => {
      corte.current?.abort();
      const ctrl = new AbortController();
      corte.current = ctrl;
      setBuscando(true);
      setError(null);
      try {
        const r = await fetch(`/api/lugares?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const d = (await r.json()) as { lugares?: Lugar[]; error?: string };
        if (!r.ok) throw new Error(d.error ?? "No se pudo buscar.");
        setLugares(d.lugares ?? []);
        setVacio((d.lugares ?? []).length === 0);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(
          e instanceof Error && e.message !== "Failed to fetch"
            ? e.message
            : "Sin conexión: mueva el mapa a mano.",
        );
        setLugares([]);
      } finally {
        setBuscando(false);
      }
    }, 350);

    return () => clearTimeout(reloj);
  }, [texto]);

  return (
    <div className="buscar">
      <label className="campo" style={{ marginBottom: 0 }}>
        <span className="campo__que">Buscar su municipio o aldea</span>
        <input
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Chiantla, Acatenango, San Pedro…"
          value={texto}
          disabled={deshabilitado}
          onChange={(e) => setTexto(e.target.value)}
        />
      </label>

      {buscando && <p className="buscar__estado">Buscando…</p>}

      {error && (
        <p className="buscar__estado buscar__estado--malo">{error}</p>
      )}

      {vacio && !buscando && !error && (
        <p className="buscar__estado">
          No se encontró ese nombre. Puede arrastrar el mapa hasta su parcela.
        </p>
      )}

      {lugares.length > 0 && (
        <ul className="buscar__lista">
          {lugares.map((l) => (
            <li key={`${l.nombre}-${l.latitud}-${l.longitud}`}>
              <button
                type="button"
                onClick={() => {
                  alElegir(l);
                  setTexto("");
                  setLugares([]);
                }}
              >
                <span className="circulo" aria-hidden="true">
                  <Mira tam={17} />
                </span>
                <span className="buscar__texto">
                  <span className="buscar__nombre">{l.nombre}</span>
                  {l.detalle && <span className="buscar__detalle">{l.detalle}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

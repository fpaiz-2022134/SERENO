/**
 * Perfil — la cuenta, de dónde sale cada dato, y lo que SERENO no hace.
 *
 * La última sección no es relleno: es la que evita que alguien salga del demo
 * creyendo que esto predice brotes o que cubre cinco cultivos.
 */
"use client";

import { Rotulo } from "@/componentes/Avisos";
import { marcaDeTiempo } from "@/lib/ui/fechas";
import type { Parcela, Sesion } from "@/lib/ui/almacen";
import type { RespuestaPrevencion } from "@/lib/ui/tipos";
import type { Resultado } from "@/lib/ui/red";

const FUENTES = [
  { n: "Open-Meteo", q: "Pronóstico e histórico horario. Es la fuente del motor.", ok: true },
  { n: "MET Norway (yr.no)", q: "Segunda opinión. No alimenta el motor.", ok: true },
  { n: "NASA POWER", q: "Respaldo histórico desde 2001 (horario).", ok: true },
  { n: "Anacafé / CEDICAFÉ", q: "Boletines públicos de roya, enlazados al PDF oficial.", ok: true },
  { n: "MAGA (CKAN)", q: "Precios mayoristas. El café no aparece en esos CSV.", ok: false },
  { n: "GDELT", q: "Responde, pero no tiene cobertura de roya: cero artículos.", ok: false },
];

const NO_HACE = [
  ["No predice brotes.", "Predice ventanas de condiciones favorables a la infección. En la coordenada de demo, 2012 —el año de la emergencia nacional— dio menos eventos que 2011."],
  ["Solo roya del café.", "Maíz, frijol, cardamomo y hortalizas no tienen umbrales verificados, así que no calculan nada."],
  ["No hay mapa de brotes por noticias.", "GDELT responde, pero devuelve cero artículos de roya: es un hueco de la fuente."],
  ["No hay precio nacional del café.", "Los CSV del MAGA son de mercados terminales y el café no se vende ahí."],
  ["No es un agrónomo.", "La última palabra es suya."],
];

export function Perfil({
  sesion,
  parcela,
  resultado,
  alSalir,
}: {
  sesion: Sesion;
  parcela: Parcela | null;
  resultado: Resultado<RespuestaPrevencion> | null;
  alSalir: () => void;
}) {
  return (
    <div className="pliego">
      <div className="saludo entra entra-1">
        <div className="saludo__fecha">{sesion.correo}</div>
        <h1 className="saludo__titulo">{sesion.nombre}</h1>
      </div>

      <section className="tarjeta seccion entra entra-2">
        <Rotulo>Cuenta</Rotulo>
        <p style={{ fontSize: 15, margin: 0, color: "var(--tinta-2)" }}>{sesion.correo}</p>
        <p className="imprenta">
          Sesión guardada solo en este teléfono desde {marcaDeTiempo(sesion.creadaEn)}. No hay
          cuenta en la nube: esta versión no tiene servidor de identidad.
        </p>
        <button type="button" className="boton boton--musgo" onClick={alSalir} style={{ marginTop: 12 }}>
          Cerrar sesión y borrar los datos de este teléfono
        </button>
      </section>

      {parcela && (
        <section className="tarjeta seccion">
          <Rotulo>Parcela</Rotulo>
          <p style={{ fontSize: 15, margin: 0 }}>
            {parcela.nombre} · {parcela.lugar || "sin lugar"}
          </p>
          <p
            style={{
              fontSize: 13,
              color: "var(--tinta-2)",
              margin: "4px 0 0",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {parcela.latitud}, {parcela.longitud}
            {parcela.altitudMetros != null && ` · ${Math.round(parcela.altitudMetros)} m`}
          </p>
        </section>
      )}

      <section className="tarjeta seccion">
        <Rotulo>De dónde sale cada dato</Rotulo>
        {FUENTES.map((f) => (
          <div key={f.n} className="enlace">
            <span className="enlace__titulo">
              <span style={{ color: f.ok ? "var(--hoja-clara)" : "var(--tinta-3)" }}>
                {f.ok ? "●" : "○"}
              </span>{" "}
              {f.n}
            </span>
            <span className="enlace__pie">{f.q}</span>
          </div>
        ))}
        {resultado && (
          <p className="imprenta">
            Último reporte: {marcaDeTiempo(resultado.recibidoEn)} ·{" "}
            {resultado.origen === "red" ? "de la red" : "de la caché de este teléfono"}.
          </p>
        )}
        <p className="imprenta">
          <b>INSIVUMEH no está integrado.</b> Aparece en el material de marca, pero no es una
          de las fuentes que consulta esta app, así que no lo nombramos en los datos.
        </p>
      </section>

      <section className="tarjeta seccion">
        <Rotulo>Lo que Sereno no hace</Rotulo>
        {NO_HACE.map(([t, q]) => (
          <p key={t} style={{ fontSize: 13.5, lineHeight: 1.45, margin: "0 0 11px" }}>
            <b>{t}</b>{" "}
            <span style={{ color: "var(--tinta-2)" }}>{q}</span>
          </p>
        ))}
      </section>
    </div>
  );
}

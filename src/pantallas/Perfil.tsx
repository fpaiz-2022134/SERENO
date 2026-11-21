/**
 * Perfil — la cuenta, las fuentes y lo que el producto NO hace.
 *
 * Esta última parte no es relleno: es la que evita que alguien salga del demo
 * creyendo que SERENO predice brotes o que cubre cinco cultivos.
 */
"use client";

import { marcaDeTiempo } from "@/lib/ui/fechas";
import type { Sesion, Parcela } from "@/lib/ui/almacen";
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
    <div className="pantalla">
      <div style={{ padding: "2px 0 10px" }}>
        <h1 style={{ fontSize: 27, color: "var(--niebla-profunda)" }}>Perfil</h1>
      </div>

      <div className="tarjeta">
        <div className="tarjeta__rotulo">Cuenta</div>
        <p style={{ fontSize: 15, marginTop: 8, marginBottom: 4 }}>
          <b>{sesion.nombre}</b>
          <br />
          <span style={{ fontSize: 13, color: "var(--tinta-suave)" }}>{sesion.correo}</span>
        </p>
        <p className="nota-procedencia">
          Sesión guardada solo en este teléfono desde {marcaDeTiempo(sesion.creadaEn)}. No hay
          cuenta en la nube: esta versión no tiene servidor de identidad.
        </p>
        <button type="button" className="boton boton--contorno" onClick={alSalir}>
          Cerrar sesión y borrar los datos de este teléfono
        </button>
      </div>

      {parcela && (
        <div className="tarjeta seccion">
          <div className="tarjeta__rotulo">Parcela</div>
          <p style={{ fontSize: 14, marginTop: 8, marginBottom: 0 }}>
            {parcela.nombre} · {parcela.lugar || "sin lugar"}
            <br />
            <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--tinta-suave)" }}>
              {parcela.latitud}, {parcela.longitud}
              {parcela.altitudMetros != null && ` · ${Math.round(parcela.altitudMetros)} m`}
            </span>
          </p>
        </div>
      )}

      <div className="tarjeta seccion">
        <div className="tarjeta__rotulo">De dónde sale cada dato</div>
        <div style={{ marginTop: 6 }}>
          {FUENTES.map((f) => (
            <div key={f.n} className="boletin">
              <span className="boletin__titulo">
                {f.ok ? "✓" : "○"} {f.n}
              </span>
              <span className="boletin__pie">{f.q}</span>
            </div>
          ))}
        </div>
        {resultado && (
          <p className="nota-procedencia">
            Último reporte: {marcaDeTiempo(resultado.recibidoEn)} ·{" "}
            {resultado.origen === "red" ? "de la red" : "de la caché de este teléfono"}.
          </p>
        )}
        <p className="nota-procedencia">
          <b>INSIVUMEH no está integrado.</b> Aparece en el material de marca, pero no es una
          de las fuentes que consulta esta app, así que no lo nombramos en los datos.
        </p>
      </div>

      <div className="tarjeta seccion">
        <div className="tarjeta__rotulo">Lo que SERENO no hace</div>
        <ul style={{ fontSize: 13, color: "var(--tinta-suave)", paddingLeft: 18, marginBottom: 0 }}>
          <li>
            <b>No predice brotes.</b> Predice ventanas de condiciones favorables a la
            infección. En la coordenada de demo, 2012 —el año de la emergencia nacional— dio
            menos eventos que 2011.
          </li>
          <li>
            <b>Solo roya del café.</b> Maíz, frijol, cardamomo y hortalizas no tienen umbrales
            verificados y por eso no calculan nada.
          </li>
          <li>
            <b>No hay mapa de brotes por noticias.</b> GDELT responde, pero devuelve cero
            artículos de roya: es un hueco de la fuente.
          </li>
          <li>
            <b>No hay precio nacional del café.</b> Los CSV del MAGA son de mercados
            terminales y el café no se vende ahí.
          </li>
          <li>
            <b>No es un agrónomo.</b> La última palabra es suya.
          </li>
        </ul>
      </div>
    </div>
  );
}

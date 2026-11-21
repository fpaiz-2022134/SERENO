/**
 * Alertas — la curva día a día y el historial guardado.
 *
 * No hay notificaciones push en esta versión y la pantalla lo dice: el canal
 * real del producto es WhatsApp, y ese mensaje se manda desde «Resultado».
 */
"use client";

import { pintaDeNivel } from "@/lib/ui/riesgo";
import { fechaCorta, marcaDeTiempo } from "@/lib/ui/fechas";
import { leerSeguimientos } from "@/lib/ui/almacen";
import { AvisoSinConexion } from "@/componentes/Avisos";
import type { RespuestaPrevencion } from "@/lib/ui/tipos";
import type { Resultado } from "@/lib/ui/red";

export function Alertas({ resultado }: { resultado: Resultado<RespuestaPrevencion> | null }) {
  const seguimientos = leerSeguimientos();

  return (
    <div className="pantalla">
      <div style={{ padding: "2px 0 10px" }}>
        <h1 style={{ fontSize: 27, color: "var(--niebla-profunda)" }}>Alertas</h1>
        <p style={{ fontSize: 13, color: "var(--tinta-suave)", marginTop: 2 }}>
          Día por día, con su índice.
        </p>
      </div>

      {resultado ? (
        <>
          <AvisoSinConexion
            origen={resultado.origen}
            recibidoEn={resultado.recibidoEn}
            motivo={resultado.motivoCaida}
          />
          <div className="tarjeta">
            <div className="tarjeta__rotulo">Curva de riesgo · {resultado.datos.curva.length} días</div>
            <div style={{ marginTop: 8 }}>
              {resultado.datos.curva.map((x) => {
                const p = pintaDeNivel(x.nivel);
                return (
                  <div
                    key={x.dia}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "7px 0",
                      borderBottom: "1px solid var(--borde)",
                    }}
                  >
                    <span style={{ fontSize: 12.5, width: 78, color: "var(--tinta-suave)" }}>
                      {fechaCorta(x.dia)}
                    </span>
                    <span
                      aria-hidden="true"
                      style={{
                        flex: 1,
                        height: 8,
                        borderRadius: 99,
                        background: "rgba(25,19,15,0.07)",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          height: "100%",
                          width: `${Math.round(x.indice * 100)}%`,
                          background: p.color,
                          borderRadius: 99,
                        }}
                      />
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                        width: 34,
                        textAlign: "right",
                      }}
                    >
                      {x.indice.toFixed(2)}
                    </span>
                    <span style={{ fontSize: 11, width: 58, color: p.color, fontWeight: 700 }}>
                      {p.palabra}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="nota-procedencia">
              Cada barra es el índice del motor para ese día, con su palabra al lado. Un día
              con <b>lavado por lluvia</b> ya viene castigado en el número.
            </p>
          </div>
        </>
      ) : (
        <div className="tarjeta">
          <div className="dato dato--vacio" style={{ minHeight: 0 }}>
            <div className="dato__titulo">Curva de riesgo</div>
            <div className="dato__valor">No disponible</div>
            <div className="dato__pie">Falta configurar la parcela o conseguir el pronóstico.</div>
          </div>
        </div>
      )}

      <div className="tarjeta seccion">
        <div className="tarjeta__rotulo">Seguimientos guardados</div>
        {seguimientos.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--tinta-suave)", marginTop: 8, marginBottom: 0 }}>
            Todavía no ha guardado ninguno. Se guardan desde «Resultado».
          </p>
        ) : (
          <div style={{ marginTop: 4 }}>
            {seguimientos.map((s) => {
              const p = pintaDeNivel(s.nivel);
              return (
                <div key={s.guardadoEn} className="boletin">
                  <span className="boletin__titulo">
                    {s.parcela} ·{" "}
                    <span style={{ color: p.color }}>
                      {p.corta} · {p.palabra}
                    </span>
                  </span>
                  <span className="boletin__pie">
                    {marcaDeTiempo(s.guardadoEn)}
                    {s.ventana
                      ? ` · ventana ${fechaCorta(s.ventana.inicio)} – ${fechaCorta(s.ventana.fin)}`
                      : " · sin ventana"}
                    {s.costoTotalQ != null ? ` · Q${s.costoTotalQ.toLocaleString("es-GT")}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="aviso aviso--roble" style={{ marginTop: 14 }}>
        <span aria-hidden="true">◈</span>
        <span>
          <b>Esta versión no manda notificaciones.</b> El canal del aviso es WhatsApp y el
          mensaje se envía desde «Resultado», con el texto que ya redactó el motor.
        </span>
      </div>
    </div>
  );
}

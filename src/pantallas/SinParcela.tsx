/**
 * Pantalla 3 · Sin parcela — estado vacío honesto.
 *
 * Las tarjetas dicen «No disponible» y QUÉ FALTA. Nunca ceros, nunca datos
 * inventados: sin coordenada no hay serie meteorológica y por lo tanto no hay
 * número que mostrar.
 */
"use client";

import { Gota } from "@/componentes/Logo";
import { DatoVacio } from "@/componentes/Avisos";

export function SinParcela({ nombre, alConfigurar }: { nombre: string; alConfigurar: () => void }) {
  return (
    <div className="pantalla">
      <div
        className="tarjeta tarjeta--niebla"
        style={{ marginTop: 6, textAlign: "center", paddingBottom: 22 }}
      >
        <h1 style={{ fontSize: 27, color: "#fff", textAlign: "left" }}>Bienvenida, {nombre}.</h1>
        <p
          style={{
            fontSize: 13.5,
            color: "rgba(255,255,255,0.8)",
            textAlign: "left",
            marginTop: 6,
          }}
        >
          Ubiquemos su parcela para calcular el clima y el riesgo de su cultivo.
        </p>
        <div style={{ margin: "18px 0 16px" }}>
          <Gota tam={78} color="rgba(255,255,255,0.9)" />
        </div>
        <button type="button" className="boton boton--contorno" onClick={alConfigurar}>
          ◎ Configurar mi parcela
        </button>
      </div>

      <div className="datos">
        <DatoVacio titulo="Riesgo de plaga" falta="Falta ubicar la parcela." />
        <DatoVacio titulo="Temperatura" falta="Falta ubicar la parcela." />
        <DatoVacio titulo="Humedad" falta="Falta ubicar la parcela." />
        <DatoVacio titulo="Lluvia 24 h" falta="Falta ubicar la parcela." />
      </div>

      <div className="aviso aviso--roble" style={{ marginTop: 12 }}>
        <span aria-hidden="true">◈</span>
        <span>
          Sin coordenada no hay pronóstico, y sin pronóstico no hay número. Preferimos
          decir <b>No disponible</b> a enseñar un cero.
        </span>
      </div>
    </div>
  );
}

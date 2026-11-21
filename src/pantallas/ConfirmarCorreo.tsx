/**
 * Confirmar correo — código de 6 números.
 *
 * El paso existe porque está en el flujo del branding, pero no se manda
 * ningún correo: la pantalla dice qué número aceptar y por qué, en lugar de
 * fingir que llegó un mensaje.
 */
"use client";

import { useRef, useState } from "react";
import { Sobre } from "@/componentes/Iconos";

/** El código de demostración. Está impreso en la pantalla: no es un secreto. */
export const CODIGO_DEMO = "482100";

export function ConfirmarCorreo({
  correo,
  alConfirmar,
  alVolver,
}: {
  correo: string;
  alConfirmar: () => void;
  alVolver: () => void;
}) {
  const [digitos, setDigitos] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const campos = useRef<(HTMLInputElement | null)[]>([]);

  /**
   * Acepta un dígito, varios de golpe (pegar el código) o tecleo rápido. El
   * estado se actualiza en forma funcional y las casillas no llevan
   * `maxLength`: si llegan dos teclas antes de que React repinte, los dígitos
   * de más se reparten en vez de perderse.
   */
  function escribir(i: number, v: string, anterior = "") {
    let limpio = v.replace(/\D/g, "");
    if (limpio.length > 1 && anterior && limpio.startsWith(anterior)) {
      limpio = limpio.slice(anterior.length);
      i = Math.min(i + 1, 5);
    }
    if (!limpio) {
      setDigitos((prev) => prev.map((d, j) => (j === i ? "" : d)));
      return;
    }
    setDigitos((prev) => {
      const nuevos = [...prev];
      for (let k = 0; k < limpio.length && i + k < 6; k++) nuevos[i + k] = limpio[k];
      return nuevos;
    });
    setError(null);
    campos.current[Math.min(i + limpio.length, 5)]?.focus();
  }

  function retroceder(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digitos[i] && i > 0) campos.current[i - 1]?.focus();
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const codigo = digitos.join("");
    if (codigo.length < 6) return setError("Faltan números del código.");
    if (codigo !== CODIGO_DEMO) return setError("El código no coincide.");
    alConfirmar();
  }

  return (
    <div className="hoja">
      <div className="pliego pliego--suelto" style={{ paddingTop: 28 }}>
        <div
          className="entra entra-1"
          style={{
            width: 52,
            height: 52,
            background: "var(--musgo)",
            color: "var(--hoja-media)",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Sobre tam={24} />
        </div>

        <h1 className="entra entra-2" style={{ fontSize: 38, marginTop: 20 }}>
          Revise su correo
        </h1>
        <p
          className="entra entra-2"
          style={{ fontSize: 15.5, color: "var(--tinta-2)", marginTop: 8 }}
        >
          Le mandamos un código de 6 números a{" "}
          <b style={{ color: "var(--hoja-honda)" }}>{correo}</b>.
        </p>

        <form onSubmit={enviar}>
          <div className="clave entra entra-3">
            {digitos.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  campos.current[i] = el;
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={d}
                aria-label={`Número ${i + 1} de 6`}
                onChange={(e) => escribir(i, e.target.value, d)}
                onKeyDown={(e) => retroceder(i, e)}
                onPaste={(e) => {
                  e.preventDefault();
                  escribir(i, e.clipboardData.getData("text"));
                }}
              />
            ))}
          </div>

          {error && (
            <div className="nota nota--alta" role="alert" style={{ marginBottom: 12 }}>
              <span className="nota__signo" aria-hidden="true">
                !
              </span>
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="boton entra entra-4">
            Confirmar
          </button>
        </form>

        <button type="button" className="boton boton--texto" onClick={alVolver}>
          ← Cambiar de correo
        </button>

        <div className="nota" style={{ marginTop: 18 }}>
          <span className="nota__signo" aria-hidden="true">
            ◈
          </span>
          <span>
            <b>No se envió ningún correo.</b> Esta versión no tiene servidor de identidad.
            Para seguir, escriba <b>{CODIGO_DEMO}</b>.
          </span>
        </div>
      </div>
    </div>
  );
}

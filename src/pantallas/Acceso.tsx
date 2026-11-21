/**
 * Portada · Acceso — solo correo y contraseña.
 *
 * El nombre ocupa media pantalla porque es lo único que hay que entender
 * aquí. El fondo es la luz entre las hojas, dibujada con gradientes: pesa
 * cero y respira despacio.
 *
 * HONESTIDAD: no hay servidor de identidad. La sesión se guarda solo en este
 * teléfono y la pantalla lo dice en letra visible, porque simular que valida
 * sería exactamente la clase de mentira que el equipo acordó no hacer.
 */
"use client";

import { useState } from "react";
import { Gota } from "@/componentes/Iconos";
import { FOTOS } from "@/componentes/Fotos";

export function Acceso({ alEntrar }: { alEntrar: (correo: string) => void }) {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);

  const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) && clave.length >= 6;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) {
      setError(
        correo.includes("@")
          ? "La contraseña necesita al menos 6 caracteres."
          : "Escriba un correo electrónico válido.",
      );
      return;
    }
    setError(null);
    alEntrar(correo.trim().toLowerCase());
  }

  return (
    <div className="portada">
      <div className="portada__fondo" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FOTOS.cafetal.src} alt="" />
      </div>

      <div className="portada__alto">
        <div className="portada__gota entra entra-1">
          <Gota tam={54} trazo={1.5} />
        </div>
        <h1 className="portada__titulo entra entra-1">Sereno</h1>
        <div className="portada__lema entra entra-2">Clima para el agricultor</div>
        <p className="portada__promesa entra entra-3">Sepa antes. Decida usted.</p>
      </div>

      <form onSubmit={enviar} noValidate>
        <label className="campo entra entra-3">
          <span className="campo__que">Correo electrónico</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="ana.ramirez@correo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </label>

        <label className="campo entra entra-4">
          <span className="campo__que">Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </label>

        {error && (
          <div className="nota nota--alta" role="alert" style={{ marginBottom: 12 }}>
            <span className="nota__signo" aria-hidden="true">
              !
            </span>
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="boton entra entra-5" style={{ marginTop: 4 }}>
          Entrar
        </button>

        <p className="portada__pie">La parcela se agrega después</p>

        <div className="nota" style={{ marginTop: 16 }}>
          <span className="nota__signo" aria-hidden="true">
            ◈
          </span>
          <span>
            <b>Esta pantalla no valida contra un servidor.</b> En esta versión la sesión se
            guarda solo en este teléfono: no hay cuentas en la nube ni se envía ningún
            correo. Lo decimos en vez de simularlo.
          </span>
        </div>
      </form>
    </div>
  );
}

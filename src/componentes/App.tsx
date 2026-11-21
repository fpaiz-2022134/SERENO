/**
 * El armazón de la PWA, v2.
 *
 * Una sola página con las pantallas en estado del cliente, a propósito: así el
 * service worker cachea UN documento y la app abre completa sin conexión, sin
 * pedirle al servidor la carga parcial de ninguna ruta.
 *
 * Aquí también se fija `data-riesgo` en el <html>. De esa forma el color del
 * riesgo baja por variables CSS a toda la app —incluido el botón de la barra—
 * y no hay que pasarlo por props a cada componente.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gota } from "@/componentes/Iconos";
import { Navegacion, type Vista } from "@/componentes/Navegacion";
import { Acceso } from "@/pantallas/Acceso";
import { ConfirmarCorreo } from "@/pantallas/ConfirmarCorreo";
import { SinParcela } from "@/pantallas/SinParcela";
import { Hoy } from "@/pantallas/Hoy";
import { MiParcela } from "@/pantallas/MiParcela";
import { Resultado } from "@/pantallas/Resultado";
import { Alertas } from "@/pantallas/Alertas";
import { Perfil } from "@/pantallas/Perfil";
import { Vacio } from "@/componentes/Avisos";
import { marcaDeTiempo } from "@/lib/ui/fechas";
import { pinta } from "@/lib/ui/paleta";
import {
  borrarParcela,
  borrarSesion,
  guardarAccionesHechas,
  guardarParcela,
  guardarSesion,
  leerAccionesHechas,
  leerCostos,
  leerParcela,
  leerSesion,
  nombreDesdeCorreo,
  type Costos,
  type Parcela,
  type Sesion,
} from "@/lib/ui/almacen";
import {
  SinDatos,
  clavePrevencion,
  pedirConRespaldo,
  rutaPrevencion,
  type Resultado as Res,
} from "@/lib/ui/red";
import type { RespuestaPrevencion } from "@/lib/ui/tipos";

type Paso = "cargando" | "acceso" | "codigo" | "app";

export function App() {
  const [paso, setPaso] = useState<Paso>("cargando");
  const [correoPendiente, setCorreoPendiente] = useState("");
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [parcela, setParcela] = useState<Parcela | null>(null);
  const [vista, setVista] = useState<Vista>("hoy");

  const [reporte, setReporte] = useState<Res<RespuestaPrevencion> | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorReporte, setErrorReporte] = useState<string | null>(null);

  const [labores, setLabores] = useState<string[]>([]);
  const [costos, setCostos] = useState<Costos | null>(null);
  const [enLinea, setEnLinea] = useState(true);

  /* --- arranque: leer lo que ya está en el teléfono ----------------- */
  useEffect(() => {
    const s = leerSesion();
    setSesion(s);
    setParcela(leerParcela());
    setLabores(leerAccionesHechas());
    setCostos(leerCostos());
    setPaso(s?.correoConfirmado ? "app" : "acceso");
    setEnLinea(navigator.onLine);

    const sube = () => setEnLinea(true);
    const baja = () => setEnLinea(false);
    window.addEventListener("online", sube);
    window.addEventListener("offline", baja);
    return () => {
      window.removeEventListener("online", sube);
      window.removeEventListener("offline", baja);
    };
  }, []);

  /* --- service worker ----------------------------------------------- */
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* sin service worker la app sigue andando, solo que sin modo avión */
      });
    }
  }, []);

  /* --- el color del riesgo, una vez, en el documento ----------------- */
  const nivel = reporte?.datos.ventanaDeAccion?.nivel ?? reporte?.datos.curva?.[0]?.nivel ?? null;

  useEffect(() => {
    const raiz = document.documentElement;
    if (nivel && parcela?.cultivo === "cafe") raiz.setAttribute("data-riesgo", nivel);
    else raiz.removeAttribute("data-riesgo");
  }, [nivel, parcela?.cultivo]);

  /* --- consultar el pronóstico --------------------------------------- */
  const consultar = useCallback(async (p: Parcela) => {
    setCargando(true);
    setErrorReporte(null);
    try {
      const r = await pedirConRespaldo<RespuestaPrevencion>(
        clavePrevencion(p.latitud, p.longitud),
        rutaPrevencion(p),
      );
      setReporte(r);
      // La altitud la mide la fuente; si cambió, se guarda en la parcela.
      const alt = r.datos.punto?.altitudMetros ?? null;
      if (alt != null && alt !== p.altitudMetros) {
        const actualizada = { ...p, altitudMetros: alt };
        guardarParcela(actualizada);
        setParcela(actualizada);
      }
    } catch (e) {
      setErrorReporte(e instanceof SinDatos ? e.message : "No se pudo consultar el pronóstico.");
      setReporte(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (paso === "app" && parcela) void consultar(parcela);
    // Solo por coordenada y fecha de aplicación: renombrar no vuelve a pedir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, parcela?.latitud, parcela?.longitud, parcela?.ultimaAplicacion]);

  const nombre = useMemo(() => sesion?.nombre ?? "productor", [sesion]);

  /* --- sesión --------------------------------------------------------- */
  function entrar(correo: string) {
    setCorreoPendiente(correo);
    setPaso("codigo");
  }

  function confirmar() {
    const s: Sesion = {
      correo: correoPendiente,
      nombre: nombreDesdeCorreo(correoPendiente),
      correoConfirmado: true,
      soloLocal: true,
      creadaEn: new Date().toISOString(),
    };
    guardarSesion(s);
    setSesion(s);
    setPaso("app");
    setVista("hoy");
  }

  function salir() {
    borrarSesion();
    borrarParcela();
    setSesion(null);
    setParcela(null);
    setReporte(null);
    setPaso("acceso");
  }

  function guardar(p: Parcela) {
    guardarParcela(p);
    setParcela(p);
  }

  function marcarLabor(id: string) {
    const nuevas = labores.includes(id) ? labores.filter((x) => x !== id) : [...labores, id];
    setLabores(nuevas);
    guardarAccionesHechas(nuevas);
  }

  /* --- render ---------------------------------------------------------- */
  if (paso === "cargando") {
    return (
      <div className="cargando" style={{ minHeight: "100dvh" }}>
        <span className="cargando__brote" aria-hidden="true" />
        <p>Abriendo Sereno…</p>
      </div>
    );
  }

  if (paso === "acceso") return <Acceso alEntrar={entrar} />;

  if (paso === "codigo") {
    return (
      <ConfirmarCorreo
        correo={correoPendiente}
        alConfirmar={confirmar}
        alVolver={() => setPaso("acceso")}
      />
    );
  }

  const cuerpo = (() => {
    if (vista === "parcela") {
      return (
        <MiParcela
          parcela={parcela}
          altitudMedida={reporte?.datos.punto?.altitudMetros ?? null}
          alGuardar={guardar}
          alCalcular={() => setVista("resultado")}
        />
      );
    }

    if (vista === "perfil" && sesion) {
      return <Perfil sesion={sesion} parcela={parcela} resultado={reporte} alSalir={salir} />;
    }

    if (vista === "alertas") return <Alertas resultado={reporte} />;

    if (!parcela) {
      return <SinParcela nombre={nombre} alConfigurar={() => setVista("parcela")} />;
    }

    // Mientras no haya reporte: o estamos consultando, o falló de verdad. No se
    // muestra "No disponible" por el hueco entre guardar la parcela y que salga
    // la petición.
    if (!reporte && !errorReporte) {
      return (
        <div className="cargando">
          <span className="cargando__brote" aria-hidden="true" />
          <p>Consultando el pronóstico de su parcela…</p>
        </div>
      );
    }

    if (errorReporte || !reporte) {
      return (
        <div className="pliego">
          <div className="saludo">
            <div className="saludo__fecha">{parcela.nombre}</div>
            <h1 className="saludo__titulo">Sin reporte</h1>
          </div>
          <section className="seccion">
            <Vacio
              que="Riesgo de plaga"
              falta={`${errorReporte ?? "No hay reporte."} Tampoco hay ninguno guardado en este teléfono para esta coordenada, así que no hay nada que mostrar todavía.`}
            />
            <button
              type="button"
              className="boton"
              style={{ marginTop: 14 }}
              onClick={() => void consultar(parcela)}
            >
              Reintentar
            </button>
          </section>
        </div>
      );
    }

    if (vista === "resultado") {
      return (
        <Resultado
          parcela={parcela}
          resultado={reporte}
          costosGuardados={costos}
          alVolver={() => setVista("hoy")}
        />
      );
    }

    return (
      <Hoy
        nombre={nombre}
        parcela={parcela}
        resultado={reporte}
        laboresHechas={labores}
        alMarcarLabor={marcarLabor}
        alVerResultado={() => setVista("resultado")}
        alIrAParcela={() => setVista("parcela")}
      />
    );
  })();

  const p = pinta(nivel);

  return (
    <div className="hoja">
      <header className="membrete">
        <div className="membrete__marca">
          <Gota tam={21} />
          Sereno
        </div>
        <div className="membrete__estado">
          <span
            className={`membrete__punto${enLinea ? "" : " membrete__punto--frio"}`}
            aria-hidden="true"
          />
          {cargando && reporte
            ? "Actualizando…"
            : reporte
              ? `${reporte.origen === "red" ? "Actualizado" : "Guardado"} ${marcaDeTiempo(reporte.recibidoEn)}`
              : enLinea
                ? "En línea"
                : "Sin conexión"}
        </div>
      </header>

      {cuerpo}

      {/* El medidor de riesgo también vive en la barra: desde cualquier
          pantalla se ve en qué banda está la parcela. */}
      <span className="sr" aria-live="polite">
        {nivel ? `Riesgo actual: ${p.corta}, ${p.palabra}` : "Riesgo no disponible"}
      </span>

      <Navegacion
        vista={vista}
        ir={setVista}
        alCalcular={() => setVista(parcela ? "resultado" : "parcela")}
      />
    </div>
  );
}

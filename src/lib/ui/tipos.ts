/** Tipos de lo que devuelve la API, tal como lo consume el frontend. */

export interface Procedencia {
  fuente: string;
  url: string;
  fechaPublicacion: string | null;
  ultimaConsulta: string;
  esPronostico: boolean;
  altitudMetros?: number | null;
  avisos?: string[];
}

export interface DiaCurva {
  dia: string;
  indice: number;
  nivel: string;
  etiqueta: string;
  horasMojadas: number;
  horasRequeridas: number | null;
  temperaturaMedia: number | null;
  lluviaMm: number;
  hayEvento: boolean;
  lavadoPorLluvia: boolean;
}

export interface VentanaAccion {
  inicio: string;
  fin: string;
  aplicarAntesDe: string;
  indiceMaximo: number;
  nivel: string;
  contieneEvento: boolean;
  sintomasVisiblesDesde: string;
  sintomasVisiblesHasta: string;
}

export interface CondicionesActuales {
  hora: string | null;
  temperaturaC: number | null;
  humedadPct: number | null;
  lluvia24hMm: number | null;
  esEstimacion: boolean;
}

export interface Boletin {
  titulo: string;
  urlDocumento: string;
  periodo: string | null;
  fecha: string | null;
  tema: string;
  formato: string;
}

export interface Aviso {
  titular: string;
  texto: string;
  soporte: {
    ventana: VentanaAccion | null;
    horasMojadas: number | null;
    horasRequeridas: number | null;
    indiceMaximo: number | null;
    eventosConfirmados: number;
  };
}

/** Respuesta de GET /api/prevencion. */
export interface RespuestaPrevencion {
  ok: true;
  punto: { latitud: number; longitud: number; altitudMetros: number | null };
  hoy: string;
  ahora: CondicionesActuales;
  ventanaDeAccion: VentanaAccion | null;
  curva: DiaCurva[];
  mojado: {
    dia: string;
    horasMojadas: number;
    horasRequeridas: number | null;
    temperaturaMedia: number | null;
  }[];
  incubacionDias: [number, number];
  sintomasSiHoyHayInfeccion: { desde: string; hasta: string } | null;
  cobertura: {
    diasDesdeUltimaAplicacion: number | null;
    ultimoEvento: string | null;
    ultimoEventoCubierto: boolean | null;
  };
  aviso: Aviso;
  pendienteDelProductor: { incidenciaAvisoPct: number; nota: string };
  boletinesAnacafe: {
    documentos: Boletin[];
    origen: string;
    error: string | null;
    procedencia: Procedencia;
  };
  procedencia: Procedencia;
  advertencia: string;
}

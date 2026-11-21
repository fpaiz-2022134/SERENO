-- =====================================================================
-- SERENO · esquema inicial
--
-- Soporta:
--   · parcelas con GPS y altura (feature 13)
--   · los DIEZ datos que aporta el productor (atributos de ExpeRoya, ver
--     SERENO-investigacion.md §0B) — ninguno necesita sensor
--   · series horarias cacheadas, eventos de infeccion calculados
--   · documentos de Anacafe, noticias de GDELT, precios del MAGA
--
-- RLS activado en todo: un productor ve SOLO sus parcelas y lo que cuelga de
-- ellas. Los catalogos y el contenido publico (documentos, noticias, precios)
-- son de lectura para cualquier usuario autenticado.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1 · Productores y parcelas
-- ---------------------------------------------------------------------

create table if not exists public.productores (
  id uuid primary key default gen_random_uuid(),
  -- Ligado a auth.users de Supabase: es la llave de todo el RLS.
  usuario_id uuid not null unique references auth.users (id) on delete cascade,
  nombre text,
  telefono_whatsapp text,
  departamento text,
  municipio text,
  creado_en timestamptz not null default now()
);

create table if not exists public.variedades (
  id text primary key,
  nombre text not null,
  -- ExpeRoya A11: si la variedad es resistente a roya cambia el riesgo.
  resistente_roya boolean not null default false,
  nota text
);

insert into public.variedades (id, nombre, resistente_roya, nota) values
  ('caturra',     'Caturra',      false, 'Susceptible'),
  ('catuai',      'Catuai',       false, 'Susceptible'),
  ('bourbon',     'Bourbon',      false, 'Susceptible'),
  ('typica',      'Typica',       false, 'Susceptible'),
  ('pache',       'Pache',        false, 'Susceptible'),
  ('anacafe-14',  'Anacafe 14',   true,  'Resistente segun Anacafe'),
  ('marsellesa',  'Marsellesa',   true,  'Resistente'),
  ('sarchimor',   'Sarchimor',    true,  'Resistente'),
  ('catimor',     'Catimor',      true,  'Resistente'),
  ('otra',        'Otra / no se', false, 'Sin dato')
on conflict (id) do nothing;

create table if not exists public.parcelas (
  id uuid primary key default gen_random_uuid(),
  productor_id uuid not null references public.productores (id) on delete cascade,
  nombre text not null,

  -- Dato 1 del productor: punto GPS + altura.
  -- Se guardan lat/lon como numeric para no depender de PostGIS; el poligono
  -- (feature 13 y el requisito de la UE sobre deforestacion) va en geojson.
  latitud numeric(9,6) not null check (latitud between -90 and 90),
  longitud numeric(9,6) not null check (longitud between -180 and 180),
  -- La altura la devuelve la API de clima; se guarda la que dio y de donde salio.
  altitud_metros numeric(7,2),
  altitud_fuente text,
  poligono_geojson jsonb,

  area_hectareas numeric(8,3),
  -- Dato 3: variedad.
  variedad_id text references public.variedades (id),
  -- Dato 5 (ExpeRoya A5): sombra, mas o menos del 60 %.
  sombra_mayor_60 boolean,
  -- Dato 7 (A7): carga de fruto esperada.
  carga_fruto text check (carga_fruto in ('baja','normal','alta')),
  -- Dato 8 (A8): mes aproximado de floracion.
  floracion_mes smallint check (floracion_mes between 1 and 12),
  -- Dato 9 (A9, A10): inicio y fin de cosecha.
  cosecha_inicio_mes smallint check (cosecha_inicio_mes between 1 and 12),
  cosecha_fin_mes smallint check (cosecha_fin_mes between 1 and 12),
  -- Dato 10 (A4): fertilizacion del ultimo ciclo.
  fertilizacion text check (fertilizacion in ('si','no','parcial')),

  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists parcelas_productor_idx on public.parcelas (productor_id);

-- Dato 2 (A12): incidencia reportada. EL DATO QUE MAS VALE y el que ninguna API
-- tiene: de 10 plantas, cuantas tienen manchas. Sin inoculo el clima solo dice
-- "las condiciones estan dadas", no "te va a dar".
create table if not exists public.reportes_incidencia (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references public.parcelas (id) on delete cascade,
  fecha date not null default current_date,
  -- 'ninguna' | '1-2' | '3-o-mas' : los tres botones de la app.
  plantas_con_manchas text not null check (plantas_con_manchas in ('ninguna','1-2','3-o-mas')),
  -- Equivalente en % para comparar con el umbral de aviso de 5 % (Pozza et al. 2021).
  incidencia_pct numeric(5,2),
  nota text,
  creado_en timestamptz not null default now()
);

create index if not exists reportes_incidencia_parcela_fecha_idx
  on public.reportes_incidencia (parcela_id, fecha desc);

-- Dato 4 (A3): aplicaciones. Feature 14, bitacora.
create table if not exists public.aplicaciones (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references public.parcelas (id) on delete cascade,
  fecha date not null,
  producto text not null,
  ingrediente_activo text,
  dosis text,
  costo_quetzales numeric(12,2),
  -- Si la aplicacion se hizo por un aviso de SERENO, se guarda cual.
  evento_infeccion_id uuid,
  nota text,
  creado_en timestamptz not null default now()
);

create index if not exists aplicaciones_parcela_fecha_idx
  on public.aplicaciones (parcela_id, fecha desc);

-- Dato 6 (A6): poda.
create table if not exists public.podas (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references public.parcelas (id) on delete cascade,
  fecha date not null,
  tipo text not null check (tipo in ('ninguna','ligera','25-pct','50-pct')),
  nota text,
  creado_en timestamptz not null default now()
);

create index if not exists podas_parcela_fecha_idx on public.podas (parcela_id, fecha desc);

-- ---------------------------------------------------------------------
-- 2 · Clima cacheado y eventos calculados
-- ---------------------------------------------------------------------

-- Serie horaria cacheada por punto redondeado. Se guarda el bloque completo en
-- jsonb: el motor consume la serie entera, no fila por fila.
create table if not exists public.series_horarias (
  id uuid primary key default gen_random_uuid(),
  latitud numeric(9,6) not null,
  longitud numeric(9,6) not null,
  fuente text not null,
  -- true = pronostico, false = historico. NUNCA mezclar los dos en la UI.
  es_pronostico boolean not null,
  desde timestamptz not null,
  hasta timestamptz not null,
  zona_horaria text not null default 'America/Guatemala',
  altitud_metros numeric(7,2),
  -- { tiempo: [], temperatura: [], humedadRelativa: [], precipitacion: [], puntoRocio: [] }
  serie jsonb not null,
  url_consultada text not null,
  fecha_publicacion timestamptz,
  ultima_consulta timestamptz not null default now(),
  expira_en timestamptz,
  unique (latitud, longitud, fuente, es_pronostico, desde, hasta)
);

create index if not exists series_horarias_punto_idx
  on public.series_horarias (latitud, longitud, es_pronostico, hasta desc);

-- Eventos de infeccion que calculo el motor. Deterministas y reproducibles:
-- se guarda la version de los parametros con que se calcularon.
create table if not exists public.eventos_infeccion (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid references public.parcelas (id) on delete cascade,
  -- Para corridas historicas que no cuelgan de una parcela.
  latitud numeric(9,6),
  longitud numeric(9,6),
  patogeno_id text not null default 'roya-cafe',

  dia date not null,
  inicio timestamptz not null,
  fin timestamptz not null,
  horas_mojadas integer not null,
  temperatura_media numeric(5,2) not null,
  horas_requeridas numeric(6,2),
  indice numeric(4,3) not null check (indice between 0 and 1),
  nivel text not null check (nivel in ('poco_favorable','favorable','muy_favorable')),
  alcanzo_umbral boolean not null,
  lavado_por_lluvia boolean not null default false,
  lluvia_optima boolean not null default false,
  lluvia_diaria_max_mm numeric(7,2),
  -- true = evento de infeccion (alcanzo el umbral Y no hubo lavado).
  es_evento boolean not null,
  sintomas_visibles_desde date not null,
  sintomas_visibles_hasta date not null,

  -- Trazabilidad del calculo.
  fuente text not null,
  es_pronostico boolean not null,
  parametros jsonb not null,
  calculado_en timestamptz not null default now(),

  constraint eventos_tiene_punto check (parcela_id is not null or (latitud is not null and longitud is not null))
);

create index if not exists eventos_parcela_dia_idx on public.eventos_infeccion (parcela_id, dia desc);
create index if not exists eventos_punto_dia_idx on public.eventos_infeccion (latitud, longitud, dia desc);

-- Avisos enviados (el canal es WhatsApp). Queda el texto exacto que se envio.
create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references public.parcelas (id) on delete cascade,
  evento_infeccion_id uuid references public.eventos_infeccion (id) on delete set null,
  canal text not null default 'whatsapp' check (canal in ('whatsapp','sms','app','simulado')),
  titular text,
  texto text not null,
  -- Los numeros en que se baso el texto, para poder auditar el aviso.
  soporte jsonb,
  ventana_inicio date,
  ventana_fin date,
  aplicar_antes_de date,
  enviado_en timestamptz,
  estado text not null default 'borrador' check (estado in ('borrador','enviado','fallido')),
  creado_en timestamptz not null default now()
);

create index if not exists avisos_parcela_idx on public.avisos (parcela_id, creado_en desc);

-- ---------------------------------------------------------------------
-- 3 · Contenido publico: documentos, noticias, precios
-- ---------------------------------------------------------------------

create table if not exists public.documentos_anacafe (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  url_documento text not null unique,
  periodo text,             -- YYYY-MM
  fecha date,
  tema text not null default 'otro',
  formato text not null default 'pdf' check (formato in ('pdf','enlace')),
  -- Procedencia obligatoria.
  fuente text not null default 'Anacafe / CEDICAFE',
  fecha_publicacion date,
  ultima_consulta timestamptz not null default now()
);

create index if not exists documentos_anacafe_tema_fecha_idx
  on public.documentos_anacafe (tema, fecha desc);

create table if not exists public.noticias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  url text not null unique,
  dominio text,
  pais text,
  idioma text,
  visto_en timestamptz,
  tema text not null,
  -- Invariantes del producto, en la base de datos a proposito:
  --   una noticia NO es un veredicto del motor
  es_veredicto boolean not null default false check (es_veredicto = false),
  --   una noticia de precios NO es una cotizacion
  no_es_cotizacion boolean not null default false,
  prioritario boolean not null default false,
  fuente text not null default 'GDELT DOC 2.0',
  ultima_consulta timestamptz not null default now()
);

create index if not exists noticias_tema_visto_idx on public.noticias (tema, visto_en desc);

create table if not exists public.precios (
  id uuid primary key default gen_random_uuid(),
  producto text not null,
  -- 'mayorista' explicito: NO es precio al productor en finca.
  actor text not null default 'mayorista',
  mercado text,
  medida text,
  moneda text not null default 'GTQ',
  precio numeric(14,2),
  fecha date,
  periodicidad text,
  fuente text not null default 'MAGA via catalogo.senacyt.gob.gt',
  url_recurso text,
  fecha_publicacion date,
  ultima_consulta timestamptz not null default now(),
  unique (producto, mercado, medida, fecha, actor)
);

create index if not exists precios_producto_fecha_idx on public.precios (producto, fecha desc);

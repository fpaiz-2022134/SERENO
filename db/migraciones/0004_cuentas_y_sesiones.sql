-- =====================================================================
-- SERENO · cuentas de verdad y sesiones
--
-- Hasta aqui `usuarios` existia pero no tenia con que autenticar a nadie: la
-- idea era colgar un proveedor externo en `sujeto_externo`. Esta migracion
-- agrega la autenticacion propia, sin dependencias y sin proveedor.
--
-- `sujeto_externo` NO se toca y queda libre: el dia que se conecte Neon Auth,
-- Clerk o lo que sea, se llena esa columna y conviven las dos formas de entrar.
--
-- DOS DECISIONES QUE IMPORTAN:
--
--  1. La contrasena no se guarda. Se guarda el resultado de scrypt con una sal
--     aleatoria por usuario (ver src/lib/auth.ts). scrypt esta en la libreria
--     estandar de Node: cero dependencias nuevas.
--
--  2. El token de sesion tampoco se guarda. Se guarda su SHA-256. Si alguien
--     se lleva la tabla `sesiones`, no puede entrar con nada de lo que hay
--     ahi: necesitaria el token original, que solo vive en la cookie del
--     telefono del productor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Con que entra un usuario
-- ---------------------------------------------------------------------

alter table public.usuarios
  add column if not exists contrasena_hash text,
  add column if not exists ultimo_acceso_en timestamptz;

-- El correo no distingue mayusculas: "Ana@x.com" y "ana@x.com" son la misma
-- persona, y dos cuentas con el mismo correo serian un agujero de seguridad,
-- no una molestia.
create unique index if not exists usuarios_correo_unico_sin_mayusculas
  on public.usuarios (lower(correo))
  where correo is not null;

-- ---------------------------------------------------------------------
-- 2 · Sesiones
-- ---------------------------------------------------------------------

create table if not exists public.sesiones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  -- SHA-256 del token, nunca el token.
  token_hash text not null unique,
  creada_en timestamptz not null default now(),
  ultimo_uso_en timestamptz not null default now(),
  expira_en timestamptz not null,
  -- Para que el productor pueda reconocer desde donde entro. Se guarda
  -- recortado y sin nada que identifique a la persona.
  agente text
);

create index if not exists sesiones_usuario_idx on public.sesiones (usuario_id);
create index if not exists sesiones_expira_idx on public.sesiones (expira_en);

-- RLS activado y SIN policy para `sereno_app`: en Postgres eso significa que
-- ese rol no ve ni una fila. Es deliberado — las sesiones solo las toca el rol
-- de servicio, al entrar y al salir. La app nunca necesita leerlas.
alter table public.sesiones enable row level security;

-- Y tampoco se le da grant. Las dos capas, como en 0002.
revoke all on public.sesiones from sereno_app;

-- ---------------------------------------------------------------------
-- 3 · Un dato que la pantalla de parcela pide y no tenia donde guardarse
-- ---------------------------------------------------------------------

-- El municipio escrito a mano ("Chiantla, Huehuetenango"). `productores` tiene
-- departamento y municipio, pero son del productor, no de cada parcela: un
-- productor puede tener parcelas en dos lugares.
alter table public.parcelas
  add column if not exists lugar text;

-- ---------------------------------------------------------------------
-- 4 · Limpieza de sesiones vencidas
--
-- Sin cron: se llama desde el backend de vez en cuando. Una sesion vencida ya
-- no sirve para entrar (el backend compara `expira_en`), pero no tiene por que
-- quedarse en la tabla.
-- ---------------------------------------------------------------------

create or replace function public.borrar_sesiones_vencidas()
returns integer
language plpgsql
as $$
declare
  borradas integer;
begin
  delete from public.sesiones where expira_en < now();
  get diagnostics borradas = row_count;
  return borradas;
end $$;

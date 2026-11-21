-- =====================================================================
-- SERENO · Row Level Security, en Postgres puro
--
-- Regla central: UN PRODUCTOR VE SOLO SUS PARCELAS y todo lo que cuelga de
-- ellas (incidencia, aplicaciones, podas, eventos, avisos).
--
-- ============================ COMO FUNCIONA ============================
-- No hay `auth.uid()`: eso es de Supabase. Aqui la identidad viene de una
-- VARIABLE DE SESION que el backend pone al abrir la transaccion:
--
--     SET LOCAL sereno.usuario_id = '<uuid del usuario>';
--
-- `sereno_usuario_actual()` la lee. Es `SET LOCAL`, asi que muere al terminar la
-- transaccion y no se filtra a la siguiente peticion del pool.
--
-- DOS ROLES, y la diferencia importa:
--
--   · El DUENO de las tablas (en Neon, `sereno_owner`) es quien corre las
--     migraciones y es el rol de SERVICIO del backend: el motor, el guardado de
--     series y la escritura de las fuentes externas. En Postgres el dueno de una
--     tabla SALTA el RLS, que es justo lo que se quiere aqui.
--
--   · `sereno_app` es el rol con el que el backend atiende las peticiones de un
--     productor. NO es dueno de nada, asi que el RLS SI se le aplica. Es el rol
--     que va en la cadena de conexion del frontend/API de usuario.
--
-- Si alguien cambia esto y hace que la app se conecte como dueno, el RLS deja de
-- servir sin que salte ningun error. Por eso esta escrito aqui y no solo en el
-- README.
-- =======================================================================

-- ---------------------------------------------------------------------
-- 0 · El rol de la aplicacion
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'sereno_app') then
    create role sereno_app nologin;
  end if;
end $$;

grant usage on schema public to sereno_app;

-- ---------------------------------------------------------------------
-- 1 · Quien es el usuario de esta transaccion
-- ---------------------------------------------------------------------

-- Devuelve el uuid del usuario de la sesion, o null si no se puso la variable.
-- El `true` de current_setting evita el error cuando la variable no existe.
create or replace function public.sereno_usuario_actual()
returns uuid
language plpgsql
stable
as $$
declare
  crudo text;
begin
  crudo := current_setting('sereno.usuario_id', true);
  if crudo is null or crudo = '' then
    return null;
  end if;
  begin
    return crudo::uuid;
  exception when invalid_text_representation then
    -- Una variable con basura no debe dar acceso a nada: se trata como anonimo.
    return null;
  end;
end $$;

-- El id de productor del usuario de la sesion.
create or replace function public.mi_productor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.productores p
  where p.usuario_id = public.sereno_usuario_actual()
$$;

grant execute on function public.sereno_usuario_actual() to sereno_app;
grant execute on function public.mi_productor_id() to sereno_app;

-- ---------------------------------------------------------------------
-- 2 · RLS activado en todas las tablas
-- ---------------------------------------------------------------------
alter table public.usuarios             enable row level security;
alter table public.productores          enable row level security;
alter table public.parcelas             enable row level security;
alter table public.reportes_incidencia  enable row level security;
alter table public.aplicaciones         enable row level security;
alter table public.podas                enable row level security;
alter table public.eventos_infeccion    enable row level security;
alter table public.avisos               enable row level security;
alter table public.series_horarias      enable row level security;
alter table public.variedades           enable row level security;
alter table public.documentos_anacafe   enable row level security;
alter table public.noticias             enable row level security;
alter table public.precios              enable row level security;

-- ---------------------------------------------------------------------
-- 3 · Usuarios y productores: cada quien lo suyo
-- ---------------------------------------------------------------------
drop policy if exists usuarios_lee_lo_suyo on public.usuarios;
create policy usuarios_lee_lo_suyo on public.usuarios
  for select to sereno_app
  using (id = public.sereno_usuario_actual());

drop policy if exists productores_lo_suyo on public.productores;
create policy productores_lo_suyo on public.productores
  for all to sereno_app
  using (usuario_id = public.sereno_usuario_actual())
  with check (usuario_id = public.sereno_usuario_actual());

-- ---------------------------------------------------------------------
-- 4 · Parcelas: la dueña de todo el arbol de permisos
-- ---------------------------------------------------------------------
drop policy if exists parcelas_solo_mias on public.parcelas;
create policy parcelas_solo_mias on public.parcelas
  for all to sereno_app
  using (productor_id = public.mi_productor_id())
  with check (productor_id = public.mi_productor_id());

-- ---------------------------------------------------------------------
-- 5 · Todo lo que cuelga de una parcela
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['reportes_incidencia','aplicaciones','podas','avisos']
  loop
    execute format('drop policy if exists %1$s_por_parcela on public.%1$s', t);
    execute format($f$
      create policy %1$s_por_parcela on public.%1$s
        for all to sereno_app
        using (exists (
          select 1 from public.parcelas p
          where p.id = %1$s.parcela_id and p.productor_id = public.mi_productor_id()))
        with check (exists (
          select 1 from public.parcelas p
          where p.id = %1$s.parcela_id and p.productor_id = public.mi_productor_id()))
    $f$, t);
  end loop;
end $$;

-- Eventos de infeccion: los de mis parcelas los leo; los de corridas historicas
-- (sin parcela_id) son publicos, porque son la demostracion del motor y no
-- contienen datos de nadie.
drop policy if exists eventos_mios_o_historicos on public.eventos_infeccion;
create policy eventos_mios_o_historicos on public.eventos_infeccion
  for select to sereno_app
  using (
    parcela_id is null
    or exists (
      select 1 from public.parcelas p
      where p.id = eventos_infeccion.parcela_id and p.productor_id = public.mi_productor_id())
  );

-- NO hay policy de insert/update/delete para eventos_infeccion: el motor corre
-- en el servidor con el rol dueno. Nadie debe poder insertar un evento a mano.

-- ---------------------------------------------------------------------
-- 6 · Contenido publico: lectura para la app, escritura solo del backend
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['variedades','documentos_anacafe','noticias','precios','series_horarias']
  loop
    execute format('drop policy if exists %1$s_lectura_publica on public.%1$s', t);
    execute format($f$
      create policy %1$s_lectura_publica on public.%1$s
        for select to sereno_app using (true)
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7 · Permisos de tabla para el rol de la aplicacion
--
-- RLS filtra FILAS; los grants deciden que operaciones existen. Las dos capas
-- hacen falta: sin grant no hay acceso, y sin RLS el grant lo daria todo.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on
  public.productores, public.parcelas, public.reportes_incidencia,
  public.aplicaciones, public.podas, public.avisos
  to sereno_app;

-- Solo lectura: el contenido de las fuentes externas y los eventos que calcula
-- el motor. La app los muestra, no los escribe.
grant select on
  public.usuarios, public.eventos_infeccion, public.variedades,
  public.documentos_anacafe, public.noticias, public.precios,
  public.series_horarias
  to sereno_app;

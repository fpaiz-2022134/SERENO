-- =====================================================================
-- SERENO · Row Level Security
--
-- Regla central: UN PRODUCTOR VE SOLO SUS PARCELAS y todo lo que cuelga de
-- ellas (incidencia, aplicaciones, podas, eventos, avisos).
--
-- El contenido publico (variedades, documentos de Anacafe, noticias, precios,
-- series de clima cacheadas) es de LECTURA para cualquier usuario autenticado y
-- de ESCRITURA solo para el service_role, que es el que usan los route handlers
-- del backend. El anon key nunca escribe nada.
-- =====================================================================

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
-- Helper: el id de productor del usuario de la sesion
-- ---------------------------------------------------------------------
create or replace function public.mi_productor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.productores where usuario_id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- Productores: cada quien su propia ficha
-- ---------------------------------------------------------------------
drop policy if exists productores_lee_lo_suyo on public.productores;
create policy productores_lee_lo_suyo on public.productores
  for select using (usuario_id = auth.uid());

drop policy if exists productores_crea_lo_suyo on public.productores;
create policy productores_crea_lo_suyo on public.productores
  for insert with check (usuario_id = auth.uid());

drop policy if exists productores_edita_lo_suyo on public.productores;
create policy productores_edita_lo_suyo on public.productores
  for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- ---------------------------------------------------------------------
-- Parcelas: la dueña de todo el arbol de permisos
-- ---------------------------------------------------------------------
drop policy if exists parcelas_solo_mias on public.parcelas;
create policy parcelas_solo_mias on public.parcelas
  for all
  using (productor_id = public.mi_productor_id())
  with check (productor_id = public.mi_productor_id());

-- ---------------------------------------------------------------------
-- Todo lo que cuelga de una parcela
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['reportes_incidencia','aplicaciones','podas','avisos']
  loop
    execute format('drop policy if exists %1$s_por_parcela on public.%1$s', t);
    execute format($f$
      create policy %1$s_por_parcela on public.%1$s
        for all
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
-- (sin parcela_id) son publicos para usuarios autenticados, porque son la
-- demostracion del motor y no contienen datos de nadie.
drop policy if exists eventos_mios_o_historicos on public.eventos_infeccion;
create policy eventos_mios_o_historicos on public.eventos_infeccion
  for select
  using (
    parcela_id is null
    or exists (
      select 1 from public.parcelas p
      where p.id = eventos_infeccion.parcela_id and p.productor_id = public.mi_productor_id())
  );

-- La escritura de eventos es del backend (service_role), que salta RLS: el
-- motor corre en el servidor y nadie debe poder insertar un evento a mano.

-- ---------------------------------------------------------------------
-- Contenido publico: lectura para autenticados, escritura del backend
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['variedades','documentos_anacafe','noticias','precios','series_horarias']
  loop
    execute format('drop policy if exists %1$s_lectura_publica on public.%1$s', t);
    execute format($f$
      create policy %1$s_lectura_publica on public.%1$s
        for select to authenticated using (true)
    $f$, t);
  end loop;
end $$;

-- NOTA: no se crea ninguna policy de insert/update/delete para esas tablas.
-- Con RLS activado y sin policy, el anon key y el usuario autenticado no pueden
-- escribir; el service_role del backend si, porque salta RLS. Eso es
-- deliberado: las fuentes externas solo las escribe el servidor.

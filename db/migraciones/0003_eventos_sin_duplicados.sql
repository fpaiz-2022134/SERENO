-- =====================================================================
-- SERENO · evita eventos duplicados
--
-- El motor es determinista: la misma serie y los mismos parametros dan
-- exactamente la misma racha. Asi que volver a correr la corrida historica no
-- debe crear filas nuevas, tiene que caer sobre las mismas.
--
-- Sin esto, llamar /api/historico?guardar=1 dos veces duplicaba todo.
--
-- `nulls not distinct` es lo que hace que funcione para los eventos de corridas
-- historicas, que no tienen parcela_id: sin eso, Postgres considera dos nulls
-- como distintos y la restriccion no agarra.
-- =====================================================================

-- Por si quedaron duplicados de antes de esta migracion: se deja el mas viejo.
delete from public.eventos_infeccion e
where exists (
  select 1 from public.eventos_infeccion otro
  where otro.ctid < e.ctid
    and otro.parcela_id is not distinct from e.parcela_id
    and otro.latitud is not distinct from e.latitud
    and otro.longitud is not distinct from e.longitud
    and otro.patogeno_id = e.patogeno_id
    and otro.inicio = e.inicio
    and otro.es_pronostico = e.es_pronostico
);

create unique index if not exists eventos_infeccion_unico
  on public.eventos_infeccion (parcela_id, latitud, longitud, patogeno_id, inicio, es_pronostico)
  nulls not distinct;

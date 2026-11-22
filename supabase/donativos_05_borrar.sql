-- =====================================================================
-- DONATIVOS — Actualización: el admin puede borrar cualquier solicitud
-- (si tiene cupones canjeados, la app pide confirmar y se borran también del reporte)
-- SQL Editor → New query → pega TODO → Run. "Success. No rows returned".
-- =====================================================================

-- ADMIN: borrar una solicitud completa con sus cupones.
-- Si ya tiene cupones canjeados, solo se borra con p_forzar = true (se pierden del reporte).
drop function if exists public.don_borrar_solicitud(uuid);
create or replace function public.don_borrar_solicitud(p_id uuid, p_forzar boolean default false) returns void
language plpgsql volatile security definer set search_path = donativos, public as $$
begin
  perform donativos._exigir_admin();
  if not coalesce(p_forzar, false)
     and exists (select 1 from donativos.cupones where solicitud_id = p_id and estado = 'canjeado') then
    raise exception 'TIENE_CANJEADOS';
  end if;
  delete from donativos.solicitudes where id = p_id;
end $$;

revoke execute on function public.don_borrar_solicitud(uuid, boolean) from public;
grant execute on function public.don_borrar_solicitud(uuid, boolean) to authenticated;

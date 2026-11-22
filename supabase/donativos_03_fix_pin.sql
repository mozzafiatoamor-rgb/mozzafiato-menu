-- =====================================================================
-- DONATIVOS — Arreglo: "DELETE requires a WHERE clause" al guardar el PIN de caja
-- Supabase bloquea DELETE sin WHERE en llamadas desde la web; aquí se agrega.
-- SQL Editor → New query → pega TODO → Run. "Success. No rows returned".
-- =====================================================================
create or replace function public.don_set_pin_caja(p_pin text) returns void
language plpgsql volatile security definer set search_path = donativos, extensions, public as $$
begin
  perform donativos._exigir_admin();
  if p_pin is null or length(trim(p_pin)) < 4 then raise exception 'PIN_CORTO'; end if;
  insert into donativos.config (clave, valor) values ('pin_caja', extensions.crypt(trim(p_pin), extensions.gen_salt('bf')))
  on conflict (clave) do update set valor = excluded.valor;
  delete from donativos.intentos_pin where id is not null;
end $$;

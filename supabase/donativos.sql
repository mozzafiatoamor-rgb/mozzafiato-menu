-- =====================================================================
-- MOZZAFIATO — DONATIVOS (cupones para rifas de escuelas e instituciones)
-- =====================================================================
-- Qué hace:
--   Crea un esquema propio "donativos" (separado de casa_regina, produccion, etc.)
--   con 4 tablas: admins, config, solicitudes, cupones (+ registro de intentos de PIN).
--   Las tablas NO se pueden leer ni escribir directo desde la web: todo pasa por
--   funciones "don_*" que revisan permisos:
--     · Admin (tú): login de Supabase + estar en donativos.admins.
--     · Institución: solo ve SUS cupones con el link secreto (token).
--     · Caja: consulta y canjea con el PIN de caja.
--
-- Es SEGURO: no toca ninguna tabla de tus otras apps. Si lo corres dos veces no
-- duplica nada (usa "if not exists" / "create or replace").
--
-- Cómo correrlo:
--   1) Supabase → SQL Editor → New query → pega TODO este archivo → Run.
--      Debe decir "Success. No rows returned".
--   2) Luego corre el archivo donativos_02_admin.sql (te da acceso de admin).
-- =====================================================================

create schema if not exists donativos;
create extension if not exists pgcrypto with schema extensions;

-- ---------- Tablas ----------
create table if not exists donativos.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creado  timestamptz not null default now()
);

create table if not exists donativos.config (
  clave text primary key,
  valor text
);

create table if not exists donativos.solicitudes (
  id           uuid primary key default gen_random_uuid(),
  token        text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  institucion  text not null,
  contacto     text,
  telefono     text,
  motivo       text,
  evento       text,
  fecha_evento date,
  notas        text,
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now()
);

create table if not exists donativos.cupones (
  id             uuid primary key default gen_random_uuid(),
  solicitud_id   uuid not null references donativos.solicitudes(id) on delete cascade,
  token          text not null unique default encode(extensions.gen_random_bytes(10), 'hex'),
  folio          text not null unique,
  orden          int  not null default 0,
  tipo           text not null check (tipo in ('producto','monto')),
  titulo         text not null,
  items          jsonb not null default '[]'::jsonb,   -- [{nombre, cant, precio}]
  monto          numeric(10,2),                         -- solo tipo 'monto'
  valor          numeric(10,2) not null default 0,      -- valor en pesos (para el reporte)
  condiciones    text,
  vence          date,
  estado         text not null default 'activo' check (estado in ('activo','canjeado','cancelado')),
  canjeado_en    timestamptz,
  ganador_nombre text,
  ganador_tel    text,
  canje_notas    text,
  creado         timestamptz not null default now()
);
create index if not exists cupones_solicitud_idx on donativos.cupones(solicitud_id);
-- Fecha desde la que se puede canjear (si está vacía, cuenta la fecha de la rifa)
alter table donativos.cupones add column if not exists valido_desde date;

create table if not exists donativos.intentos_pin (
  id  bigserial primary key,
  ts  timestamptz not null default now()
);

-- Nadie entra directo a las tablas (solo por las funciones de abajo)
alter table donativos.admins       enable row level security;
alter table donativos.config       enable row level security;
alter table donativos.solicitudes  enable row level security;
alter table donativos.cupones      enable row level security;
alter table donativos.intentos_pin enable row level security;
revoke all on schema donativos from anon, authenticated;
revoke all on all tables in schema donativos from anon, authenticated;

-- ---------- Ayudantes internos ----------
create or replace function donativos._hoy() returns date
language sql stable as $$ select (now() at time zone 'America/Cancun')::date $$;

create or replace function donativos._es_admin() returns boolean
language sql stable security definer set search_path = donativos, public as $$
  select auth.uid() is not null and exists (select 1 from donativos.admins a where a.user_id = auth.uid());
$$;

create or replace function donativos._exigir_admin() returns void
language plpgsql stable security definer set search_path = donativos, public as $$
begin
  if not donativos._es_admin() then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
end $$;

-- Folio corto, sin letras confusas (sin 0/O, 1/I/L)
create or replace function donativos._nuevo_folio() returns text
language plpgsql volatile security definer set search_path = donativos, extensions, public as $$
declare
  abc text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  f text; i int; b bytea;
begin
  loop
    b := extensions.gen_random_bytes(5);
    f := 'DON-';
    for i in 0..4 loop
      f := f || substr(abc, (get_byte(b, i) % length(abc)) + 1, 1);
    end loop;
    exit when not exists (select 1 from donativos.cupones c where c.folio = f);
  end loop;
  return f;
end $$;

-- Revisa el PIN de caja, con freno anti "adivinar" (máx. 15 fallos en 10 min)
create or replace function donativos._pin_ok(p_pin text) returns boolean
language plpgsql volatile security definer set search_path = donativos, extensions, public as $$
declare h text; fallos int;
begin
  select count(*) into fallos from donativos.intentos_pin where ts > now() - interval '10 minutes';
  if fallos >= 15 then
    raise exception 'DEMASIADOS_INTENTOS';
  end if;
  select valor into h from donativos.config where clave = 'pin_caja';
  if h is null then
    raise exception 'SIN_PIN_CAJA';
  end if;
  if p_pin is not null and extensions.crypt(p_pin, h) = h then
    return true;
  end if;
  insert into donativos.intentos_pin default values;
  delete from donativos.intentos_pin where ts < now() - interval '1 day';
  return false;
end $$;

-- Desde cuándo se puede canjear: su propia fecha o, si no tiene, la fecha de la rifa
create or replace function donativos._desde(c donativos.cupones) returns date
language sql stable set search_path = donativos, public as $$
  select coalesce(c.valido_desde, (select s.fecha_evento from donativos.solicitudes s where s.id = c.solicitud_id));
$$;

create or replace function donativos._cupon_json(c donativos.cupones, privado boolean) returns jsonb
language sql stable set search_path = donativos, public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id',          case when privado then c.id end,
    'token',       c.token,
    'folio',       c.folio,
    'orden',       c.orden,
    'tipo',        c.tipo,
    'titulo',      c.titulo,
    'items',       case when privado then c.items
                        else coalesce((select jsonb_agg(i - 'precio') from jsonb_array_elements(c.items) i), '[]'::jsonb) end,
    'monto',       c.monto,
    'valor',       case when privado then c.valor end,
    'condiciones', c.condiciones,
    'vence',       c.vence,
    'valido_desde', case when privado then c.valido_desde end,
    'desde',       donativos._desde(c),
    'pendiente',   (c.estado = 'activo' and donativos._desde(c) is not null and donativos._desde(c) > donativos._hoy()),
    'estado',      c.estado,
    'vencido',     (c.estado = 'activo' and c.vence is not null and c.vence < donativos._hoy()),
    'canjeado_en', c.canjeado_en,
    'ganador_nombre', case when privado then c.ganador_nombre end,
    'ganador_tel',    case when privado then c.ganador_tel end,
    'canje_notas',    case when privado then c.canje_notas end
  ));
$$;

-- =====================================================================
-- FUNCIONES PÚBLICAS (las llama la web)
-- =====================================================================

-- ¿El usuario con sesión es admin de donativos?
create or replace function public.don_es_admin() returns boolean
language sql stable security definer set search_path = donativos, public as $$
  select donativos._es_admin();
$$;

-- ADMIN: todas las solicitudes con sus cupones
create or replace function public.don_listar() returns jsonb
language plpgsql stable security definer set search_path = donativos, public as $$
begin
  perform donativos._exigir_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'token', s.token, 'institucion', s.institucion, 'contacto', s.contacto,
      'telefono', s.telefono, 'motivo', s.motivo, 'evento', s.evento,
      'fecha_evento', s.fecha_evento, 'notas', s.notas, 'creado', s.creado,
      'cupones', coalesce((select jsonb_agg(donativos._cupon_json(c, true) order by c.orden, c.creado)
                           from donativos.cupones c where c.solicitud_id = s.id), '[]'::jsonb)
    ) order by s.creado desc)
    from donativos.solicitudes s), '[]'::jsonb);
end $$;

-- ADMIN: crear o editar una solicitud con sus cupones.
-- p = {id?, institucion, contacto, telefono, motivo, evento, fecha_evento, notas,
--      cupones:[{id?, tipo, titulo, items, monto, condiciones, vence, cancelar?}]}
-- · Cupones con id se actualizan (solo si siguen activos/cancelados, nunca un canjeado).
-- · Cupones sin id se crean con folio nuevo.
-- · Cupones activos que ya no vienen en la lista se borran (los canjeados nunca se borran).
create or replace function public.don_guardar_solicitud(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = donativos, public as $$
declare
  sid uuid; c jsonb; cid uuid; ids uuid[] := '{}'; n int := 0;
  v_tipo text; v_items jsonb; v_monto numeric; v_valor numeric; v_desde date; v_vence date;
begin
  perform donativos._exigir_admin();
  if coalesce(trim(p->>'institucion'), '') = '' then
    raise exception 'FALTA_INSTITUCION';
  end if;

  if nullif(p->>'id', '') is null then
    insert into donativos.solicitudes (institucion, contacto, telefono, motivo, evento, fecha_evento, notas)
    values (trim(p->>'institucion'), p->>'contacto', p->>'telefono', p->>'motivo', p->>'evento',
            nullif(p->>'fecha_evento','')::date, p->>'notas')
    returning id into sid;
  else
    sid := (p->>'id')::uuid;
    update donativos.solicitudes set
      institucion = trim(p->>'institucion'), contacto = p->>'contacto', telefono = p->>'telefono',
      motivo = p->>'motivo', evento = p->>'evento', fecha_evento = nullif(p->>'fecha_evento','')::date,
      notas = p->>'notas', actualizado = now()
    where id = sid;
    if not found then raise exception 'NO_EXISTE'; end if;
  end if;

  for c in select * from jsonb_array_elements(coalesce(p->'cupones', '[]'::jsonb)) loop
    n := n + 1;
    v_tipo  := coalesce(c->>'tipo', 'producto');
    v_items := case when v_tipo = 'producto' then coalesce(c->'items', '[]'::jsonb) else '[]'::jsonb end;
    v_monto := case when v_tipo = 'monto' then nullif(c->>'monto','')::numeric end;
    v_valor := case when v_tipo = 'monto' then coalesce(v_monto, 0)
                    else coalesce((select sum(coalesce((i->>'cant')::numeric,1) * coalesce((i->>'precio')::numeric,0))
                                   from jsonb_array_elements(v_items) i), 0) end;
    v_desde := nullif(c->>'valido_desde','')::date;
    v_vence := nullif(c->>'vence','')::date;
    if v_desde is not null and v_vence is not null and v_desde > v_vence then raise exception 'FECHAS_INVERTIDAS'; end if;
    if coalesce(trim(c->>'titulo'), '') = '' then raise exception 'FALTA_TITULO_CUPON'; end if;
    if v_tipo = 'monto' and coalesce(v_monto, 0) <= 0 then raise exception 'FALTA_MONTO'; end if;
    if v_tipo = 'producto' and jsonb_array_length(v_items) = 0 then raise exception 'FALTAN_PRODUCTOS'; end if;

    if nullif(c->>'id', '') is null then
      insert into donativos.cupones (solicitud_id, folio, orden, tipo, titulo, items, monto, valor, condiciones, vence, valido_desde)
      values (sid, donativos._nuevo_folio(), n, v_tipo, trim(c->>'titulo'), v_items, v_monto, v_valor,
              c->>'condiciones', v_vence, v_desde)
      returning id into cid;
    else
      cid := (c->>'id')::uuid;
      update donativos.cupones set
        orden = n, tipo = v_tipo, titulo = trim(c->>'titulo'), items = v_items, monto = v_monto,
        valor = v_valor, condiciones = c->>'condiciones', vence = v_vence, valido_desde = v_desde,
        estado = case when coalesce((c->>'cancelar')::boolean, false) then 'cancelado' else 'activo' end
      where id = cid and solicitud_id = sid and estado <> 'canjeado';
      -- si estaba canjeado, solo se respeta su orden
      update donativos.cupones set orden = n where id = cid and solicitud_id = sid and estado = 'canjeado';
    end if;
    ids := ids || cid;
  end loop;

  delete from donativos.cupones
  where solicitud_id = sid and estado <> 'canjeado' and not (id = any(ids));

  return jsonb_build_object('id', sid);
end $$;

-- ADMIN: borrar una solicitud completa (solo si ningún cupón fue canjeado)
create or replace function public.don_borrar_solicitud(p_id uuid) returns void
language plpgsql volatile security definer set search_path = donativos, public as $$
begin
  perform donativos._exigir_admin();
  if exists (select 1 from donativos.cupones where solicitud_id = p_id and estado = 'canjeado') then
    raise exception 'TIENE_CANJEADOS';
  end if;
  delete from donativos.solicitudes where id = p_id;
end $$;

-- ADMIN: deshacer un canje hecho por error
create or replace function public.don_deshacer_canje(p_folio text) returns void
language plpgsql volatile security definer set search_path = donativos, public as $$
begin
  perform donativos._exigir_admin();
  update donativos.cupones set estado = 'activo', canjeado_en = null, ganador_nombre = null,
         ganador_tel = null, canje_notas = null
  where folio = upper(trim(p_folio)) and estado = 'canjeado';
end $$;

-- ADMIN: definir/cambiar el PIN de caja
create or replace function public.don_set_pin_caja(p_pin text) returns void
language plpgsql volatile security definer set search_path = donativos, extensions, public as $$
begin
  perform donativos._exigir_admin();
  if p_pin is null or length(trim(p_pin)) < 4 then raise exception 'PIN_CORTO'; end if;
  insert into donativos.config (clave, valor) values ('pin_caja', extensions.crypt(trim(p_pin), extensions.gen_salt('bf')))
  on conflict (clave) do update set valor = excluded.valor;
  delete from donativos.intentos_pin where id is not null;
end $$;

-- ADMIN: ¿ya hay PIN de caja?
create or replace function public.don_hay_pin_caja() returns boolean
language plpgsql stable security definer set search_path = donativos, public as $$
begin
  perform donativos._exigir_admin();
  return exists (select 1 from donativos.config where clave = 'pin_caja');
end $$;

-- PÚBLICO: la institución ve sus cupones con su link secreto
create or replace function public.don_ver_solicitud(p_token text) returns jsonb
language sql stable security definer set search_path = donativos, public as $$
  select jsonb_build_object(
    'institucion', s.institucion, 'evento', s.evento, 'fecha_evento', s.fecha_evento,
    'cupones', coalesce((select jsonb_agg(donativos._cupon_json(c, false) order by c.orden, c.creado)
                         from donativos.cupones c where c.solicitud_id = s.id and c.estado <> 'cancelado'), '[]'::jsonb))
  from donativos.solicitudes s where s.token = p_token and length(p_token) >= 16;
$$;

-- PÚBLICO: un solo cupón (para reenviárselo al ganador)
create or replace function public.don_ver_cupon(p_token text) returns jsonb
language sql stable security definer set search_path = donativos, public as $$
  select jsonb_build_object('institucion', s.institucion, 'evento', s.evento,
                            'cupon', donativos._cupon_json(c, false))
  from donativos.cupones c join donativos.solicitudes s on s.id = c.solicitud_id
  where c.token = p_token and length(p_token) >= 16 and c.estado <> 'cancelado';
$$;

-- CAJA: ¿el PIN es correcto?
create or replace function public.don_caja_pin_ok(p_pin text) returns boolean
language plpgsql volatile security definer set search_path = donativos, public as $$
begin
  return donativos._pin_ok(p_pin);
end $$;

-- CAJA: consultar un cupón por folio
create or replace function public.don_caja_consultar(p_folio text, p_pin text) returns jsonb
language plpgsql volatile security definer set search_path = donativos, public as $$
declare c donativos.cupones; s donativos.solicitudes;
begin
  -- (devuelve el error en vez de lanzarlo, para que quede registrado el intento fallido)
  if not donativos._pin_ok(p_pin) then return jsonb_build_object('error', 'PIN_INCORRECTO'); end if;
  select * into c from donativos.cupones where folio = upper(trim(p_folio));
  if not found then return jsonb_build_object('error', 'NO_EXISTE'); end if;
  select * into s from donativos.solicitudes where id = c.solicitud_id;
  return jsonb_build_object('institucion', s.institucion, 'evento', s.evento,
                            'cupon', donativos._cupon_json(c, true) - 'id' - 'valor' - 'ganador_tel');
end $$;

-- CAJA: canjear (una sola vez, todo el cupón)
create or replace function public.don_caja_canjear(p_folio text, p_pin text, p_nombre text, p_tel text, p_notas text default null)
returns jsonb
language plpgsql volatile security definer set search_path = donativos, public as $$
declare c donativos.cupones;
begin
  if not donativos._pin_ok(p_pin) then return jsonb_build_object('error', 'PIN_INCORRECTO'); end if;
  if coalesce(trim(p_nombre), '') = '' then return jsonb_build_object('error', 'FALTA_NOMBRE'); end if;
  if coalesce(trim(p_tel), '') = '' then return jsonb_build_object('error', 'FALTA_TELEFONO'); end if;
  select * into c from donativos.cupones where folio = upper(trim(p_folio)) for update;
  if not found then return jsonb_build_object('error', 'NO_EXISTE'); end if;
  if c.estado = 'canjeado' then return jsonb_build_object('error', 'YA_CANJEADO'); end if;
  if c.estado = 'cancelado' then return jsonb_build_object('error', 'CANCELADO'); end if;
  if c.vence is not null and c.vence < donativos._hoy() then return jsonb_build_object('error', 'VENCIDO'); end if;
  if donativos._desde(c) is not null and donativos._desde(c) > donativos._hoy() then
    return jsonb_build_object('error', 'AUN_NO_VALIDO', 'desde', donativos._desde(c));
  end if;
  update donativos.cupones set estado = 'canjeado', canjeado_en = now(),
         ganador_nombre = trim(p_nombre), ganador_tel = trim(p_tel), canje_notas = nullif(trim(p_notas), '')
  where id = c.id;
  return jsonb_build_object('ok', true, 'folio', c.folio, 'canjeado_en', now());
end $$;

-- ---------- Permisos de las funciones ----------
revoke execute on function
  public.don_es_admin(), public.don_listar(), public.don_guardar_solicitud(jsonb),
  public.don_borrar_solicitud(uuid), public.don_deshacer_canje(text), public.don_set_pin_caja(text),
  public.don_hay_pin_caja(), public.don_ver_solicitud(text), public.don_ver_cupon(text),
  public.don_caja_pin_ok(text), public.don_caja_consultar(text, text),
  public.don_caja_canjear(text, text, text, text, text)
from public;

-- Admin: requiere sesión (y además estar en donativos.admins)
grant execute on function
  public.don_es_admin(), public.don_listar(), public.don_guardar_solicitud(jsonb),
  public.don_borrar_solicitud(uuid), public.don_deshacer_canje(text), public.don_set_pin_caja(text),
  public.don_hay_pin_caja()
to authenticated;

-- Institución y caja: sin sesión (protegidos por token secreto o PIN)
grant execute on function
  public.don_ver_solicitud(text), public.don_ver_cupon(text),
  public.don_caja_pin_ok(text), public.don_caja_consultar(text, text),
  public.don_caja_canjear(text, text, text, text, text)
to anon, authenticated;

-- Los ayudantes internos no se exponen
revoke execute on all functions in schema donativos from public, anon, authenticated;

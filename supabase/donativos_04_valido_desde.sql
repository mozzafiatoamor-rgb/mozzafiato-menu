-- =====================================================================
-- DONATIVOS — Actualización: "Válido desde" (no se pueden canjear cupones adelantados)
-- · Cada cupón puede tener fecha de inicio; si no tiene, cuenta la FECHA DE LA RIFA.
-- · La caja no puede canjear antes de esa fecha (lo bloquea la base de datos).
-- Es seguro: no borra nada; solo agrega la columna y actualiza 4 funciones.
-- SQL Editor → New query → pega TODO → Run. "Success. No rows returned".
-- =====================================================================

alter table donativos.cupones add column if not exists valido_desde date;

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

revoke execute on all functions in schema donativos from public, anon, authenticated;

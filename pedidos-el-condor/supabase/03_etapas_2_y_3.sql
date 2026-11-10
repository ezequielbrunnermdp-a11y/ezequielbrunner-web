-- =====================================================================
-- El Cóndor · Etapas 2 y 3: cancelar pedido, estados de entrega, faltantes
-- Pegar en Supabase > SQL Editor DESPUÉS de 01_esquema.sql. Se puede volver a correr.
-- =====================================================================

-- Los estados se cambian solo con marcar_estado(); se quita el permiso de editar pedidos directo.
drop policy if exists pedidos_staff_update on pedidos;

create index if not exists faltantes_estado_idx on faltantes (estado);

-- ---------- Cancelar pedido (cliente hasta la hora de corte; admin siempre) ----------
create or replace function public.cancelar_pedido(
  p_cliente uuid, p_fecha date, p_usuario uuid, p_es_admin boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ped pedidos;
  v_limite timestamp := limite_pedido(p_fecha);
begin
  select * into v_ped from pedidos where cliente_id = p_cliente and fecha_entrega = p_fecha for update;
  if not found or v_ped.estado = 'cancelado' then raise exception 'PED: No hay un pedido para cancelar en esa fecha.'; end if;
  if not p_es_admin then
    if ahora_ar() > v_limite then
      raise exception 'PED: Ya pasó la hora de corte. Para cancelar, comunicate por WhatsApp.';
    end if;
    if v_ped.estado <> 'recibido' then
      raise exception 'PED: El pedido ya está en preparación. Comunicate por WhatsApp.';
    end if;
  end if;
  update pedidos set estado = 'cancelado', updated_at = now() where id = v_ped.id;
  insert into pedido_versiones (pedido_id, version, items, observacion, creado_por)
  values (v_ped.id, v_ped.version, '[]', 'CANCELADO', p_usuario);
  return jsonb_build_object('pedido_id', v_ped.id);
end $$;

revoke all on function public.cancelar_pedido(uuid, date, uuid, boolean) from public, anon, authenticated;
grant execute on function public.cancelar_pedido(uuid, date, uuid, boolean) to service_role;

-- ---------- Cambiar estado / marcar entrega (admin y fábrica) ----------
-- p_faltantes: [{producto_id, cantidad}] — solo para 'entregado_faltantes'
create or replace function public.marcar_estado(p_pedido bigint, p_estado estado_pedido, p_faltantes jsonb default '[]')
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ped pedidos;
  v_r record;
  v_n int := 0;
begin
  if not es_staff() then raise exception 'PED: No tenés permiso.'; end if;
  if p_estado = 'cancelado' and not es_admin() then raise exception 'PED: Solo el administrador puede cancelar pedidos.'; end if;
  select * into v_ped from pedidos where id = p_pedido for update;
  if not found then raise exception 'PED: El pedido no existe.'; end if;

  -- Volver a marcar reemplaza los faltantes que siguen abiertos
  delete from faltantes where pedido_id = p_pedido and estado = 'abierto';

  if p_estado = 'entregado_faltantes' then
    for v_r in
      select x.producto_id, sum(x.cantidad) as cantidad
      from jsonb_to_recordset(coalesce(p_faltantes, '[]')) as x(producto_id int, cantidad numeric)
      where coalesce(x.cantidad, 0) > 0
      group by x.producto_id
    loop
      if not exists (select 1 from pedido_items i where i.pedido_id = p_pedido and i.producto_id = v_r.producto_id and v_r.cantidad <= i.cantidad) then
        raise exception 'PED: Un faltante no coincide con lo pedido.';
      end if;
      insert into faltantes (pedido_id, producto_id, cantidad) values (p_pedido, v_r.producto_id, v_r.cantidad);
      v_n := v_n + 1;
    end loop;
    if v_n = 0 then raise exception 'PED: Indicá qué faltó.'; end if;
  end if;

  update pedidos set estado = p_estado, updated_at = now() where id = p_pedido;
end $$;

revoke all on function public.marcar_estado(bigint, estado_pedido, jsonb) from public, anon;
grant execute on function public.marcar_estado(bigint, estado_pedido, jsonb) to authenticated, service_role;

-- ---------- Pasar un faltante a otro día ----------
-- Suma el producto al pedido del cliente para p_fecha (lo crea si no existe).
create or replace function public.reprogramar_faltante(p_faltante bigint, p_fecha date, p_usuario uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_f faltantes;
  v_origen pedidos;
  v_ped pedidos;
  v_prod productos;
  v_nuevo boolean := false;
  v_prev jsonb;
  v_prev_obs text;
  v_items jsonb;
  v_era_cancelado boolean := false;
begin
  select * into v_f from faltantes where id = p_faltante for update;
  if not found or v_f.estado <> 'abierto' then raise exception 'PED: Ese faltante ya no está pendiente.'; end if;
  select * into v_origen from pedidos where id = v_f.pedido_id;
  select * into v_prod from productos where id = v_f.producto_id;

  select * into v_ped from pedidos where cliente_id = v_origen.cliente_id and fecha_entrega = p_fecha for update;
  if not found then
    v_nuevo := true;
    insert into pedidos (cliente_id, fecha_entrega, observacion, cargado_por, cargado_por_admin)
    values (v_origen.cliente_id, p_fecha, format('Faltante del pedido #%s', v_origen.id), p_usuario, true)
    returning * into v_ped;
    v_prev := '[]';
  else
    if v_ped.estado not in ('recibido', 'en_preparacion', 'cancelado') then
      raise exception 'PED: El pedido de ese día ya fue entregado. Elegí otra fecha.';
    end if;
    v_prev_obs := v_ped.observacion;
    select coalesce(jsonb_agg(jsonb_build_object('producto_id', producto_id, 'nombre', producto_nombre,
             'presentacion', presentacion, 'cantidad', cantidad) order by id), '[]')
      into v_prev from pedido_items where pedido_id = v_ped.id;
    if v_ped.estado = 'cancelado' then
      v_era_cancelado := true;
      delete from pedido_items where pedido_id = v_ped.id;
      v_prev := '[]';
    end if;
  end if;

  insert into pedido_items (pedido_id, producto_id, producto_nombre, presentacion, cantidad, precio_unitario)
  values (v_ped.id, v_prod.id, v_prod.nombre, v_prod.presentacion, v_f.cantidad, v_prod.precio_sin_iva)
  on conflict (pedido_id, producto_id) do update set cantidad = pedido_items.cantidad + excluded.cantidad;

  select jsonb_agg(jsonb_build_object('producto_id', producto_id, 'nombre', producto_nombre,
           'presentacion', presentacion, 'cantidad', cantidad) order by id)
    into v_items from pedido_items where pedido_id = v_ped.id;

  update pedidos set
    version = case when v_nuevo then 1 else version + 1 end,
    modificado = not v_nuevo and estado <> 'cancelado',
    estado = case when estado = 'cancelado' then 'recibido' else estado end,
    observacion = case when v_nuevo or estado <> 'cancelado' then observacion else format('Faltante del pedido #%s', v_origen.id) end,
    total_sin_iva = (select coalesce(sum(cantidad * precio_unitario), 0) from pedido_items where pedido_id = v_ped.id),
    updated_at = now()
  where id = v_ped.id
  returning * into v_ped;

  insert into pedido_versiones (pedido_id, version, items, observacion, creado_por)
  values (v_ped.id, v_ped.version, v_items, v_ped.observacion, p_usuario);

  update faltantes set estado = 'reprogramado', pedido_destino_id = v_ped.id where id = v_f.id;

  return jsonb_build_object('pedido_id', v_ped.id, 'version', v_ped.version, 'nuevo', v_nuevo,
    'reactivado', v_era_cancelado, 'items_anteriores', v_prev, 'observacion_anterior', v_prev_obs);
end $$;

revoke all on function public.reprogramar_faltante(bigint, date, uuid) from public, anon, authenticated;
grant execute on function public.reprogramar_faltante(bigint, date, uuid) to service_role;

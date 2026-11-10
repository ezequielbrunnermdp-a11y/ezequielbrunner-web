-- =====================================================================
-- El Cóndor · Pedidos mayoristas · Esquema de base de datos
-- Pegar completo en Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
do $$ begin
  create type rol_usuario as enum ('admin', 'cliente', 'fabrica');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_cliente as enum ('activo', 'suspendido', 'baja');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_pedido as enum ('recibido', 'en_preparacion', 'entregado', 'entregado_faltantes', 'cancelado');
exception when duplicate_object then null; end $$;

-- ---------- Tablas ----------
create table if not exists clientes (
  id                   uuid primary key default gen_random_uuid(),
  razon_social         text not null,
  nombre_fantasia      text,
  cuit                 text,
  email                text,
  telefono             text,
  direccion            text,
  horario_limite       text,                       -- ej. "hasta las 11 hs"
  dias_cerrado         smallint[] not null default '{}', -- 0 = domingo ... 6 = sábado
  observaciones_fijas  text,                       -- ej. "va sin cargo"
  ve_precios           boolean not null default true,
  restringir_catalogo  boolean not null default false, -- true = solo ve los productos de cliente_productos
  estado               estado_cliente not null default 'activo',
  created_at           timestamptz not null default now()
);

create table if not exists perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  rol         rol_usuario not null,
  cliente_id  uuid references clientes (id) on delete set null,
  nombre      text,
  email       text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists categorias (
  id       serial primary key,
  seccion  text not null,
  nombre   text not null,
  orden    int not null default 0,
  unique (seccion, nombre)
);

create table if not exists productos (
  id              serial primary key,
  categoria_id    int not null references categorias (id),
  nombre          text not null,
  presentacion    text not null,
  precio_sin_iva  numeric(12, 2) not null default 0,
  permite_medios  boolean not null default false,  -- true para productos por kg (acepta 0,5)
  activo          boolean not null default true,
  orden           int not null default 0,
  unique (nombre, presentacion)
);

create table if not exists cliente_productos (
  cliente_id   uuid references clientes (id) on delete cascade,
  producto_id  int references productos (id) on delete cascade,
  primary key (cliente_id, producto_id)
);

create table if not exists pedidos (
  id                bigserial primary key,          -- número de pedido (#123)
  cliente_id        uuid not null references clientes (id),
  fecha_entrega     date not null,
  estado            estado_pedido not null default 'recibido',
  observacion       text,
  version           int not null default 1,
  modificado        boolean not null default false,  -- se modificó después del primer envío
  cargado_por       uuid references auth.users (id),
  cargado_por_admin boolean not null default false,
  total_sin_iva     numeric(14, 2) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (cliente_id, fecha_entrega)
);

create table if not exists pedido_items (
  id               bigserial primary key,
  pedido_id        bigint not null references pedidos (id) on delete cascade,
  producto_id      int not null references productos (id),
  producto_nombre  text not null,
  presentacion     text not null,
  cantidad         numeric(10, 2) not null check (cantidad > 0),
  precio_unitario  numeric(12, 2) not null default 0,
  unique (pedido_id, producto_id)
);

create table if not exists pedido_versiones (
  id           bigserial primary key,
  pedido_id    bigint not null references pedidos (id) on delete cascade,
  version      int not null,
  items        jsonb not null,
  observacion  text,
  creado_por   uuid references auth.users (id),
  created_at   timestamptz not null default now()
);

create table if not exists pedidos_habituales (
  cliente_id  uuid primary key references clientes (id) on delete cascade,
  items       jsonb not null default '[]',
  updated_at  timestamptz not null default now()
);

create table if not exists faltantes (
  id                 bigserial primary key,
  pedido_id          bigint not null references pedidos (id) on delete cascade,
  producto_id        int not null references productos (id),
  cantidad           numeric(10, 2) not null,
  estado             text not null default 'abierto' check (estado in ('abierto', 'reprogramado', 'cerrado')),
  pedido_destino_id  bigint references pedidos (id),
  nota               text,
  created_at         timestamptz not null default now()
);

create table if not exists config (
  id          int primary key default 1 check (id = 1),
  hora_corte  time not null default '20:00'
);
insert into config (id) values (1) on conflict do nothing;

create table if not exists resumenes_enviados (
  fecha_entrega  date primary key,
  enviado_at     timestamptz not null default now(),
  manual         boolean not null default false
);

create index if not exists pedidos_fecha_idx on pedidos (fecha_entrega);
create index if not exists pedido_items_pedido_idx on pedido_items (pedido_id);

-- ---------- Funciones de ayuda para las reglas de acceso ----------
create or replace function public.mi_rol() returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid() and activo
$$;

create or replace function public.mi_cliente() returns uuid
language sql stable security definer set search_path = public as $$
  select cliente_id from perfiles where id = auth.uid() and activo
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select rol = 'admin' from perfiles where id = auth.uid() and activo), false)
$$;

create or replace function public.es_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select rol in ('admin', 'fabrica') from perfiles where id = auth.uid() and activo), false)
$$;

-- ---------- Reglas de acceso (RLS) ----------
alter table clientes            enable row level security;
alter table perfiles            enable row level security;
alter table categorias          enable row level security;
alter table productos           enable row level security;
alter table cliente_productos   enable row level security;
alter table pedidos             enable row level security;
alter table pedido_items        enable row level security;
alter table pedido_versiones    enable row level security;
alter table pedidos_habituales  enable row level security;
alter table faltantes           enable row level security;
alter table config              enable row level security;
alter table resumenes_enviados  enable row level security;

-- clientes: admin todo; fábrica lee; cada cliente lee su ficha
drop policy if exists clientes_admin on clientes;
create policy clientes_admin on clientes for all using (es_admin()) with check (es_admin());
drop policy if exists clientes_lectura on clientes;
create policy clientes_lectura on clientes for select using (es_staff() or id = mi_cliente());

-- perfiles: cada uno lee el suyo; admin todo
drop policy if exists perfiles_propio on perfiles;
create policy perfiles_propio on perfiles for select using (id = auth.uid() or es_admin());
drop policy if exists perfiles_admin on perfiles;
create policy perfiles_admin on perfiles for all using (es_admin()) with check (es_admin());

-- catálogo: admin y fábrica leen directo; los clientes usan la función catalogo()
drop policy if exists categorias_lectura on categorias;
create policy categorias_lectura on categorias for select using (auth.uid() is not null);
drop policy if exists categorias_admin on categorias;
create policy categorias_admin on categorias for all using (es_admin()) with check (es_admin());

drop policy if exists productos_staff on productos;
create policy productos_staff on productos for select using (es_staff());
drop policy if exists productos_admin on productos;
create policy productos_admin on productos for all using (es_admin()) with check (es_admin());

drop policy if exists cliente_productos_admin on cliente_productos;
create policy cliente_productos_admin on cliente_productos for all using (es_admin()) with check (es_admin());

-- pedidos: cada cliente ve los suyos; admin y fábrica ven todos.
-- Las altas y modificaciones se hacen desde el servidor (función guardar_pedido).
drop policy if exists pedidos_lectura on pedidos;
create policy pedidos_lectura on pedidos for select using (es_staff() or cliente_id = mi_cliente());
drop policy if exists pedidos_staff_update on pedidos;
create policy pedidos_staff_update on pedidos for update using (es_staff()) with check (es_staff());

drop policy if exists pedido_items_lectura on pedido_items;
create policy pedido_items_lectura on pedido_items for select using (
  exists (select 1 from pedidos p where p.id = pedido_id and (es_staff() or p.cliente_id = mi_cliente()))
);

drop policy if exists pedido_versiones_staff on pedido_versiones;
create policy pedido_versiones_staff on pedido_versiones for select using (es_staff());

drop policy if exists habituales_propio on pedidos_habituales;
create policy habituales_propio on pedidos_habituales for all
  using (es_admin() or cliente_id = mi_cliente())
  with check (es_admin() or cliente_id = mi_cliente());

drop policy if exists faltantes_staff on faltantes;
create policy faltantes_staff on faltantes for all using (es_staff()) with check (es_staff());
drop policy if exists faltantes_cliente on faltantes;
create policy faltantes_cliente on faltantes for select using (
  exists (select 1 from pedidos p where p.id = pedido_id and p.cliente_id = mi_cliente())
);

drop policy if exists config_lectura on config;
create policy config_lectura on config for select using (auth.uid() is not null);
drop policy if exists config_admin on config;
create policy config_admin on config for update using (es_admin()) with check (es_admin());

drop policy if exists resumenes_staff on resumenes_enviados;
create policy resumenes_staff on resumenes_enviados for select using (es_staff());

-- ---------- Catálogo visible para el usuario conectado ----------
-- Oculta precios a los clientes que no ven precios y respeta el catálogo restringido.
create or replace function public.catalogo()
returns table (
  id int, seccion text, categoria text, categoria_orden int,
  nombre text, presentacion text, permite_medios boolean, precio numeric, orden int
)
language sql stable security definer set search_path = public as $$
  select p.id, c.seccion, c.nombre, c.orden, p.nombre, p.presentacion, p.permite_medios,
         case when cl.id is null or cl.ve_precios then p.precio_sin_iva end,
         p.orden
  from productos p
  join categorias c on c.id = p.categoria_id
  left join perfiles pf on pf.id = auth.uid() and pf.activo
  left join clientes cl on cl.id = pf.cliente_id
  where p.activo
    and pf.id is not null
    and (cl.id is null or not cl.restringir_catalogo
         or exists (select 1 from cliente_productos cp where cp.cliente_id = cl.id and cp.producto_id = p.id))
  order by c.orden, p.orden, p.nombre, p.presentacion
$$;

-- ---------- Hora de corte ----------
-- Un pedido para el día D se puede cargar o modificar hasta la hora de corte del día D-1.
create or replace function public.limite_pedido(p_fecha date) returns timestamp
language sql stable set search_path = public as $$
  select (p_fecha - 1) + (select hora_corte from config where id = 1)
$$;

create or replace function public.ahora_ar() returns timestamp
language sql stable as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')
$$;

-- ---------- Guardar pedido (alta o modificación) ----------
-- Se llama solo desde el servidor (Netlify Functions) con la clave de servicio.
create or replace function public.guardar_pedido(
  p_cliente uuid, p_fecha date, p_observacion text, p_items jsonb,
  p_usuario uuid, p_es_admin boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cli     clientes;
  v_ped     pedidos;
  v_ahora   timestamp := ahora_ar();
  v_limite  timestamp := limite_pedido(p_fecha);
  v_nuevo   boolean := false;
  v_prev    jsonb := '[]';
  v_prev_obs text;
  v_prev_estado estado_pedido;
  v_r       record;
  v_n       int := 0;
  v_total   numeric := 0;
  v_items   jsonb;
begin
  select * into v_cli from clientes where id = p_cliente;
  if not found then raise exception 'PED: El cliente no existe.'; end if;
  if v_cli.estado = 'baja' then raise exception 'PED: El cliente está dado de baja.'; end if;
  if v_cli.estado = 'suspendido' and not p_es_admin then
    raise exception 'PED: Tu cuenta está suspendida. Comunicate con El Cóndor.';
  end if;

  if not p_es_admin then
    if p_fecha <= v_ahora::date then
      raise exception 'PED: La fecha de entrega tiene que ser a partir de mañana.';
    end if;
    if p_fecha > v_ahora::date + 30 then
      raise exception 'PED: Solo se puede pedir con hasta 30 días de anticipación.';
    end if;
    if v_ahora > v_limite then
      raise exception 'PED: Ya pasó la hora de corte (% hs del %) para la entrega del %. Para cambios, comunicate por WhatsApp.',
        to_char(v_limite, 'HH24:MI'), to_char(v_limite, 'DD/MM'), to_char(p_fecha, 'DD/MM');
    end if;
    if extract(dow from p_fecha)::smallint = any (v_cli.dias_cerrado) then
      raise exception 'PED: Ese día figura como cerrado para tu local. Elegí otra fecha.';
    end if;
  end if;

  -- Validar ítems (se suman si un producto viene repetido)
  for v_r in
    select x.producto_id, sum(x.cantidad) as cantidad
    from jsonb_to_recordset(coalesce(p_items, '[]')) as x(producto_id int, cantidad numeric)
    where coalesce(x.cantidad, 0) <> 0
    group by x.producto_id
  loop
    if v_r.cantidad < 0 then raise exception 'PED: Hay una cantidad negativa.'; end if;
    perform 1 from productos p where p.id = v_r.producto_id and p.activo;
    if not found then raise exception 'PED: Un producto del pedido ya no está disponible. Actualizá la página.'; end if;
    if not p_es_admin and v_cli.restringir_catalogo
       and not exists (select 1 from cliente_productos cp where cp.cliente_id = p_cliente and cp.producto_id = v_r.producto_id) then
      raise exception 'PED: Un producto del pedido no está habilitado para tu cuenta.';
    end if;
    if (select permite_medios from productos where id = v_r.producto_id) then
      if v_r.cantidad * 2 <> trunc(v_r.cantidad * 2) then
        raise exception 'PED: Los productos por kg se piden en enteros o medios (ej. 2,5).';
      end if;
    elsif v_r.cantidad <> trunc(v_r.cantidad) then
      raise exception 'PED: % se pide en cantidades enteras.', (select nombre from productos where id = v_r.producto_id);
    end if;
    v_n := v_n + 1;
  end loop;
  if v_n = 0 then raise exception 'PED: El pedido no tiene productos.'; end if;

  select * into v_ped from pedidos where cliente_id = p_cliente and fecha_entrega = p_fecha for update;
  if not found then
    v_nuevo := true;
    insert into pedidos (cliente_id, fecha_entrega, observacion, cargado_por, cargado_por_admin)
    values (p_cliente, p_fecha, nullif(trim(p_observacion), ''), p_usuario, p_es_admin)
    returning * into v_ped;
  else
    if v_ped.estado not in ('recibido', 'cancelado') and not p_es_admin then
      raise exception 'PED: El pedido ya está en preparación y no se puede modificar. Comunicate por WhatsApp.';
    end if;
    v_prev_obs := v_ped.observacion;
    v_prev_estado := v_ped.estado;
    select coalesce(jsonb_agg(jsonb_build_object(
             'producto_id', producto_id, 'nombre', producto_nombre,
             'presentacion', presentacion, 'cantidad', cantidad) order by id), '[]')
      into v_prev from pedido_items where pedido_id = v_ped.id;
    delete from pedido_items where pedido_id = v_ped.id;
  end if;

  insert into pedido_items (pedido_id, producto_id, producto_nombre, presentacion, cantidad, precio_unitario)
  select v_ped.id, p.id, p.nombre, p.presentacion, x.cantidad, p.precio_sin_iva
  from (
    select producto_id, sum(cantidad) as cantidad
    from jsonb_to_recordset(p_items) as x(producto_id int, cantidad numeric)
    where coalesce(cantidad, 0) > 0
    group by producto_id
  ) x
  join productos p on p.id = x.producto_id
  join categorias c on c.id = p.categoria_id
  order by c.orden, p.orden, p.nombre;

  select coalesce(sum(cantidad * precio_unitario), 0),
         jsonb_agg(jsonb_build_object('producto_id', producto_id, 'nombre', producto_nombre,
                   'presentacion', presentacion, 'cantidad', cantidad) order by id)
    into v_total, v_items
  from pedido_items where pedido_id = v_ped.id;

  update pedidos set
    observacion = nullif(trim(p_observacion), ''),
    version     = case when v_nuevo then 1 else version + 1 end,
    modificado  = case when v_nuevo then false
                       when v_prev_estado = 'cancelado' then modificado
                       else true end,
    estado      = case when estado = 'cancelado' then 'recibido' else estado end,
    total_sin_iva = v_total,
    updated_at  = now()
  where id = v_ped.id
  returning * into v_ped;

  insert into pedido_versiones (pedido_id, version, items, observacion, creado_por)
  values (v_ped.id, v_ped.version, v_items, v_ped.observacion, p_usuario);

  return jsonb_build_object(
    'pedido_id', v_ped.id,
    'version', v_ped.version,
    'nuevo', v_nuevo,
    'reactivado', coalesce(v_prev_estado = 'cancelado', false),
    'items_anteriores', v_prev,
    'observacion_anterior', v_prev_obs
  );
end $$;

revoke all on function public.guardar_pedido(uuid, date, text, jsonb, uuid, boolean) from public, anon, authenticated;
grant execute on function public.guardar_pedido(uuid, date, text, jsonb, uuid, boolean) to service_role;

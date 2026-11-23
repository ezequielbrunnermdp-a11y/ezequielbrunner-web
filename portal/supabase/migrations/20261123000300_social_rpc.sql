-- =====================================================================
-- Operaciones sociales de servidor (transaccionales y con validación)
-- =====================================================================

-- Los estados de lectura ajenos solo se exponen por función, respetando privacidad.
revoke select on public.conversation_participants from authenticated;
grant select (conversation_id, user_id, role, joined_at, left_at) on public.conversation_participants to authenticated;

create or replace function app.require_auth() returns uuid language plpgsql stable as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  return v;
end $$;

create or replace function app.my_org() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select organization_id from public.profiles where user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- Directorio
-- ---------------------------------------------------------------------
create or replace function public.people_search(p_query text default '', p_limit int default 30, p_offset int default 0)
returns table (user_id uuid, first_name text, last_name text, avatar_path text, job_title text,
               branch_name text, brand_name text, relation text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.user_id, p.first_name, p.last_name, p.avatar_path,
         e.position, b.name, br.name,
         case when app.are_friends(auth.uid(), p.user_id) then 'friend'
              when exists (select 1 from friend_requests f where f.status='pending' and f.from_user = auth.uid() and f.to_user = p.user_id) then 'sent'
              when exists (select 1 from friend_requests f where f.status='pending' and f.to_user = auth.uid() and f.from_user = p.user_id) then 'received'
              else 'none' end
  from profiles p
  join lateral (select * from employments e where e.user_id = p.user_id and e.status = 'active'
                order by e.created_at limit 1) e on true
  join branches b on b.id = e.primary_branch_id
  join brands br on br.id = b.brand_id
  where p.user_id <> auth.uid()
    and app.can_see_user(p.user_id)
    and (coalesce(p_query, '') = '' or lower(p.first_name || ' ' || p.last_name) like '%' || lower(p_query) || '%'
         or lower(b.name) like '%' || lower(p_query) || '%' or lower(e.position) like '%' || lower(p_query) || '%')
  order by p.first_name, p.last_name
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;

create or replace function public.person_card(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v jsonb; p profiles;
begin
  perform app.require_auth();
  if not app.can_see_user(p_user) then
    raise exception 'Perfil no disponible' using errcode = '42501';
  end if;
  select * into p from profiles where user_id = p_user;
  select jsonb_build_object(
    'user_id', p.user_id, 'first_name', p.first_name, 'last_name', p.last_name,
    'avatar_path', p.avatar_path, 'bio', p.bio, 'interests', p.interests,
    'birthday', case when p.show_birthday and p.birth_month is not null then jsonb_build_object('month', p.birth_month, 'day', p.birth_day) end,
    'job_title', e.position, 'branch', b.name, 'brand', br.name, 'sector', s.name,
    'hire_date', case when p.show_hire_date then e.hire_date end,
    'friends_count', (select count(*) from friendships f where f.user_a = p_user or f.user_b = p_user),
    'mutual_friends', (select count(*) from friendships f1
                        join friendships f2 on (case when f1.user_a = p_user then f1.user_b else f1.user_a end)
                                             = (case when f2.user_a = auth.uid() then f2.user_b else f2.user_a end)
                        where (f1.user_a = p_user or f1.user_b = p_user) and (f2.user_a = auth.uid() or f2.user_b = auth.uid())
                          and p_user <> auth.uid()),
    'relation', case when p_user = auth.uid() then 'self'
                     when app.are_friends(auth.uid(), p_user) then 'friend'
                     when exists (select 1 from friend_requests f where f.status='pending' and f.from_user = auth.uid() and f.to_user = p_user) then 'sent'
                     when exists (select 1 from friend_requests f where f.status='pending' and f.to_user = auth.uid() and f.from_user = p_user) then 'received'
                     else 'none' end,
    'pending_request_id', (select f.id from friend_requests f where f.status='pending'
                           and ((f.from_user = auth.uid() and f.to_user = p_user) or (f.to_user = auth.uid() and f.from_user = p_user)) limit 1)
  ) into v
  from (select * from employments where user_id = p_user and status = 'active' order by created_at limit 1) e
  join branches b on b.id = e.primary_branch_id
  join brands br on br.id = b.brand_id
  left join sectors s on s.id = e.sector_id;
  return v;
end $$;

create or replace function public.mutual_friends(p_user uuid)
returns table (user_id uuid, first_name text, last_name text, avatar_path text)
language sql stable security definer set search_path = public, pg_temp as $$
  select pr.user_id, pr.first_name, pr.last_name, pr.avatar_path
  from friendships f1
  join friendships f2 on (case when f1.user_a = p_user then f1.user_b else f1.user_a end)
                       = (case when f2.user_a = auth.uid() then f2.user_b else f2.user_a end)
  join profiles pr on pr.user_id = (case when f1.user_a = p_user then f1.user_b else f1.user_a end)
  where (f1.user_a = p_user or f1.user_b = p_user) and (f2.user_a = auth.uid() or f2.user_b = auth.uid())
    and app.can_see_user(p_user) and app.can_see_user(pr.user_id)
$$;

create or replace function public.my_friends()
returns table (user_id uuid, first_name text, last_name text, avatar_path text, since timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select pr.user_id, pr.first_name, pr.last_name, pr.avatar_path, f.created_at
  from friendships f
  join profiles pr on pr.user_id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
  where (f.user_a = auth.uid() or f.user_b = auth.uid())
  order by pr.first_name
$$;

create or replace function public.friend_requests_inbox()
returns table (id uuid, direction text, user_id uuid, first_name text, last_name text, avatar_path text, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select f.id, case when f.to_user = auth.uid() then 'received' else 'sent' end,
         pr.user_id, pr.first_name, pr.last_name, pr.avatar_path, f.created_at
  from friend_requests f
  join profiles pr on pr.user_id = case when f.to_user = auth.uid() then f.from_user else f.to_user end
  where f.status = 'pending' and (f.to_user = auth.uid() or f.from_user = auth.uid())
  order by f.created_at desc
$$;

-- ---------------------------------------------------------------------
-- Amistades
-- ---------------------------------------------------------------------
create or replace function public.send_friend_request(p_to uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := app.require_auth(); v_id uuid; v_rev uuid;
begin
  if p_to = me then raise exception 'Operación inválida' using errcode = '22023'; end if;
  -- Mismo mensaje para "no existe" y "no visible": evita enumeración de usuarios.
  if not app.can_see_user(p_to) then raise exception 'Perfil no disponible' using errcode = '42501'; end if;
  if app.are_friends(me, p_to) then return jsonb_build_object('status', 'already_friends'); end if;
  select id into v_rev from friend_requests where status = 'pending' and from_user = p_to and to_user = me;
  if v_rev is not null then
    perform public.respond_friend_request(v_rev, true);
    return jsonb_build_object('status', 'accepted', 'request_id', v_rev);
  end if;
  select id into v_id from friend_requests where status = 'pending' and from_user = me and to_user = p_to;
  if v_id is not null then return jsonb_build_object('status', 'pending', 'request_id', v_id); end if;
  if (select count(*) from friend_requests where from_user = me and created_at > now() - interval '1 day') >= 60 then
    raise exception 'Demasiadas solicitudes. Probá más tarde.' using errcode = '54000';
  end if;
  insert into friend_requests (from_user, to_user) values (me, p_to) returning id into v_id;
  perform app.notify(p_to, 'friend_request', 'Nueva solicitud de amistad', null, '/comunidad/solicitudes');
  return jsonb_build_object('status', 'pending', 'request_id', v_id);
end $$;

create or replace function public.respond_friend_request(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := app.require_auth(); r friend_requests;
begin
  select * into r from friend_requests where id = p_id for update;
  if r.id is null or r.to_user <> me or r.status <> 'pending' then
    raise exception 'Solicitud no disponible' using errcode = '42501';
  end if;
  update friend_requests set status = case when p_accept then 'accepted' else 'rejected' end, responded_at = now() where id = p_id;
  if p_accept then
    if app.is_blocked(r.from_user, r.to_user) then raise exception 'Solicitud no disponible' using errcode = '42501'; end if;
    insert into friendships (user_a, user_b) values (least(r.from_user, r.to_user), greatest(r.from_user, r.to_user))
      on conflict do nothing;
    perform app.notify(r.from_user, 'friend_accepted', 'Aceptaron tu solicitud de amistad', null, '/perfil/' || me);
  end if;
end $$;

create or replace function public.cancel_friend_request(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update friend_requests set status = 'cancelled', responded_at = now()
   where id = p_id and from_user = app.require_auth() and status = 'pending';
  if not found then raise exception 'Solicitud no disponible' using errcode = '42501'; end if;
end $$;

create or replace function public.remove_friend(p_user uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  delete from friendships where user_a = least(app.require_auth(), p_user) and user_b = greatest(auth.uid(), p_user)
$$;

create or replace function public.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := app.require_auth();
begin
  if p_user = me then raise exception 'Operación inválida' using errcode = '22023'; end if;
  insert into user_blocks (blocker_id, blocked_id) values (me, p_user) on conflict do nothing;
  delete from friendships where user_a = least(me, p_user) and user_b = greatest(me, p_user);
  update friend_requests set status = 'cancelled', responded_at = now()
   where status = 'pending' and ((from_user = me and to_user = p_user) or (from_user = p_user and to_user = me));
end $$;

create or replace function public.unblock_user(p_user uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  delete from user_blocks where blocker_id = app.require_auth() and blocked_id = p_user
$$;

create or replace function public.my_blocked_users()
returns table (user_id uuid, first_name text, last_name text, blocked_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select b.blocked_id, p.first_name, p.last_name, b.created_at
  from user_blocks b join profiles p on p.user_id = b.blocked_id where b.blocker_id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- Publicaciones
-- ---------------------------------------------------------------------
create or replace function public.create_post(
  p_body text, p_visibility text default 'community', p_media_paths text[] default '{}',
  p_group_id uuid default null, p_mentions uuid[] default '{}',
  p_kind text default 'social', p_inst_type text default null, p_branch_id uuid default null,
  p_pinned_until timestamptz default null, p_brand_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := app.require_auth(); v_org uuid; v_brand uuid; v_id uuid; m uuid;
begin
  if p_group_id is not null then
    select organization_id, brand_id into v_org, v_brand from groups where id = p_group_id;
    if not app.is_group_member(p_group_id) then raise exception 'No sos miembro del grupo' using errcode = '42501'; end if;
  else
    select e.organization_id, b.brand_id into v_org, v_brand
    from employments e join branches b on b.id = e.primary_branch_id
    where e.user_id = me and e.status = 'active' order by e.created_at limit 1;
  end if;
  if v_org is null then
    select organization_id into v_org from role_assignments where user_id = me limit 1;
  end if;
  if p_kind = 'institutional' then
    v_brand := p_brand_id;  -- null = toda la organización
    if p_branch_id is not null then
      select organization_id, brand_id into v_org, v_brand from branches where id = p_branch_id;
      if not app.has_perm_branch('community.publish', p_branch_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
    elsif not app.has_perm_org('community.publish', v_org) then
      raise exception 'Sin permiso para publicar contenido institucional' using errcode = '42501';
    end if;
  elsif p_pinned_until is not null then
    raise exception 'Solo el contenido institucional puede fijarse' using errcode = '42501';
  end if;
  -- Las rutas de medios deben pertenecer a la carpeta del autor.
  if exists (select 1 from unnest(coalesce(p_media_paths, '{}')) x where x not like 'org/' || v_org || '/u/' || me || '/%') then
    raise exception 'Archivo adjunto inválido' using errcode = '22023';
  end if;
  insert into posts (organization_id, brand_id, branch_id, group_id, author_id, kind, inst_type, visibility, body, media_paths, pinned_until)
  values (v_org, v_brand, p_branch_id, p_group_id, me, p_kind, p_inst_type,
          case when p_group_id is not null then 'group' when p_kind = 'institutional' then 'community' else p_visibility end,
          coalesce(trim(p_body), ''), coalesce(p_media_paths, '{}'), p_pinned_until)
  returning id into v_id;
  if p_kind = 'institutional' then
    perform app.audit(v_org, 'post.institutional.create', 'post', v_id::text, jsonb_build_object('type', p_inst_type, 'pinned_until', p_pinned_until));
  end if;
  foreach m in array coalesce(p_mentions, '{}') loop
    if m <> me and app.can_see_user(m) then
      insert into post_mentions (post_id, user_id) values (v_id, m) on conflict do nothing;
      perform app.notify(m, 'mention', 'Te mencionaron en una publicación', null, '/comunidad/post/' || v_id);
    end if;
  end loop;
  return v_id;
end $$;

create or replace function public.delete_post(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare p posts;
begin
  select * into p from posts where id = p_id;
  if p.id is null or (p.author_id <> app.require_auth()
     and not (p.kind = 'institutional' and app.has_perm_org('community.publish', p.organization_id))) then
    raise exception 'Publicación no disponible' using errcode = '42501';
  end if;
  update posts set deleted_at = now() where id = p_id;
  if p.author_id <> auth.uid() then
    perform app.audit(p.organization_id, 'post.delete', 'post', p_id::text, '{}');
  end if;
end $$;

create or replace function public.edit_post(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update posts set body = trim(p_body), edited_at = now()
   where id = p_id and author_id = app.require_auth() and deleted_at is null;
  if not found then raise exception 'Publicación no disponible' using errcode = '42501'; end if;
end $$;

create or replace function public.set_post_pin(p_id uuid, p_until timestamptz) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare p posts;
begin
  select * into p from posts where id = p_id;
  if p.kind <> 'institutional' or not app.has_perm_org('community.publish', p.organization_id) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  update posts set pinned_until = p_until where id = p_id;
  perform app.audit(p.organization_id, 'post.pin', 'post', p_id::text, jsonb_build_object('until', p_until));
end $$;

create or replace function public.delete_comment(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update post_comments set deleted_at = now() where id = p_id and author_id = app.require_auth();
  if not found then raise exception 'Comentario no disponible' using errcode = '42501'; end if;
end $$;

create or replace function app.on_comment_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_author uuid;
begin
  select author_id into v_author from posts where id = new.post_id;
  if v_author <> new.author_id then
    perform app.notify(v_author, 'comment', 'Comentaron tu publicación', null, '/comunidad/post/' || new.post_id);
  end if;
  return new;
end $$;
create trigger comments_after_insert after insert on public.post_comments
  for each row execute function app.on_comment_insert();

create or replace function app.user_position(p_user uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select e.position from employments e where e.user_id = p_user and e.status = 'active' order by e.created_at limit 1
$$;
grant execute on function app.user_position(uuid) to authenticated;

-- Feed paginado por cursor con métricas agregadas.
create or replace function public.feed(p_before timestamptz default null, p_limit int default 20, p_group uuid default null, p_author uuid default null)
returns table (id uuid, author_id uuid, author_first text, author_last text, author_avatar text, author_position text,
               kind text, inst_type text, visibility text, group_id uuid, group_name text, branch_name text, body text, media_paths text[],
               pinned boolean, created_at timestamptz, edited_at timestamptz, likes bigint, comments bigint, liked boolean)
language sql stable security invoker set search_path = public, pg_temp as $$
  select p.id, p.author_id, pr.first_name, pr.last_name, pr.avatar_path,
         app.user_position(p.author_id),
         p.kind, p.inst_type, p.visibility, p.group_id, g.name, b.name, p.body, p.media_paths,
         coalesce(p.pinned_until > now(), false), p.created_at, p.edited_at,
         (select count(*) from post_reactions r where r.post_id = p.id),
         (select count(*) from post_comments c where c.post_id = p.id and c.deleted_at is null and c.moderation_status = 'visible'),
         exists (select 1 from post_reactions r where r.post_id = p.id and r.user_id = auth.uid())
  from posts p
  left join profiles pr on pr.user_id = p.author_id
  left join groups g on g.id = p.group_id
  left join branches b on b.id = p.branch_id
  where (p_before is null or p.created_at < p_before)
    and (p_group is null or p.group_id = p_group)
    and (p_author is null or p.author_id = p_author)
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 50)
$$;

create or replace function public.pinned_posts()
returns setof public.posts language sql stable security invoker set search_path = public, pg_temp as $$
  select * from posts where pinned_until > now() order by created_at desc limit 5
$$;

create or replace function public.post_comments_list(p_post uuid)
returns table (id uuid, author_id uuid, first_name text, last_name text, avatar_path text, body text, created_at timestamptz, edited_at timestamptz)
language sql stable security invoker set search_path = public, pg_temp as $$
  select c.id, c.author_id, pr.first_name, pr.last_name, pr.avatar_path, c.body, c.created_at, c.edited_at
  from post_comments c left join profiles pr on pr.user_id = c.author_id
  where c.post_id = p_post and c.deleted_at is null
  order by c.created_at
$$;

-- Moderación (sin acceso a mensajes privados).
create or replace function public.moderate_report(p_report uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r content_reports;
begin
  select * into r from content_reports where id = p_report for update;
  if r.id is null or not app.has_perm_org('community.moderate', r.organization_id) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_action not in ('hide','dismiss','reviewing') then raise exception 'Acción inválida' using errcode = '22023'; end if;
  if p_action = 'hide' then
    if r.entity = 'post' then update posts set moderation_status = 'hidden' where id = r.entity_id and organization_id = r.organization_id;
    elsif r.entity = 'comment' then update post_comments c set moderation_status = 'hidden'
          from posts p where c.id = r.entity_id and p.id = c.post_id and p.organization_id = r.organization_id;
    end if;
  end if;
  update content_reports set status = case p_action when 'hide' then 'actioned' when 'dismiss' then 'dismissed' else 'reviewing' end,
         reviewed_by = auth.uid(), review_note = p_note, reviewed_at = now() where id = p_report;
  perform app.audit(r.organization_id, 'moderation.' || p_action, r.entity, r.entity_id::text, jsonb_build_object('report', p_report));
end $$;

-- ---------------------------------------------------------------------
-- Grupos
-- ---------------------------------------------------------------------
create or replace function app.on_group_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into group_members (group_id, user_id, role) values (new.id, new.created_by, 'admin');
  return new;
end $$;
create trigger groups_after_insert after insert on public.groups for each row execute function app.on_group_insert();

create or replace function public.join_group(p_group uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare g groups; me uuid := app.require_auth();
begin
  select * into g from groups where id = p_group;
  if g.id is null or not app.in_community(g.organization_id, g.brand_id) then raise exception 'Grupo no disponible' using errcode = '42501'; end if;
  if g.join_policy = 'invite' then raise exception 'El grupo es solo por invitación' using errcode = '42501'; end if;
  insert into group_members (group_id, user_id, status) values (p_group, me, case when g.join_policy = 'open' then 'active' else 'pending' end)
    on conflict do nothing;
  return case when g.join_policy = 'open' then 'active' else 'pending' end;
end $$;

create or replace function public.group_add_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare g groups;
begin
  select * into g from groups where id = p_group;
  if not app.is_group_admin(p_group) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if not app.can_see_user(p_user) then raise exception 'Perfil no disponible' using errcode = '42501'; end if;
  insert into group_members (group_id, user_id, status) values (p_group, p_user, 'active')
    on conflict (group_id, user_id) do update set status = 'active';
  perform app.notify(p_user, 'group', 'Te sumaron a un grupo', g.name, '/comunidad/grupos/' || p_group);
end $$;

create or replace function public.my_groups()
returns table (id uuid, name text, description text, kind text, join_policy text, members bigint, membership text)
language sql stable security invoker set search_path = public, pg_temp as $$
  select g.id, g.name, g.description, g.kind, g.join_policy,
         (select count(*) from group_members m where m.group_id = g.id and m.status = 'active'),
         (select m.status || ':' || m.role from group_members m where m.group_id = g.id and m.user_id = auth.uid())
  from groups g order by g.name
$$;

-- ---------------------------------------------------------------------
-- Mensajería
-- ---------------------------------------------------------------------
create or replace function public.start_direct_conversation(p_user uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := app.require_auth(); v_key text; v_id uuid; v_org uuid;
begin
  if p_user = me or not app.can_see_user(p_user) or app.is_blocked(me, p_user) then
    raise exception 'Contacto no disponible' using errcode = '42501';
  end if;
  v_key := least(me, p_user)::text || ':' || greatest(me, p_user)::text;
  select id into v_id from conversations where direct_key = v_key;
  if v_id is not null then
    update conversation_participants set left_at = null where conversation_id = v_id and user_id = me;
    return v_id;
  end if;
  select organization_id into v_org from profiles where user_id = me;
  insert into conversations (organization_id, kind, direct_key, created_by) values (v_org, 'direct', v_key, me) returning id into v_id;
  insert into conversation_participants (conversation_id, user_id) values (v_id, me), (v_id, p_user);
  return v_id;
end $$;

create or replace function public.create_group_conversation(p_title text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := app.require_auth(); v_id uuid; m uuid; v_org uuid;
begin
  if coalesce(cardinality(p_members), 0) < 1 or cardinality(p_members) > 255 then
    raise exception 'Elegí entre 1 y 255 participantes' using errcode = '22023';
  end if;
  select organization_id into v_org from profiles where user_id = me;
  insert into conversations (organization_id, kind, title, created_by) values (v_org, 'group', trim(p_title), me) returning id into v_id;
  insert into conversation_participants (conversation_id, user_id, role) values (v_id, me, 'admin');
  foreach m in array p_members loop
    if m <> me then
      if not app.can_see_user(m) then raise exception 'Uno de los participantes no está disponible' using errcode = '42501'; end if;
      insert into conversation_participants (conversation_id, user_id) values (v_id, m) on conflict do nothing;
    end if;
  end loop;
  return v_id;
end $$;

create or replace function public.leave_conversation(p_conv uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  update conversation_participants set left_at = now() where conversation_id = p_conv and user_id = app.require_auth()
$$;

create or replace function public.delete_message(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update messages set deleted_at = now(), body = null, attachment_path = null, attachment_name = null, attachment_type = null
   where id = p_id and sender_id = app.require_auth() and deleted_at is null;
  if not found then raise exception 'Mensaje no disponible' using errcode = '42501'; end if;
end $$;

create or replace function public.mark_conversation_read(p_conv uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update conversation_participants set last_read_at = now() where conversation_id = p_conv and user_id = app.require_auth();
  update notifications set read_at = now() where user_id = auth.uid() and type = 'message' and link = '/mensajes/' || p_conv and read_at is null;
end $$;

create or replace function public.mute_conversation(p_conv uuid, p_until timestamptz) returns void
language sql security definer set search_path = public, pg_temp as $$
  update conversation_participants set muted_until = p_until where conversation_id = p_conv and user_id = app.require_auth()
$$;

create or replace function public.my_conversations()
returns table (id uuid, kind text, title text, other_user uuid, other_first text, other_last text, other_avatar text,
               last_message_at timestamptz, last_body text, last_sender uuid, unread bigint, muted boolean, blocked boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, c.kind, c.title, o.user_id, op.first_name, op.last_name, op.avatar_path, c.last_message_at,
         (select case when m.deleted_at is not null then 'Mensaje eliminado' when m.body is null then 'Archivo adjunto' else left(m.body, 120) end
            from messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
         (select m.sender_id from messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
         (select count(*) from messages m where m.conversation_id = c.id and m.sender_id <> auth.uid()
            and m.created_at > coalesce(me.last_read_at, '-infinity')),
         coalesce(me.muted_until > now(), false),
         case when o.user_id is not null then app.is_blocked(auth.uid(), o.user_id) else false end
  from conversation_participants me
  join conversations c on c.id = me.conversation_id
  left join lateral (select p.user_id from conversation_participants p
                     where c.kind = 'direct' and p.conversation_id = c.id and p.user_id <> auth.uid() limit 1) o on true
  left join profiles op on op.user_id = o.user_id
  where me.user_id = auth.uid() and me.left_at is null
  order by c.last_message_at desc
$$;

-- Estados de lectura: solo si ambas personas comparten esa información (reciprocidad).
create or replace function public.conversation_read_state(p_conv uuid)
returns table (user_id uuid, last_read_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.user_id, p.last_read_at
  from conversation_participants p
  join profiles pr on pr.user_id = p.user_id
  where p.conversation_id = p_conv and app.is_participant(p_conv) and p.user_id <> auth.uid()
    and pr.show_read_receipts
    and coalesce((select show_read_receipts from profiles where user_id = auth.uid()), false)
$$;

create or replace function public.conversation_members(p_conv uuid)
returns table (user_id uuid, first_name text, last_name text, avatar_path text, role text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.user_id, pr.first_name, pr.last_name, pr.avatar_path, p.role
  from conversation_participants p join profiles pr on pr.user_id = p.user_id
  where p.conversation_id = p_conv and p.left_at is null and app.is_participant(p_conv)
$$;

revoke execute on all functions in schema public from anon;
grant execute on all functions in schema public to authenticated;

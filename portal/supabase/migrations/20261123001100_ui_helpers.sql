-- Funciones de lectura auxiliares para la interfaz (respetan RLS: security invoker).
create or replace function public.feed_post(p_id uuid)
returns table (id uuid, author_id uuid, author_first text, author_last text, author_avatar text, author_position text,
               kind text, inst_type text, visibility text, group_id uuid, group_name text, branch_name text, body text, media_paths text[],
               pinned boolean, created_at timestamptz, edited_at timestamptz, likes bigint, comments bigint, liked boolean)
language sql stable security invoker set search_path = public, pg_temp as $$
  select p.id, p.author_id, pr.first_name, pr.last_name, pr.avatar_path, app.user_position(p.author_id),
         p.kind, p.inst_type, p.visibility, p.group_id, g.name, b.name, p.body, p.media_paths,
         coalesce(p.pinned_until > now(), false), p.created_at, p.edited_at,
         (select count(*) from post_reactions r where r.post_id = p.id),
         (select count(*) from post_comments c where c.post_id = p.id and c.deleted_at is null and c.moderation_status = 'visible'),
         exists (select 1 from post_reactions r where r.post_id = p.id and r.user_id = auth.uid())
  from posts p left join profiles pr on pr.user_id = p.author_id left join groups g on g.id = p.group_id left join branches b on b.id = p.branch_id
  where p.id = p_id
$$;

create or replace function public.group_members_list(p_group uuid)
returns table (user_id uuid, first_name text, last_name text, avatar_path text, role text, status text)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.user_id, p.first_name, p.last_name, p.avatar_path, m.role, m.status
  from group_members m join profiles p on p.user_id = m.user_id
  where m.group_id = p_group and (app.is_group_member(p_group) or app.is_group_admin(p_group))
    and (m.status = 'active' or app.is_group_admin(p_group))
  order by m.role, p.first_name
$$;

create or replace function public.leave_group(p_group uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if app.is_group_admin(p_group) and (select count(*) from group_members where group_id = p_group and role = 'admin' and status = 'active') = 1
     and (select count(*) from group_members where group_id = p_group and status = 'active') > 1 then
    raise exception 'Sos la única persona administradora: designá a otra antes de salir' using errcode = '22023';
  end if;
  delete from group_members where group_id = p_group and user_id = app.require_auth();
end $$;

create or replace function public.approve_group_member(p_group uuid, p_user uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.is_group_admin(p_group) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_approve then update group_members set status = 'active' where group_id = p_group and user_id = p_user;
  else delete from group_members where group_id = p_group and user_id = p_user and status = 'pending'; end if;
end $$;

revoke execute on function public.feed_post(uuid), public.group_members_list(uuid), public.leave_group(uuid),
  public.approve_group_member(uuid, uuid, boolean) from public, anon;
grant execute on function public.feed_post(uuid), public.group_members_list(uuid), public.leave_group(uuid),
  public.approve_group_member(uuid, uuid, boolean) to authenticated;

-- Cambios de turno propios con datos de ambos turnos (la otra persona puede no tener acceso directo al turno ajeno).
create or replace function public.my_swaps()
returns table (id uuid, requester_id uuid, requester_name text, target_user_id uuid, target_name text, status text, reason text, created_at timestamptz,
               requester_starts timestamptz, requester_ends timestamptz, target_starts timestamptz, target_ends timestamptz, branch_name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.id, s.requester_id, rp.first_name || ' ' || rp.last_name, s.target_user_id, tp.first_name || ' ' || tp.last_name, s.status, s.reason, s.created_at,
         rs.starts_at, rs.ends_at, ts.starts_at, ts.ends_at, b.name
  from shift_swap_requests s
  join shifts rs on rs.id = s.requester_shift_id
  left join shifts ts on ts.id = s.target_shift_id
  join branches b on b.id = rs.branch_id
  join profiles rp on rp.user_id = s.requester_id
  join profiles tp on tp.user_id = s.target_user_id
  where auth.uid() in (s.requester_id, s.target_user_id)
     or (s.status = 'pending_manager' and app.has_perm_branch('schedules.manage', rs.branch_id))
  order by s.created_at desc
$$;
revoke execute on function public.my_swaps() from public, anon;
grant execute on function public.my_swaps() to authenticated;

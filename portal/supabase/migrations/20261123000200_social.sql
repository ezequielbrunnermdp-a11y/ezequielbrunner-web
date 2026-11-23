-- =====================================================================
-- FASE 2 · PORTAL DEL EMPLEADO
-- Amistades, bloqueos, grupos, publicaciones, comentarios, reacciones,
-- menciones, denuncias y mensajería privada.
-- =====================================================================

create or replace function app.is_blocked(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.user_blocks
                 where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a))
$$;

-- ¿El usuario actual puede ver socialmente a otra persona?
create or replace function app.can_see_user(p_other uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_other = auth.uid()
      or (app.same_community(p_other)
          and not app.is_blocked(auth.uid(), p_other)
          and coalesce((select social_enabled from public.profiles where user_id = p_other), false))
$$;

-- ---------------------------------------------------------------------
-- Amistades
-- ---------------------------------------------------------------------
create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_user <> to_user)
);
create unique index friend_requests_one_pending on public.friend_requests
  (least(from_user, to_user), greatest(from_user, to_user)) where status = 'pending';
create index on public.friend_requests (to_user) where status = 'pending';

create table public.friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index on public.friendships (user_b);

create or replace function app.are_friends(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.friendships where user_a = least(p_a, p_b) and user_b = greatest(p_a, p_b))
$$;

-- ---------------------------------------------------------------------
-- Grupos (comunidades por sucursal, sector o intereses)
-- ---------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id),
  branch_id uuid references public.branches(id),
  name text not null check (length(name) between 3 and 80),
  description text check (description is null or length(description) <= 500),
  kind text not null default 'interest' check (kind in ('branch','sector','interest','official')),
  join_policy text not null default 'open' check (join_policy in ('open','approval','invite')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin')),
  status text not null default 'active' check (status in ('active','pending')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index on public.group_members (user_id);

create or replace function app.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = auth.uid() and status = 'active')
$$;
create or replace function app.is_group_admin(p_group uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = auth.uid() and status = 'active' and role = 'admin')
$$;

-- ---------------------------------------------------------------------
-- Publicaciones
-- ---------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id),          -- comunidad; null = toda la organización (solo institucional)
  branch_id uuid references public.branches(id),       -- novedad dirigida a una sucursal
  group_id uuid references public.groups(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'social' check (kind in ('social','institutional')),
  inst_type text check (inst_type in ('announcement','birthday','event','new_hire','recognition','benefit','training','branch_news')),
  visibility text not null default 'community' check (visibility in ('friends','group','community')),
  body text not null default '' check (length(body) <= 5000),
  media_paths text[] not null default '{}' check (cardinality(media_paths) <= 6),
  pinned_until timestamptz,
  moderation_status text not null default 'visible' check (moderation_status in ('visible','hidden')),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check ((visibility = 'group') = (group_id is not null)),
  check (kind = 'institutional' or inst_type is null),
  check (length(body) > 0 or cardinality(media_paths) > 0)
);
create index posts_feed on public.posts (organization_id, created_at desc) where deleted_at is null;
create index on public.posts (author_id, created_at desc);
create index on public.posts (group_id, created_at desc) where group_id is not null;

create or replace function app.can_see_post(p_post public.posts) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_post.deleted_at is null and (
    p_post.author_id = auth.uid()
    or (p_post.moderation_status = 'visible' and (
      case
        when p_post.kind = 'institutional' then
          app.is_member(p_post.organization_id)
          and (p_post.brand_id is null or app.in_community(p_post.organization_id, p_post.brand_id) or app.has_perm_any('community.publish', p_post.organization_id))
          and (p_post.branch_id is null or exists (
                 select 1 from public.employments e where e.user_id = auth.uid() and e.status = 'active'
                   and (e.primary_branch_id = p_post.branch_id
                        or exists (select 1 from public.employment_branches eb where eb.employment_id = e.id and eb.branch_id = p_post.branch_id)))
               or app.has_perm_branch('community.publish', p_post.branch_id))
        else
          app.can_see_user(p_post.author_id) and (
            (p_post.visibility = 'friends' and app.are_friends(auth.uid(), p_post.author_id))
            or (p_post.visibility = 'group' and app.is_group_member(p_post.group_id))
            or (p_post.visibility = 'community' and app.in_community(p_post.organization_id, p_post.brand_id)))
      end))
    or (app.has_perm_org('community.moderate', p_post.organization_id) and p_post.visibility <> 'friends')
  )
$$;

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  moderation_status text not null default 'visible' check (moderation_status in ('visible','hidden')),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.post_comments (post_id, created_at);

create table public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null default 'like' check (reaction in ('like')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.post_mentions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (post_id, user_id)
);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  entity text not null check (entity in ('post','comment','message','user')),
  entity_id uuid not null,
  reason text not null check (reason in ('spam','harassment','inappropriate','privacy','other')),
  details text check (details is null or length(details) <= 1000),
  -- Para mensajes privados la gerencia NO accede a la conversación: solo al
  -- extracto que la persona denunciante decide copiar voluntariamente.
  reporter_excerpt text check (reporter_excerpt is null or length(reporter_excerpt) <= 2000),
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  reviewed_by uuid references auth.users(id),
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- ---------------------------------------------------------------------
-- Mensajería privada
-- ---------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('direct','group')),
  title text check (title is null or length(title) between 1 and 80),
  direct_key text unique,           -- 'uuidMenor:uuidMayor' para evitar duplicados 1 a 1
  created_by uuid not null references auth.users(id),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin')),
  muted_until timestamptz,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (conversation_id, user_id)
);
create index on public.conversation_participants (user_id) where left_at is null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text check (body is null or length(body) <= 4000),
  attachment_path text,
  attachment_type text check (attachment_type in ('image','document')),
  attachment_name text,
  client_id uuid,                     -- idempotencia de reenvíos
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sender_id, client_id),
  check (deleted_at is not null or body is not null or attachment_path is not null)
);
create index on public.messages (conversation_id, created_at desc);

create or replace function app.is_participant(p_conv uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.conversation_participants
                 where conversation_id = p_conv and user_id = auth.uid() and left_at is null)
$$;

-- Envío permitido: participante activo y, en chats directos, sin bloqueo.
create or replace function app.can_send(p_conv uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.is_participant(p_conv) and not exists (
    select 1 from public.conversations c
    join public.conversation_participants p on p.conversation_id = c.id and p.user_id <> auth.uid()
    where c.id = p_conv and c.kind = 'direct' and app.is_blocked(auth.uid(), p.user_id))
$$;

create or replace function app.on_message_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_participants set last_read_at = new.created_at
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  -- Notificación sin contenido del mensaje (privacidad).
  for r in select p.user_id from public.conversation_participants p
           where p.conversation_id = new.conversation_id and p.user_id <> new.sender_id and p.left_at is null
             and (p.muted_until is null or p.muted_until < now())
             and not exists (select 1 from public.notifications n where n.user_id = p.user_id and n.type = 'message'
                             and n.link = '/mensajes/' || new.conversation_id and n.read_at is null)
  loop
    perform app.notify(r.user_id, 'message', 'Tenés mensajes nuevos', null, '/mensajes/' || new.conversation_id);
  end loop;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function app.on_message_insert();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_mentions enable row level security;
alter table public.content_reports enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

create policy fr_read on public.friend_requests for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());
create policy fs_read on public.friendships for select to authenticated
  using (user_a = auth.uid() or user_b = auth.uid()
         or (app.can_see_user(user_a) and app.can_see_user(user_b)));

create policy groups_read on public.groups for select to authenticated
  using (app.in_community(organization_id, brand_id) or app.is_group_member(id) or app.has_perm_org('community.moderate', organization_id));
create policy groups_insert on public.groups for insert to authenticated
  with check (created_by = auth.uid() and app.in_community(organization_id, brand_id)
              and (kind in ('interest','sector') or app.has_perm_any('community.publish', organization_id)));
create policy groups_update on public.groups for update to authenticated
  using (app.is_group_admin(id)) with check (app.is_group_admin(id));
create policy groups_delete on public.groups for delete to authenticated
  using (app.is_group_admin(id) or app.has_perm_org('community.moderate', organization_id));

create policy gm_read on public.group_members for select to authenticated
  using (user_id = auth.uid() or app.is_group_member(group_id) or app.is_group_admin(group_id));
create policy gm_delete on public.group_members for delete to authenticated
  using (user_id = auth.uid() or app.is_group_admin(group_id));

create policy posts_read on public.posts for select to authenticated using (app.can_see_post(posts));
create policy posts_insert on public.posts for insert to authenticated with check (
  author_id = auth.uid() and deleted_at is null and moderation_status = 'visible' and
  case when kind = 'institutional' then
         (branch_id is null and app.has_perm_org('community.publish', organization_id))
         or (branch_id is not null and app.has_perm_branch('community.publish', branch_id))
       else
         app.in_community(organization_id, brand_id) and brand_id is not null and pinned_until is null
         and (visibility <> 'group' or app.is_group_member(group_id))
  end);
create policy posts_update_own on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy comments_read on public.post_comments for select to authenticated using (
  exists (select 1 from public.posts p where p.id = post_id and app.can_see_post(p))
  and (deleted_at is null or author_id = auth.uid())
  and (moderation_status = 'visible' or author_id = auth.uid())
  and (author_id = auth.uid() or not app.is_blocked(auth.uid(), author_id)));
create policy comments_insert on public.post_comments for insert to authenticated with check (
  author_id = auth.uid() and deleted_at is null and moderation_status = 'visible'
  and exists (select 1 from public.posts p where p.id = post_id and app.can_see_post(p) and not app.is_blocked(auth.uid(), p.author_id)));
create policy comments_update_own on public.post_comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy reactions_read on public.post_reactions for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and app.can_see_post(p)));
create policy reactions_insert on public.post_reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and app.can_see_post(p)));
create policy reactions_delete on public.post_reactions for delete to authenticated using (user_id = auth.uid());

create policy mentions_read on public.post_mentions for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and app.can_see_post(p)));

create policy reports_insert on public.content_reports for insert to authenticated
  with check (reporter_id = auth.uid() and app.is_member(organization_id) and status = 'open');
create policy reports_read on public.content_reports for select to authenticated
  using (reporter_id = auth.uid() or app.has_perm_org('community.moderate', organization_id));
create policy reports_update on public.content_reports for update to authenticated
  using (app.has_perm_org('community.moderate', organization_id))
  with check (app.has_perm_org('community.moderate', organization_id));

-- Mensajería: SOLO participantes. No hay política para roles administrativos
-- ni para superadministración: no existen puertas traseras de lectura.
create policy conv_read on public.conversations for select to authenticated using (app.is_participant(id));
create policy conv_update on public.conversations for update to authenticated
  using (app.is_participant(id) and kind = 'group') with check (app.is_participant(id) and kind = 'group');
create policy cp_read on public.conversation_participants for select to authenticated using (app.is_participant(conversation_id));
create policy cp_update_self on public.conversation_participants for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy msg_read on public.messages for select to authenticated using (app.is_participant(conversation_id));
create policy msg_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and deleted_at is null and app.can_send(conversation_id)
              and (attachment_path is null or attachment_path like 'conv/' || conversation_id || '/%'));

grant insert, update (body, media_paths, visibility, edited_at, deleted_at) on public.posts to authenticated;
grant insert, update (body, edited_at, deleted_at) on public.post_comments to authenticated;
grant insert, delete on public.post_reactions to authenticated;
grant insert on public.content_reports to authenticated;
grant update (status, reviewed_by, review_note, reviewed_at) on public.content_reports to authenticated;
grant insert, update (name, description, join_policy), delete on public.groups to authenticated;
grant delete on public.group_members to authenticated;
grant update (title) on public.conversations to authenticated;
grant update (muted_until, last_read_at) on public.conversation_participants to authenticated;
grant insert on public.messages to authenticated;
grant select on all tables in schema public to authenticated;

alter publication supabase_realtime add table public.messages, public.notifications, public.conversation_participants;

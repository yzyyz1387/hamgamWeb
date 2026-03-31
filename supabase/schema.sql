-- HamGam / Supabase 全量初始化脚本（按当前项目数据库快照重写）
--
-- 用途：
-- 1) 新环境快速初始化数据库结构、RLS、函数、存储桶与插件运行时表
-- 2) 尽量对齐当前项目实际使用的字段与 RPC
--
-- 说明：
-- - 本文件已合并旧 schema + 当前项目在用结构 + 插件系统基础表
-- - 出于稳健性考虑，未收录当前库里的临时表 test_table
-- - 执行完本文件后，再部署 Edge Functions
-- - 首个超级管理员请手动提升

create extension if not exists pgcrypto;
create extension if not exists unaccent with schema extensions;

-- =========
-- Enum Types
-- =========
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'user_role') then
    create type public.user_role as enum ('SUPER_ADMIN', 'REVIEWER', 'USER');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'image_status') then
    create type public.image_status as enum ('PUBLISHED', 'ARCHIVED');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'submission_status') then
    create type public.submission_status as enum ('PENDING', 'PUBLISHED', 'REJECTED', 'WITHDRAWN', 'IMAGE_DELETED');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'comment_status') then
    create type public.comment_status as enum ('VISIBLE', 'HIDDEN');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'announcement_kind') then
    create type public.announcement_kind as enum ('BANNER', 'POPUP');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'notification_type') then
    create type public.notification_type as enum (
      'SYSTEM',
      'SUBMISSION_CREATED',
      'SUBMISSION_PUBLISHED',
      'SUBMISSION_REJECTED',
      'COMMENT_CREATED',
      'ANNOUNCEMENT',
      'ROLE_CHANGED',
      'ACCOUNT_UPDATED',
      'IMAGE_DELETED'
    );
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'audit_log_level') then
    create type public.audit_log_level as enum ('info', 'success', 'warn', 'error');
  end if;
end
$$;

create sequence if not exists public.profiles_uid_seq;

-- ======
-- Tables
-- ======
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nickname text not null,
  avatar_url text,
  bio text,
  callsign text,
  role public.user_role not null default 'USER',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  certifications jsonb not null default '[]'::jsonb,
  grid_locator text,
  uid integer not null default nextval('public.profiles_uid_seq'::regclass),
  active_auth_session_id uuid,
  active_auth_session_seen_at timestamptz,
  show_in_team_page boolean not null default false,
  constraint profiles_nickname_length check (char_length(nickname) between 1 and 40),
  constraint profiles_uid_unique unique (uid)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id text not null unique,
  device_info text,
  created_at timestamptz not null default timezone('utc', now()),
  last_activity_at timestamptz not null default timezone('utc', now()),
  is_active boolean not null default true
);

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  legacy_url text unique,
  title text not null,
  description text not null default '',
  contributor_name text,
  uploader_id uuid references public.profiles(id) on delete set null,
  uploader_display_name text,
  storage_bucket text not null default 'gallery-images',
  storage_path text not null,
  image_url text not null,
  mime_type text,
  file_size bigint,
  legacy_updated_at timestamptz,
  published_at timestamptz not null default timezone('utc', now()),
  status public.image_status not null default 'PUBLISHED',
  reaction_total_count integer not null default 0,
  reaction_summary jsonb not null default '[]'::jsonb,
  comments_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  edit_status varchar(32) default 'NONE',
  edit_requested_at timestamptz,
  original_image_url text,
  edit_reason text,
  edit_requested_by uuid,
  phash text,
  file_md5 varchar(64),
  constraint images_title_length check (char_length(title) between 1 and 120),
  constraint images_edit_status_check check (
    edit_status is null or edit_status in ('NONE', 'PENDING', 'REJECTED')
  )
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  contributor_name text,
  original_filename text,
  storage_bucket text default 'submission-images',
  storage_path text unique,
  mime_type text,
  file_size bigint,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  uploader_display_name text,
  status public.submission_status not null default 'PENDING',
  reviewer_id uuid references public.profiles(id) on delete set null,
  assigned_reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_note text,
  reviewed_at timestamptz,
  published_image_id uuid references public.images(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  phash text,
  file_md5 varchar(64),
  constraint submissions_title_length check (char_length(title) between 1 and 120),
  constraint submissions_storage_requirement check (
    (metadata->>'edit_for_image_id' is not null)
    or
    (storage_path is not null and storage_bucket is not null)
  )
);

create table if not exists public.submission_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_display_name text,
  action text not null,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint submission_reviews_action_check check (action in ('APPROVED', 'REJECTED', 'ASSIGNED', 'UNASSIGNED'))
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.images(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  parent_id uuid references public.comments(id) on delete cascade,
  author_display_name text not null,
  author_avatar_url text,
  author_certifications text[] not null default '{}'::text[],
  content text not null,
  status public.comment_status not null default 'VISIBLE',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  edited_at timestamptz,
  constraint comments_content_length check (char_length(content) between 1 and 1000)
);

create table if not exists public.image_reactions (
  image_id uuid not null references public.images(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (image_id, user_id, emoji),
  constraint image_reactions_emoji_length check (char_length(emoji) between 1 and 16)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_display_name text,
  actor_avatar_url text,
  type public.notification_type not null default 'SYSTEM',
  title text not null,
  content text not null default '',
  link text,
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz,
  read_type varchar(32)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  kind public.announcement_kind not null default 'BANNER',
  title text not null,
  content text not null,
  link text,
  is_active boolean not null default true,
  starts_at timestamptz not null default timezone('utc', now()),
  ends_at timestamptz,
  dismissible boolean not null default true,
  priority integer not null default 100,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint announcements_time_range check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  level public.audit_log_level not null default 'info',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.friend_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  description text not null default '',
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.callsign_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  callsign text not null,
  note text not null default '',
  file_bucket text not null default 'callsign-docs',
  file_path text not null,
  file_name text not null,
  status text not null default 'PENDING',
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint callsign_applications_status_check check (status in ('PENDING', 'APPROVED', 'REJECTED'))
);

create table if not exists public.plugins (
  id text primary key,
  name text not null,
  version text not null default '0.0.0',
  description text not null default '',
  installed boolean not null default true,
  registration_status text not null default 'installed' check (registration_status in ('installed', 'uninstalled')),
  install_source text not null default 'builtin',
  registered_at timestamptz,
  uninstalled_at timestamptz,
  enabled boolean not null default true,
  default_enabled boolean not null default true,
  installed_version text,
  api_version text not null default '1.1.0',
  host_version_range text not null default '^1.1.0',
  status text not null default 'enabled' check (status in ('installed', 'enabled', 'disabled', 'error')),
  installed_at timestamptz,
  enabled_at timestamptz,
  disabled_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.plugin_settings (
  plugin_id text not null references public.plugins(id) on delete cascade,
  key text not null,
  value_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (plugin_id, key)
);

-- =======
-- Indexes
-- =======
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_active on public.profiles(is_active);
create index if not exists idx_profiles_callsign_lower on public.profiles(lower(callsign));
create unique index if not exists idx_profiles_callsign_unique
  on public.profiles(lower(callsign))
  where callsign is not null and btrim(callsign) <> '';

create index if not exists idx_sessions_user_id on public.sessions(user_id, is_active);
create index if not exists idx_sessions_session_id on public.sessions(session_id);

create index if not exists idx_images_status_published_at on public.images(status, published_at desc);
create index if not exists idx_images_sort_time on public.images((coalesce(legacy_updated_at, published_at)) desc);
create index if not exists idx_images_uploader_id on public.images(uploader_id);
create index if not exists idx_images_phash on public.images(phash);
create index if not exists idx_images_file_md5 on public.images(file_md5);

create index if not exists idx_submissions_status_created_at on public.submissions(status, created_at desc);
create index if not exists idx_submissions_uploader_id on public.submissions(uploader_id, created_at desc);
create index if not exists idx_submissions_reviewer_id on public.submissions(reviewer_id);
create index if not exists idx_submissions_assigned_reviewer_id on public.submissions(assigned_reviewer_id);
create index if not exists idx_submissions_published_image_id on public.submissions(published_image_id);
create index if not exists idx_submissions_phash on public.submissions(phash);
create index if not exists idx_submissions_file_md5 on public.submissions(file_md5);

create index if not exists idx_submission_reviews_submission_id on public.submission_reviews(submission_id, created_at desc);
create index if not exists idx_submission_reviews_reviewer_id on public.submission_reviews(reviewer_id, created_at desc);

create index if not exists idx_comments_image_id_created_at on public.comments(image_id, created_at desc);
create index if not exists idx_comments_user_id on public.comments(user_id);
create index if not exists idx_reactions_user_id on public.image_reactions(user_id, created_at desc);
create index if not exists idx_notifications_user_read_created on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_announcements_kind_active on public.announcements(kind, is_active, priority desc);
create index if not exists idx_audit_logs_actor_created on public.audit_logs(actor_id, created_at desc);
create index if not exists idx_audit_logs_level_created on public.audit_logs(level, created_at desc);
create index if not exists idx_friend_links_active_sort on public.friend_links(is_active, sort_order asc, created_at desc);
create index if not exists idx_callsign_apps_user_created on public.callsign_applications(user_id, created_at desc);
create index if not exists idx_callsign_apps_status_created on public.callsign_applications(status, created_at desc);
create index if not exists idx_plugins_enabled on public.plugins(enabled);
create index if not exists idx_plugin_settings_plugin_id on public.plugin_settings(plugin_id);

-- =================
-- Grants / Defaults
-- =================
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;

-- ================
-- Helper Functions
-- ================
create or replace function public.current_profile_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'USER'::public.user_role);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'SUPER_ADMIN'
      and is_active = true
  );
$$;

create or replace function public.can_moderate()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('SUPER_ADMIN', 'REVIEWER')
      and is_active = true
  );
$$;

create or replace function public.is_current_user_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
  );
$$;

create or replace function public.slugify_text(input text)
returns text
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  cleaned text;
begin
  cleaned := lower(regexp_replace(extensions.unaccent(coalesce(input, '')), '[^a-zA-Z0-9]+', '-', 'g'));
  cleaned := regexp_replace(cleaned, '(^-+|-+$)', '', 'g');
  cleaned := substring(cleaned from 1 for 60);
  if cleaned is null or cleaned = '' then
    cleaned := 'img-' || substring(md5(coalesce(input, '')), 1, 12);
  end if;
  return cleaned;
end;
$$;

create or replace function public.ensure_unique_image_slug(p_base text, p_current_id uuid default null)
returns text
language plpgsql
set search_path = public
as $$
declare
  candidate text := public.slugify_text(p_base);
  base_slug text := candidate;
  suffix integer := 1;
begin
  loop
    exit when not exists (
      select 1
      from public.images
      where slug = candidate
        and (p_current_id is null or id <> p_current_id)
    );
    candidate := left(base_slug, 55) || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;
  return candidate;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.derive_audit_log_level(
  p_action text,
  p_details jsonb default '{}'::jsonb
)
returns public.audit_log_level
language plpgsql
immutable
set search_path = public
as $$
begin
  case p_action
    when 'submission.published', 'image.shown', 'image.edit_approved', 'callsign.approved' then return 'success';
    when 'submission.rejected', 'image.hidden', 'image.edit_rejected', 'callsign.rejected', 'profile.password_changed' then return 'warn';
    when 'image.deleted' then return 'error';
    else return 'info';
  end case;
end;
$$;

create or replace function public.insert_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_details jsonb default '{}'::jsonb,
  p_level public.audit_log_level default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, level, details)
  values (
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_level, public.derive_audit_log_level(p_action, p_details)),
    coalesce(p_details, '{}'::jsonb)
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

create or replace function public.assign_uid()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.uid is null then
    new.uid := nextval('public.profiles_uid_seq');
  end if;
  return new;
end;
$$;

create or replace function public.extract_certification_labels(p_certifications jsonb)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(label), '{}'::text[])
  from (
    select case
      when jsonb_typeof(elem) = 'string' then trim(both '"' from elem::text)
      when jsonb_typeof(elem) = 'object' then coalesce(elem->>'label', '')
      else ''
    end as label
    from jsonb_array_elements(coalesce(p_certifications, '[]'::jsonb)) elem
  ) t
  where label is not null and btrim(label) <> '';
$$;

-- =================
-- Session Functions
-- =================
create or replace function public.claim_active_session(p_session_id text, p_device_info text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sessions
  set is_active = false
  where user_id = auth.uid()
    and is_active = true;

  insert into public.sessions(user_id, session_id, device_info, last_activity_at, is_active)
  values (auth.uid(), p_session_id, p_device_info, timezone('utc', now()), true)
  on conflict (session_id) do update
  set is_active = true,
      last_activity_at = timezone('utc', now()),
      device_info = coalesce(excluded.device_info, public.sessions.device_info);

  return true;
end;
$$;

create or replace function public.release_active_session(p_session_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sessions
  set is_active = false,
      last_activity_at = timezone('utc', now())
  where user_id = auth.uid()
    and session_id = p_session_id
    and is_active = true;

  return true;
end;
$$;

create or replace function public.is_active_session_valid(p_session_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid boolean;
begin
  update public.sessions
  set last_activity_at = timezone('utc', now())
  where user_id = auth.uid()
    and session_id = p_session_id
    and is_active = true;

  select exists(
    select 1
    from public.sessions
    where user_id = auth.uid()
      and session_id = p_session_id
      and is_active = true
  ) into v_valid;

  return coalesce(v_valid, false);
end;
$$;

create or replace function public.claim_active_session(p_session_id uuid)
returns table(
  user_id uuid,
  is_active boolean,
  active_auth_session_id uuid,
  active_auth_session_seen_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set active_auth_session_id = p_session_id,
      active_auth_session_seen_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = auth.uid()
  returning profiles.id, profiles.is_active, profiles.active_auth_session_id, profiles.active_auth_session_seen_at
  into user_id, is_active, active_auth_session_id, active_auth_session_seen_at;

  return next;
end;
$$;

create or replace function public.release_active_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set active_auth_session_id = null,
      active_auth_session_seen_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = auth.uid()
    and active_auth_session_id = p_session_id;

  return true;
end;
$$;

create or replace function public.validate_active_session(p_session_id uuid)
returns table(
  is_valid boolean,
  is_active boolean,
  active_auth_session_id uuid,
  active_auth_session_seen_at timestamptz,
  role public.user_role
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    (p.active_auth_session_id = p_session_id and p.is_active = true) as is_valid,
    p.is_active,
    p.active_auth_session_id,
    p.active_auth_session_seen_at,
    p.role
  from public.profiles p
  where p.id = auth.uid();
end;
$$;

-- ====================
-- Auth / Profile Sync
-- ====================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nickname text;
begin
  v_nickname := coalesce(
    nullif(new.raw_user_meta_data ->> 'nickname', ''),
    split_part(new.email, '@', 1),
    '用户'
  );

  insert into public.profiles (id, email, nickname)
  values (new.id, new.email, left(v_nickname, 40))
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

create or replace function public.sync_user_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email,
      updated_at = timezone('utc', now())
  where id = new.id;

  return new;
end;
$$;

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role public.user_role;
  remaining_admins integer;
begin
  requester_role := public.current_profile_role();
  new.updated_at := timezone('utc', now());

  if auth.uid() = old.id and requester_role <> 'SUPER_ADMIN' then
    new.role := old.role;
    new.certifications := old.certifications;
    new.is_active := old.is_active;
    new.email := old.email;
    new.uid := old.uid;
    new.active_auth_session_id := old.active_auth_session_id;
    new.active_auth_session_seen_at := old.active_auth_session_seen_at;
    new.show_in_team_page := old.show_in_team_page;
  end if;

  if old.role = 'SUPER_ADMIN'
     and old.is_active = true
     and (new.role <> 'SUPER_ADMIN' or new.is_active = false) then
    select count(*)
      into remaining_admins
    from public.profiles
    where role = 'SUPER_ADMIN'
      and is_active = true
      and id <> old.id;

    if remaining_admins = 0 then
      raise exception 'At least one active SUPER_ADMIN must remain';
    end if;
  end if;

  return new;
end;
$$;

-- =====================
-- Public-facing Helpers
-- =====================
create or replace function public.find_public_profile_uid(p_user_id uuid, p_callsign text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select p.uid
  from public.profiles p
  where p.is_active = true
    and (
      (p_user_id is not null and p.id = p_user_id)
      or
      (p_callsign is not null and btrim(p_callsign) <> '' and upper(coalesce(p.callsign, '')) = upper(btrim(p_callsign)))
    )
  order by case when p.id = p_user_id then 0 else 1 end, p.created_at asc
  limit 1;
$$;

create or replace function public.get_public_profile(p_uid integer)
returns table(
  id uuid,
  nickname text,
  avatar_url text,
  bio text,
  callsign text,
  grid_locator text,
  certifications jsonb,
  role public.user_role,
  created_at timestamptz,
  uid integer,
  is_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.nickname,
    p.avatar_url,
    p.bio,
    p.callsign,
    p.grid_locator,
    p.certifications,
    p.role,
    p.created_at,
    p.uid,
    p.is_active
  from public.profiles p
  where p.uid = p_uid
    and p.is_active = true
  limit 1;
$$;

create or replace function public.get_public_team_members()
returns table(
  id uuid,
  nickname text,
  avatar_url text,
  bio text,
  callsign text,
  certifications jsonb,
  role public.user_role,
  uid integer,
  show_in_team_page boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.nickname,
    p.avatar_url,
    p.bio,
    p.callsign,
    p.certifications,
    p.role,
    p.uid,
    p.show_in_team_page
  from public.profiles p
  where p.is_active = true
    and (p.role in ('SUPER_ADMIN', 'REVIEWER') or p.show_in_team_page = true)
  order by
    case p.role when 'SUPER_ADMIN' then 1 when 'REVIEWER' then 2 else 3 end,
    p.created_at asc;
$$;

create or replace function public.get_public_team_stats()
returns table(
  user_count bigint,
  active_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where p.is_active = true) as user_count,
    count(*) filter (
      where p.is_active = true
        and (p.callsign is not null or p.bio is not null)
    ) as active_count
  from public.profiles p;
$$;

create or replace function public.get_public_danmaku_users(p_limit integer default 200)
returns table(
  id uuid,
  nickname text,
  avatar_url text,
  callsign text,
  uid integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nickname, p.avatar_url, p.callsign, p.uid
  from public.profiles p
  where p.is_active = true
    and p.nickname is not null
  order by p.created_at desc
  limit greatest(coalesce(p_limit, 200), 1);
$$;

-- ===================
-- Row Preparation
-- ===================
create or replace function public.prepare_image_row()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_nickname text;
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.ensure_unique_image_slug(coalesce(new.title, new.id::text), new.id);
  else
    new.slug := public.ensure_unique_image_slug(new.slug, new.id);
  end if;

  if new.uploader_id is not null and (new.uploader_display_name is null or btrim(new.uploader_display_name) = '') then
    select nickname into v_nickname from public.profiles where id = new.uploader_id;
    new.uploader_display_name := coalesce(v_nickname, new.contributor_name, '匿名投稿者');
  end if;

  if new.contributor_name is null or btrim(new.contributor_name) = '' then
    new.contributor_name := coalesce(new.uploader_display_name, '佚名');
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.prepare_submission_row()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_nickname text;
begin
  if new.uploader_display_name is null or btrim(new.uploader_display_name) = '' then
    select nickname into v_nickname from public.profiles where id = new.uploader_id;
    new.uploader_display_name := coalesce(v_nickname, '匿名用户');
  end if;

  if new.contributor_name is null or btrim(new.contributor_name) = '' then
    new.contributor_name := new.uploader_display_name;
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.prepare_comment_row()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into v_profile from public.profiles where id = new.user_id;
    new.author_display_name := coalesce(v_profile.nickname, '匿名用户');
    new.author_avatar_url := v_profile.avatar_url;
    new.author_certifications := public.extract_certification_labels(v_profile.certifications);
  end if;

  if tg_op = 'UPDATE' and new.content is distinct from old.content then
    new.edited_at := timezone('utc', now());
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.prepare_announcement_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.created_by is null and auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

-- =======================
-- Image Stats / Triggers
-- =======================
create or replace function public.refresh_image_comment_count(p_image_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.images
  set comments_count = (
        select count(*)
        from public.comments
        where image_id = p_image_id
          and status = 'VISIBLE'
      ),
      updated_at = timezone('utc', now())
  where id = p_image_id;
end;
$$;

create or replace function public.refresh_image_reaction_summary(p_image_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.images
  set reaction_summary = coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('emoji', emoji, 'count', cnt)
            order by cnt desc, emoji asc
          )
          from (
            select emoji, count(*)::integer as cnt
            from public.image_reactions
            where image_id = p_image_id
            group by emoji
          ) grouped
        ),
        '[]'::jsonb
      ),
      reaction_total_count = (
        select count(*)
        from public.image_reactions
        where image_id = p_image_id
      ),
      updated_at = timezone('utc', now())
  where id = p_image_id;
end;
$$;

create or replace function public.sync_comment_count_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_image_comment_count(old.image_id);
    return old;
  end if;

  perform public.refresh_image_comment_count(new.image_id);
  if tg_op = 'UPDATE' and old.image_id is distinct from new.image_id then
    perform public.refresh_image_comment_count(old.image_id);
  end if;
  return new;
end;
$$;

create or replace function public.sync_reaction_summary_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_image_reaction_summary(old.image_id);
    return old;
  end if;

  perform public.refresh_image_reaction_summary(new.image_id);
  if tg_op = 'UPDATE' and old.image_id is distinct from new.image_id then
    perform public.refresh_image_reaction_summary(old.image_id);
  end if;
  return new;
end;
$$;

-- =========================
-- Notifications / Messages
-- =========================
create or replace function public.notify_submission_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (
    user_id,
    actor_id,
    actor_display_name,
    actor_avatar_url,
    type,
    title,
    content,
    link,
    metadata
  )
  select
    p.id,
    new.uploader_id,
    new.uploader_display_name,
    uploader.avatar_url,
    'SUBMISSION_CREATED',
    '有新的投稿待审核',
    new.title,
    '/admin/submissions',
    jsonb_build_object('submission_id', new.id)
  from public.profiles p
  left join public.profiles uploader on uploader.id = new.uploader_id
  where p.is_active = true
    and p.role in ('SUPER_ADMIN', 'REVIEWER')
    and p.id <> new.uploader_id;

  perform public.insert_audit_log(
    'submission.created',
    'submission',
    new.id::text,
    jsonb_build_object('title', new.title, 'uploader_id', new.uploader_id)
  );

  return new;
end;
$$;

create or replace function public.notify_comment_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_image public.images%rowtype;
begin
  select * into v_image from public.images where id = new.image_id;

  if v_image.uploader_id is not null and v_image.uploader_id <> new.user_id then
    insert into public.notifications (
      user_id,
      actor_id,
      actor_display_name,
      actor_avatar_url,
      type,
      title,
      content,
      link,
      metadata
    )
    values (
      v_image.uploader_id,
      new.user_id,
      new.author_display_name,
      new.author_avatar_url,
      'COMMENT_CREATED',
      '你的图片收到了新评论',
      left(new.content, 120),
      '/image/' || v_image.slug,
      jsonb_build_object('image_id', v_image.id, 'comment_id', new.id)
    );
  end if;

  return new;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.notifications
  set is_read = true,
      read_at = coalesce(read_at, timezone('utc', now())),
      read_type = coalesce(read_type, 'click')
  where id = p_notification_id
    and user_id = auth.uid();

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.notifications
  set is_read = true,
      read_at = coalesce(read_at, timezone('utc', now())),
      read_type = coalesce(read_type, 'bulk')
  where user_id = auth.uid()
    and is_read = false;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.broadcast_system_notification(
  p_title text,
  p_content text,
  p_link text default null,
  p_target_roles public.user_role[] default null,
  p_target_user_ids uuid[] default null,
  p_type public.notification_type default 'ANNOUNCEMENT'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_display_name text;
  v_actor_avatar_url text;
  inserted_count integer;
begin
  if not public.is_super_admin() then
    raise exception 'Only SUPER_ADMIN can broadcast notifications';
  end if;

  select nickname, avatar_url
    into v_actor_display_name, v_actor_avatar_url
  from public.profiles
  where id = auth.uid();

  insert into public.notifications (
    user_id,
    actor_id,
    actor_display_name,
    actor_avatar_url,
    type,
    title,
    content,
    link,
    metadata
  )
  select
    p.id,
    auth.uid(),
    v_actor_display_name,
    v_actor_avatar_url,
    coalesce(p_type, 'ANNOUNCEMENT'),
    p_title,
    p_content,
    p_link,
    jsonb_build_object(
      'broadcast', true,
      'target_roles', coalesce(to_jsonb(p_target_roles), 'null'::jsonb),
      'target_user_ids', coalesce(to_jsonb(p_target_user_ids), 'null'::jsonb)
    )
  from public.profiles p
  where p.is_active = true
    and (p_target_roles is null or p.role = any(p_target_roles))
    and (p_target_user_ids is null or p.id = any(p_target_user_ids));

  get diagnostics inserted_count = row_count;

  perform public.insert_audit_log(
    'notification.broadcast',
    'notification',
    null,
    jsonb_build_object('title', p_title, 'count', inserted_count)
  );

  return inserted_count;
end;
$$;

-- ========================
-- Admin / Security Helpers
-- ========================
create or replace function public.admin_update_user(
  p_target_user_id uuid,
  p_role public.user_role default null,
  p_certifications jsonb default null,
  p_is_active boolean default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.admin_update_user(p_target_user_id, p_role, p_certifications, p_is_active, null);
end;
$$;

create or replace function public.admin_update_user(
  p_target_user_id uuid,
  p_role public.user_role default null,
  p_certifications jsonb default null,
  p_is_active boolean default null,
  p_show_in_team_page boolean default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  requester public.profiles%rowtype;
  previous_row public.profiles%rowtype;
  updated_row public.profiles%rowtype;
  change_messages text[] := '{}'::text[];
  notify_type public.notification_type := 'ACCOUNT_UPDATED';
begin
  if not public.is_super_admin() then
    raise exception 'Only SUPER_ADMIN can update user roles';
  end if;

  select * into requester from public.profiles where id = auth.uid();
  select * into previous_row from public.profiles where id = p_target_user_id;

  if previous_row.id is null then
    raise exception 'Target user not found';
  end if;

  update public.profiles
  set role = coalesce(p_role, role),
      certifications = coalesce(p_certifications, certifications),
      is_active = coalesce(p_is_active, is_active),
      show_in_team_page = coalesce(p_show_in_team_page, show_in_team_page),
      updated_at = timezone('utc', now())
  where id = p_target_user_id
  returning * into updated_row;

  if previous_row.role is distinct from updated_row.role then
    change_messages := array_append(change_messages, '角色已变更为 ' || updated_row.role::text);
    notify_type := 'ROLE_CHANGED';
  end if;

  if previous_row.is_active is distinct from updated_row.is_active then
    change_messages := array_append(
      change_messages,
      case when updated_row.is_active then '账号已恢复启用' else '账号已被停用' end
    );
  end if;

  if previous_row.certifications is distinct from updated_row.certifications then
    change_messages := array_append(change_messages, '认证信息已更新');
  end if;

  if previous_row.show_in_team_page is distinct from updated_row.show_in_team_page then
    change_messages := array_append(
      change_messages,
      case when updated_row.show_in_team_page then '已加入团队页展示' else '已从团队页展示中移除' end
    );
  end if;

  if array_length(change_messages, 1) is not null then
    insert into public.notifications (
      user_id,
      actor_id,
      actor_display_name,
      actor_avatar_url,
      type,
      title,
      content,
      link,
      metadata
    )
    values (
      updated_row.id,
      requester.id,
      requester.nickname,
      requester.avatar_url,
      notify_type,
      case when notify_type = 'ROLE_CHANGED' then '账户权限已更新' else '账户信息已更新' end,
      array_to_string(change_messages, '；'),
      '/profile',
      jsonb_build_object('target_user_id', updated_row.id)
    );
  end if;

  perform public.insert_audit_log(
    'user.updated',
    'profile',
    updated_row.id::text,
    jsonb_build_object(
      'old_role', previous_row.role,
      'new_role', updated_row.role,
      'old_active', previous_row.is_active,
      'new_active', updated_row.is_active,
      'old_certifications', previous_row.certifications,
      'new_certifications', updated_row.certifications,
      'old_show_in_team_page', previous_row.show_in_team_page,
      'new_show_in_team_page', updated_row.show_in_team_page
    )
  );

  return updated_row;
end;
$$;

create or replace function public.admin_review_callsign_application(
  p_application_id uuid,
  p_status text,
  p_reviewer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.callsign_applications%rowtype;
  v_reviewer public.profiles%rowtype;
  v_status text := upper(coalesce(p_status, ''));
begin
  if not public.is_super_admin() then
    raise exception 'Only SUPER_ADMIN can review callsign applications';
  end if;

  if v_status not in ('APPROVED', 'REJECTED') then
    raise exception 'Invalid callsign review status';
  end if;

  select * into v_app
  from public.callsign_applications
  where id = p_application_id
  for update;

  if v_app.id is null then
    raise exception 'Callsign application not found';
  end if;

  if v_app.status <> 'PENDING' then
    raise exception 'This callsign application has already been reviewed';
  end if;

  select * into v_reviewer from public.profiles where id = auth.uid();

  if v_status = 'APPROVED' then
    if exists (
      select 1
      from public.profiles p
      where p.id <> v_app.user_id
        and p.callsign is not null
        and upper(p.callsign) = upper(v_app.callsign)
    ) then
      raise exception 'Callsign already exists';
    end if;

    update public.profiles
    set callsign = v_app.callsign,
        updated_at = timezone('utc', now())
    where id = v_app.user_id;
  end if;

  update public.callsign_applications
  set status = v_status,
      reviewer_id = auth.uid(),
      reviewer_note = nullif(p_reviewer_note, ''),
      reviewed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = p_application_id;

  insert into public.notifications (
    user_id,
    actor_id,
    actor_display_name,
    actor_avatar_url,
    type,
    title,
    content,
    link,
    metadata
  )
  values (
    v_app.user_id,
    v_reviewer.id,
    v_reviewer.nickname,
    v_reviewer.avatar_url,
    'ACCOUNT_UPDATED',
    case when v_status = 'APPROVED' then '你的呼号申请已通过' else '你的呼号申请未通过' end,
    coalesce(nullif(p_reviewer_note, ''), case when v_status = 'APPROVED' then '呼号已更新到你的资料页。' else '请根据审核意见修改后重新提交。' end),
    '/profile',
    jsonb_build_object(
      'callsign_application_id', v_app.id,
      'callsign', v_app.callsign,
      'status', v_status
    )
  );

  perform public.insert_audit_log(
    case when v_status = 'APPROVED' then 'callsign.approved' else 'callsign.rejected' end,
    'callsign_application',
    v_app.id::text,
    jsonb_build_object(
      'user_id', v_app.user_id,
      'callsign', v_app.callsign,
      'reviewer_note', p_reviewer_note,
      'status', v_status
    )
  );

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'application_id', v_app.id,
    'user_id', v_app.user_id,
    'callsign', v_app.callsign
  );
end;
$$;

create or replace function public.assign_submission_to_reviewer()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission_id uuid;
  v_reviewer public.profiles%rowtype;
begin
  if not public.can_moderate() then
    raise exception 'Only moderators can assign submissions';
  end if;

  select * into v_reviewer from public.profiles where id = auth.uid();

  select s.id
    into v_submission_id
  from public.submissions s
  where s.status = 'PENDING'
    and s.assigned_reviewer_id is null
  order by s.created_at asc
  limit 1
  for update skip locked;

  if v_submission_id is null then
    return;
  end if;

  update public.submissions
  set assigned_reviewer_id = auth.uid(),
      updated_at = timezone('utc', now())
  where id = v_submission_id;

  insert into public.submission_reviews (
    submission_id,
    reviewer_id,
    reviewer_display_name,
    action,
    note
  )
  values (
    v_submission_id,
    v_reviewer.id,
    v_reviewer.nickname,
    'ASSIGNED',
    '自动分配给当前审核员'
  );
end;
$$;

-- ======================
-- Hash / Duplicate Query
-- ======================
create or replace function public.find_similar_images(
  p_phash_hex text,
  p_threshold integer default 10,
  p_limit integer default 10
)
returns table (
  id uuid,
  title text,
  slug text,
  image_url text,
  uploader_display_name text,
  hamming_distance integer
)
language plpgsql
set search_path = public
as $$
declare
  v_phash bit(64);
begin
  v_phash := ('x' || p_phash_hex)::bit(64);

  return query
  select
    t.id,
    t.title,
    t.slug,
    t.image_url,
    t.uploader_display_name,
    t.dist
  from (
    select
      i.id,
      i.title,
      i.slug,
      i.image_url,
      i.uploader_display_name,
      bit_count(('x' || i.phash)::bit(64) # v_phash)::integer as dist
    from public.images i
    where i.phash is not null
      and length(i.phash) = 16
  ) t
  where t.dist <= p_threshold
    and t.dist > 0
  order by t.dist asc
  limit p_limit;
end;
$$;

create or replace function public.find_similar_submissions(
  p_phash_hex text,
  p_threshold integer default 10,
  p_limit integer default 10
)
returns table (
  id uuid,
  title text,
  status text,
  storage_path text,
  distance integer
)
language plpgsql
set search_path = public
as $$
declare
  v_phash bit(64);
begin
  v_phash := ('x' || p_phash_hex)::bit(64);

  return query
  select
    t.id,
    t.title,
    t.status,
    t.storage_path,
    t.dist
  from (
    select
      s.id,
      s.title,
      s.status::text,
      s.storage_path,
      bit_count(('x' || s.phash)::bit(64) # v_phash)::integer as dist
    from public.submissions s
    where s.phash is not null
      and length(s.phash) = 16
  ) t
  where t.dist <= p_threshold
    and t.dist > 0
  order by t.dist asc
  limit p_limit;
end;
$$;

create or replace function public.find_duplicate_images_by_md5(p_md5 text)
returns table (
  id uuid,
  title text,
  slug text,
  image_url text
)
language sql
stable
set search_path = public
as $$
  select i.id, i.title, i.slug, i.image_url
  from public.images i
  where i.file_md5 = p_md5;
$$;

create or replace function public.find_duplicate_images_by_md5(p_md5 varchar)
returns table (
  id uuid,
  title text,
  image_url text,
  uploader_display_name text,
  slug text
)
language sql
stable
set search_path = public
as $$
  select i.id, i.title, i.image_url, i.uploader_display_name, i.slug
  from public.images i
  where i.file_md5 = p_md5;
$$;

create or replace function public.find_duplicate_submissions_by_md5(p_md5 text)
returns table (
  id uuid,
  title text,
  status text,
  storage_path text
)
language sql
stable
set search_path = public
as $$
  select s.id, s.title, s.status::text, s.storage_path
  from public.submissions s
  where s.file_md5 = p_md5;
$$;

create or replace function public.find_duplicate_submissions_by_md5(p_md5 varchar)
returns table (
  id uuid,
  title text,
  storage_path text,
  uploader_display_name text,
  status text
)
language sql
stable
set search_path = public
as $$
  select s.id, s.title, s.storage_path, s.uploader_display_name, s.status::text
  from public.submissions s
  where s.file_md5 = p_md5;
$$;

-- =================
-- Auth Triggers
-- =================
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email on auth.users
for each row execute procedure public.sync_user_profile_from_auth();

insert into public.profiles (id, email, nickname)
select
  u.id,
  u.email,
  left(coalesce(nullif(u.raw_user_meta_data ->> 'nickname', ''), split_part(u.email, '@', 1), '用户'), 40)
from auth.users u
on conflict (id) do nothing;

-- =================
-- App Triggers
-- =================
drop trigger if exists trg_profiles_assign_uid on public.profiles;
create trigger trg_profiles_assign_uid
before insert on public.profiles
for each row execute procedure public.assign_uid();

drop trigger if exists trg_profiles_guard_update on public.profiles;
create trigger trg_profiles_guard_update
before update on public.profiles
for each row execute procedure public.guard_profile_update();

drop trigger if exists trg_images_prepare on public.images;
create trigger trg_images_prepare
before insert or update on public.images
for each row execute procedure public.prepare_image_row();

drop trigger if exists trg_submissions_prepare on public.submissions;
create trigger trg_submissions_prepare
before insert or update on public.submissions
for each row execute procedure public.prepare_submission_row();

drop trigger if exists trg_comments_prepare on public.comments;
create trigger trg_comments_prepare
before insert or update on public.comments
for each row execute procedure public.prepare_comment_row();

drop trigger if exists trg_announcements_prepare on public.announcements;
create trigger trg_announcements_prepare
before insert or update on public.announcements
for each row execute procedure public.prepare_announcement_row();

drop trigger if exists trg_callsign_applications_touch on public.callsign_applications;
create trigger trg_callsign_applications_touch
before update on public.callsign_applications
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_plugins_touch on public.plugins;
create trigger trg_plugins_touch
before update on public.plugins
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_plugin_settings_touch on public.plugin_settings;
create trigger trg_plugin_settings_touch
before update on public.plugin_settings
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_comments_refresh_count on public.comments;
create trigger trg_comments_refresh_count
after insert or update or delete on public.comments
for each row execute procedure public.sync_comment_count_trigger();

drop trigger if exists trg_reactions_refresh_summary on public.image_reactions;
create trigger trg_reactions_refresh_summary
after insert or update or delete on public.image_reactions
for each row execute procedure public.sync_reaction_summary_trigger();

drop trigger if exists trg_submission_notify_created on public.submissions;
create trigger trg_submission_notify_created
after insert on public.submissions
for each row execute procedure public.notify_submission_created();

drop trigger if exists trg_comments_notify_created on public.comments;
create trigger trg_comments_notify_created
after insert on public.comments
for each row execute procedure public.notify_comment_created();

-- ===
-- RLS
-- ===
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.images enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_reviews enable row level security;
alter table public.comments enable row level security;
alter table public.image_reactions enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.audit_logs enable row level security;
alter table public.friend_links enable row level security;
alter table public.callsign_applications enable row level security;
alter table public.plugins enable row level security;
alter table public.plugin_settings enable row level security;

-- profiles
 drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self
on public.profiles
for select
  to authenticated
using (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
  to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
on public.profiles
for select
  to authenticated
using (public.is_super_admin());

-- images
 drop policy if exists images_public_select on public.images;
create policy images_public_select
on public.images
for select
  to public
using (status = 'PUBLISHED');

drop policy if exists images_moderator_select on public.images;
create policy images_moderator_select
on public.images
for select
  to authenticated
using (public.can_moderate());

drop policy if exists images_moderator_insert on public.images;
create policy images_moderator_insert
on public.images
for insert
  to authenticated
with check (public.can_moderate());

drop policy if exists images_moderator_update on public.images;
create policy images_moderator_update
on public.images
for update
  to authenticated
using (public.can_moderate())
with check (public.can_moderate());

drop policy if exists images_moderator_delete on public.images;
create policy images_moderator_delete
on public.images
for delete
  to authenticated
using (public.can_moderate());

-- submissions
 drop policy if exists submissions_own_select on public.submissions;
create policy submissions_own_select
on public.submissions
for select
  to authenticated
using (uploader_id = auth.uid());

drop policy if exists submissions_own_insert on public.submissions;
create policy submissions_own_insert
on public.submissions
for insert
  to authenticated
with check (
  uploader_id = auth.uid()
  and public.is_current_user_active()
);

drop policy if exists submissions_own_update_pending on public.submissions;
create policy submissions_own_update_pending
on public.submissions
for update
  to authenticated
using (
  uploader_id = auth.uid()
  and status = 'PENDING'
)
with check (
  uploader_id = auth.uid()
  and status = 'PENDING'
);

drop policy if exists submissions_own_delete_pending_or_rejected on public.submissions;
create policy submissions_own_delete_pending_or_rejected
on public.submissions
for delete
  to authenticated
using (
  uploader_id = auth.uid()
  and status in ('PENDING', 'REJECTED')
);

drop policy if exists submissions_moderator_select on public.submissions;
create policy submissions_moderator_select
on public.submissions
for select
  to authenticated
using (public.can_moderate());

drop policy if exists submissions_moderator_update on public.submissions;
create policy submissions_moderator_update
on public.submissions
for update
  to authenticated
using (public.can_moderate())
with check (public.can_moderate());

-- submission reviews
 drop policy if exists submission_reviews_owner_select on public.submission_reviews;
create policy submission_reviews_owner_select
on public.submission_reviews
for select
  to authenticated
using (
  exists (
    select 1
    from public.submissions s
    where s.id = submission_reviews.submission_id
      and s.uploader_id = auth.uid()
  )
);

drop policy if exists submission_reviews_moderator_select on public.submission_reviews;
create policy submission_reviews_moderator_select
on public.submission_reviews
for select
  to authenticated
using (public.can_moderate());

drop policy if exists submission_reviews_moderator_insert on public.submission_reviews;
create policy submission_reviews_moderator_insert
on public.submission_reviews
for insert
  to authenticated
with check (public.can_moderate());

-- comments
 drop policy if exists comments_public_select on public.comments;
create policy comments_public_select
on public.comments
for select
  to public
using (
  status = 'VISIBLE'
  and exists (
    select 1
    from public.images i
    where i.id = comments.image_id
      and i.status = 'PUBLISHED'
  )
);

drop policy if exists comments_own_insert on public.comments;
create policy comments_own_insert
on public.comments
for insert
  to authenticated
with check (
  user_id = auth.uid()
  and public.is_current_user_active()
  and exists (
    select 1
    from public.images i
    where i.id = comments.image_id
      and i.status = 'PUBLISHED'
  )
);

drop policy if exists comments_own_update on public.comments;
create policy comments_own_update
on public.comments
for update
  to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and status = 'VISIBLE'
);

drop policy if exists comments_own_delete on public.comments;
create policy comments_own_delete
on public.comments
for delete
  to authenticated
using (user_id = auth.uid());

drop policy if exists comments_moderator_manage on public.comments;
create policy comments_moderator_manage
on public.comments
for all
  to authenticated
using (public.can_moderate())
with check (public.can_moderate());

-- reactions
 drop policy if exists reactions_select_own on public.image_reactions;
create policy reactions_select_own
on public.image_reactions
for select
  to authenticated
using (
  user_id = auth.uid()
  or public.can_moderate()
);

drop policy if exists reactions_insert_own on public.image_reactions;
create policy reactions_insert_own
on public.image_reactions
for insert
  to authenticated
with check (
  user_id = auth.uid()
  and public.is_current_user_active()
  and exists (
    select 1
    from public.images i
    where i.id = image_reactions.image_id
      and i.status = 'PUBLISHED'
  )
);

drop policy if exists reactions_delete_own on public.image_reactions;
create policy reactions_delete_own
on public.image_reactions
for delete
  to authenticated
using (
  user_id = auth.uid()
  or public.can_moderate()
);

-- notifications
 drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select
  to authenticated
using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications
for update
  to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notifications_insert_moderator_or_self on public.notifications;
create policy notifications_insert_moderator_or_self
on public.notifications
for insert
  to authenticated
with check (
  public.can_moderate()
  or (auth.uid() = actor_id and auth.uid() = user_id)
);

-- announcements
 drop policy if exists announcements_public_active on public.announcements;
create policy announcements_public_active
on public.announcements
for select
  to public
using (
  is_active = true
  and starts_at <= timezone('utc', now())
  and (ends_at is null or ends_at >= timezone('utc', now()))
);

drop policy if exists announcements_admin_manage on public.announcements;
create policy announcements_admin_manage
on public.announcements
for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- sessions
 drop policy if exists sessions_select_own on public.sessions;
create policy sessions_select_own
on public.sessions
for select
  to authenticated
using (user_id = auth.uid());

 drop policy if exists sessions_insert_own on public.sessions;
create policy sessions_insert_own
on public.sessions
for insert
  to authenticated
with check (user_id = auth.uid());

 drop policy if exists sessions_update_own on public.sessions;
create policy sessions_update_own
on public.sessions
for update
  to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

 drop policy if exists sessions_delete_own on public.sessions;
create policy sessions_delete_own
on public.sessions
for delete
  to authenticated
using (user_id = auth.uid());

-- audit logs
 drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin
on public.audit_logs
for select
  to authenticated
using (public.is_super_admin());

-- friend links
 drop policy if exists friend_links_public_select on public.friend_links;
create policy friend_links_public_select
on public.friend_links
for select
  to public
using (is_active = true);

drop policy if exists friend_links_admin_manage on public.friend_links;
create policy friend_links_admin_manage
on public.friend_links
for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- callsign applications
 drop policy if exists callsign_app_own_select on public.callsign_applications;
create policy callsign_app_own_select
on public.callsign_applications
for select
  to authenticated
using (user_id = auth.uid());

drop policy if exists callsign_app_own_insert on public.callsign_applications;
create policy callsign_app_own_insert
on public.callsign_applications
for insert
  to authenticated
with check (user_id = auth.uid());

drop policy if exists callsign_app_admin on public.callsign_applications;
create policy callsign_app_admin
on public.callsign_applications
for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- plugins
 drop policy if exists plugins_public_select on public.plugins;
create policy plugins_public_select
on public.plugins
for select
  to public
using (true);

drop policy if exists plugins_admin_manage on public.plugins;
create policy plugins_admin_manage
on public.plugins
for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- plugin settings
 drop policy if exists plugin_settings_admin_select on public.plugin_settings;
create policy plugin_settings_admin_select
on public.plugin_settings
for select
  to authenticated
using (public.is_super_admin());

drop policy if exists plugin_settings_admin_manage on public.plugin_settings;
create policy plugin_settings_admin_manage
on public.plugin_settings
for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- =========================
-- Storage Buckets / Policies
-- =========================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('gallery-images', 'gallery-images', true, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('submission-images', 'submission-images', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('callsign-docs', 'callsign-docs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

-- gallery-images
 drop policy if exists storage_gallery_public_read on storage.objects;
create policy storage_gallery_public_read
on storage.objects
for select
  to public
using (bucket_id = 'gallery-images');

drop policy if exists storage_gallery_moderator_insert on storage.objects;
create policy storage_gallery_moderator_insert
on storage.objects
for insert
  to authenticated
with check (
  bucket_id = 'gallery-images'
  and public.can_moderate()
);

drop policy if exists storage_gallery_moderator_update on storage.objects;
create policy storage_gallery_moderator_update
on storage.objects
for update
  to authenticated
using (
  bucket_id = 'gallery-images'
  and public.can_moderate()
)
with check (
  bucket_id = 'gallery-images'
  and public.can_moderate()
);

drop policy if exists storage_gallery_moderator_delete on storage.objects;
create policy storage_gallery_moderator_delete
on storage.objects
for delete
  to authenticated
using (
  bucket_id = 'gallery-images'
  and public.can_moderate()
);

-- submission-images
 drop policy if exists storage_submissions_owner_or_moderator_select on storage.objects;
create policy storage_submissions_owner_or_moderator_select
on storage.objects
for select
  to authenticated
using (
  bucket_id = 'submission-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.can_moderate()
  )
);

drop policy if exists storage_submissions_owner_insert on storage.objects;
create policy storage_submissions_owner_insert
on storage.objects
for insert
  to authenticated
with check (
  bucket_id = 'submission-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
);

drop policy if exists storage_submissions_owner_update on storage.objects;
create policy storage_submissions_owner_update
on storage.objects
for update
  to authenticated
using (
  bucket_id = 'submission-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.can_moderate()
  )
)
with check (
  bucket_id = 'submission-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.can_moderate()
  )
);

drop policy if exists storage_submissions_owner_delete on storage.objects;
create policy storage_submissions_owner_delete
on storage.objects
for delete
  to authenticated
using (
  bucket_id = 'submission-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.can_moderate()
  )
);

-- callsign-docs
 drop policy if exists storage_callsign_owner_or_admin_select on storage.objects;
create policy storage_callsign_owner_or_admin_select
on storage.objects
for select
  to authenticated
using (
  bucket_id = 'callsign-docs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_super_admin()
  )
);

drop policy if exists storage_callsign_owner_insert on storage.objects;
create policy storage_callsign_owner_insert
on storage.objects
for insert
  to authenticated
with check (
  bucket_id = 'callsign-docs'
  and (storage.foldername(name))[1] = auth.uid()::text
  and storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'pdf')
);

drop policy if exists storage_callsign_owner_or_admin_update on storage.objects;
create policy storage_callsign_owner_or_admin_update
on storage.objects
for update
  to authenticated
using (
  bucket_id = 'callsign-docs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_super_admin()
  )
)
with check (
  bucket_id = 'callsign-docs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_super_admin()
  )
);

drop policy if exists storage_callsign_owner_or_admin_delete on storage.objects;
create policy storage_callsign_owner_or_admin_delete
on storage.objects
for delete
  to authenticated
using (
  bucket_id = 'callsign-docs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_super_admin()
  )
);

-- =====================
-- Seed Built-in Plugins
-- =====================
insert into public.plugins (id, name, version, description, installed, registration_status, install_source, registered_at, uninstalled_at, enabled, default_enabled, installed_version, api_version, host_version_range, status)
values
  ('friend-links', '友情链接', '1.4.1', '为后台提供友情链接管理能力。', true, 'installed', 'builtin', null, null, true, true, '1.4.1', '1.1.0', '^1.1.0', 'enabled'),
  ('callsign-review', '呼号系统', '1.9.1', '提供呼号申请页面和后台审核能力。', true, 'installed', 'builtin', null, null, true, true, '1.9.1', '1.1.0', '^1.1.0', 'enabled'),
  ('hash-processor', '哈希处理器', '2.0.1', '为后台提供 pHash/MD5 工具页。', true, 'installed', 'builtin', null, null, true, true, '2.0.1', '1.1.0', '^1.1.0', 'enabled')
on conflict (id) do update
set name = excluded.name,
    version = excluded.version,
    description = excluded.description,
    installed = excluded.installed,
    registration_status = excluded.registration_status,
    install_source = excluded.install_source,
    registered_at = excluded.registered_at,
    uninstalled_at = excluded.uninstalled_at,
    enabled = excluded.enabled,
    default_enabled = excluded.default_enabled,
    installed_version = excluded.installed_version,
    api_version = excluded.api_version,
    host_version_range = excluded.host_version_range,
    status = excluded.status,
    updated_at = timezone('utc', now());

insert into public.plugin_settings (plugin_id, key, value_json)
values
  ('friend-links', 'config', '{"enablePublicFooterLinks": true, "footerTitle": "友情链接", "maxVisibleLinks": 20, "openInNewTab": true, "showDashboardWidget": true, "showAdminQuickActions": true}'::jsonb),
  ('callsign-review', 'config', '{"maxUploadSizeMB": 10, "autoUppercaseCallsign": true, "customNotice": "请上传业余无线电操作证书或执照扫描件（PDF / 图片），建议对证件号等敏感信息添加水印或打码处理后再上传。文件大小不超过 10MB。", "showDashboardWidget": true, "showSelfProfilePanel": true, "showPublicProfilePanel": true, "showUserListItemExtra": true, "showAdminUserActions": true, "showAdminListFields": true, "showTopbarAction": true, "showNotificationPanel": true, "showAdminQuickActions": true}'::jsonb),
  ('hash-processor', 'config', '{"defaultTargetTable": "images", "defaultBatchSize": 10, "allowSubmissionsTable": true, "enableImageDetailActions": true, "showDashboardWidget": true, "showSelfProfilePanel": true, "showImageListCardExtra": true, "showSubmissionReviewPanel": true, "showTopbarAction": true, "showAuditLogPanel": true, "showReviewBulkActions": true, "showAdminQuickActions": true}'::jsonb)
on conflict (plugin_id, key) do update
set value_json = excluded.value_json,
    updated_at = timezone('utc', now());

-- ======================
-- Function Execute Grants
-- ======================
grant execute on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- ==============
-- Bootstrap Note
-- ==============
-- 首个超级管理员请手动执行，例如：
-- update public.profiles
-- set role = 'SUPER_ADMIN'
-- where email = 'your-admin@example.com';

-- =========================
-- Realtime Publications
-- =========================
do $$
begin
  alter publication supabase_realtime add table public.sessions;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;

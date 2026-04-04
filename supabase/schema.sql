-- HamGam / Supabase 鍏ㄩ噺鍒濆鍖栬剼鏈紙鎸夊綋鍓嶉」鐩暟鎹簱蹇収閲嶅啓锛?
--
-- 鐢ㄩ€旓細
-- 1) 鏂扮幆澧冨揩閫熷垵濮嬪寲鏁版嵁搴撶粨鏋勩€丷LS銆佸嚱鏁般€佸瓨鍌ㄦ《涓庢彃浠惰繍琛屾椂琛?
-- 2) 灏介噺瀵归綈褰撳墠椤圭洰瀹為檯浣跨敤鐨勫瓧娈典笌 RPC
--
-- 璇存槑锛?
-- - 鏈枃浠跺凡鍚堝苟鏃?schema + 褰撳墠椤圭洰鍦ㄧ敤缁撴瀯 + 鎻掍欢绯荤粺鍩虹琛?
-- - 鍑轰簬绋冲仴鎬ц€冭檻锛屾湭鏀跺綍褰撳墠搴撻噷鐨勪复鏃惰〃 test_table
-- - 鎵ц瀹屾湰鏂囦欢鍚庯紝鍐嶉儴缃?Edge Functions
-- - 棣栦釜瓒呯骇绠＄悊鍛樿鎵嬪姩鎻愬崌

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
  show_in_team_page boolean not null default false,
  constraint profiles_nickname_length check (char_length(nickname) between 1 and 40),
  constraint profiles_uid_unique unique (uid)
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
  phash_bits bit(64),
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
  phash_bits bit(64),
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

create table if not exists public.system_settings (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.image_feedbacks (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.images(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('violation', 'copyright', 'quality', 'other')),
  content text not null,
  contact_email text,
  status text not null default 'PENDING' check (status in ('PENDING', 'DISMISS', 'RESOLVED', 'DISCUSS', 'MORE_INFO')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_note text,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.image_feedbacks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.site_feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('bug', 'feature', 'improvement', 'other')),
  content text not null,
  contact_email text,
  status text not null default 'PENDING' check (status in ('PENDING', 'READ', 'RESOLVED', 'DISMISSED')),
  admin_note text,
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
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

create index if not exists idx_images_status_published_at on public.images(status, published_at desc);
create index if not exists idx_images_sort_time on public.images((coalesce(legacy_updated_at, published_at)) desc);
create index if not exists idx_images_uploader_id on public.images(uploader_id);
create index if not exists idx_images_phash on public.images(phash);
create index if not exists idx_images_phash_bits on public.images(phash_bits);
create index if not exists idx_images_file_md5 on public.images(file_md5);

create index if not exists idx_submissions_status_created_at on public.submissions(status, created_at desc);
create index if not exists idx_submissions_uploader_id on public.submissions(uploader_id, created_at desc);
create index if not exists idx_submissions_reviewer_id on public.submissions(reviewer_id);
create index if not exists idx_submissions_assigned_reviewer_id on public.submissions(assigned_reviewer_id);
create index if not exists idx_submissions_published_image_id on public.submissions(published_image_id);
create index if not exists idx_submissions_phash on public.submissions(phash);
create index if not exists idx_submissions_phash_bits on public.submissions(phash_bits);
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
create index if not exists idx_image_feedbacks_image on public.image_feedbacks(image_id);
create index if not exists idx_image_feedbacks_reporter on public.image_feedbacks(reporter_id);
create index if not exists idx_image_feedbacks_status on public.image_feedbacks(status);
create index if not exists idx_image_feedbacks_created on public.image_feedbacks(created_at desc);
create index if not exists idx_image_feedbacks_reviewer on public.image_feedbacks(reviewer_id);
create index if not exists idx_feedback_replies_feedback on public.feedback_replies(feedback_id);
create index if not exists idx_feedback_replies_author on public.feedback_replies(author_id);
create index if not exists idx_site_feedbacks_user on public.site_feedbacks(user_id);
create index if not exists idx_site_feedbacks_status on public.site_feedbacks(status);
create index if not exists idx_site_feedbacks_created on public.site_feedbacks(created_at desc);

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
  select coalesce(
    nullif(auth.jwt() ->> 'user_role', '')::public.user_role,
    (select role from public.profiles where id = auth.uid()),
    'USER'::public.user_role
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() = 'SUPER_ADMIN' and public.is_current_user_active();
$$;

create or replace function public.can_moderate()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() in ('SUPER_ADMIN', 'REVIEWER') and public.is_current_user_active();
$$;

create or replace function public.is_current_user_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() ->> 'is_active')::boolean,
    (select is_active from public.profiles where id = auth.uid()),
    true
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

create or replace function public.hex_to_bit64(p_phash_hex text)
returns bit(64)
language sql
immutable
set search_path = public
as $$
  select case
    when p_phash_hex ~ '^[0-9A-Fa-f]{16}$' then ('x' || lower(p_phash_hex))::bit(64)
    else null::bit(64)
  end;
$$;

create or replace function public.sync_phash_bits_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.phash_bits := public.hex_to_bit64(new.phash);
  return new;
end;
$$;

-- ============================
-- Auth Claims / Profile Sync
-- ============================
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_claims jsonb;
  v_role public.user_role := 'USER'::public.user_role;
  v_is_active boolean := true;
  v_nickname text := '';
begin
  select
    coalesce(role, 'USER'::public.user_role),
    coalesce(is_active, true),
    coalesce(nickname, '')
  into
    v_role,
    v_is_active,
    v_nickname
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(v_role::text), true);
  v_claims := jsonb_set(v_claims, '{is_active}', to_jsonb(v_is_active), true);
  v_claims := jsonb_set(v_claims, '{nickname}', to_jsonb(v_nickname), true);

  event := jsonb_set(event, '{claims}', v_claims, true);
  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from anon, authenticated, public;

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
    '鐢ㄦ埛'
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
    new.uploader_display_name := coalesce(v_nickname, new.contributor_name, '鍖垮悕鎶曠鑰?);
  end if;

  if new.contributor_name is null or btrim(new.contributor_name) = '' then
    new.contributor_name := coalesce(new.uploader_display_name, '浣氬悕');
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
    new.uploader_display_name := coalesce(v_nickname, '鍖垮悕鐢ㄦ埛');
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
    new.author_display_name := coalesce(v_profile.nickname, '鍖垮悕鐢ㄦ埛');
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
    '鏈夋柊鐨勬姇绋垮緟瀹℃牳',
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
      '浣犵殑鍥剧墖鏀跺埌浜嗘柊璇勮',
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
    change_messages := array_append(change_messages, '瑙掕壊宸插彉鏇翠负 ' || updated_row.role::text);
    notify_type := 'ROLE_CHANGED';
  end if;

  if previous_row.is_active is distinct from updated_row.is_active then
    change_messages := array_append(
      change_messages,
      case when updated_row.is_active then '璐﹀彿宸叉仮澶嶅惎鐢? else '璐﹀彿宸茶鍋滅敤' end
    );
  end if;

  if previous_row.certifications is distinct from updated_row.certifications then
    change_messages := array_append(change_messages, '璁よ瘉淇℃伅宸叉洿鏂?);
  end if;

  if previous_row.show_in_team_page is distinct from updated_row.show_in_team_page then
    change_messages := array_append(
      change_messages,
      case when updated_row.show_in_team_page then '宸插姞鍏ュ洟闃熼〉灞曠ず' else '宸蹭粠鍥㈤槦椤靛睍绀轰腑绉婚櫎' end
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
      case when notify_type = 'ROLE_CHANGED' then '璐︽埛鏉冮檺宸叉洿鏂? else '璐︽埛淇℃伅宸叉洿鏂? end,
      array_to_string(change_messages, '锛?),
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
    case when v_status = 'APPROVED' then '浣犵殑鍛煎彿鐢宠宸查€氳繃' else '浣犵殑鍛煎彿鐢宠鏈€氳繃' end,
    coalesce(nullif(p_reviewer_note, ''), case when v_status = 'APPROVED' then '鍛煎彿宸叉洿鏂板埌浣犵殑璧勬枡椤点€? else '璇锋牴鎹鏍告剰瑙佷慨鏀瑰悗閲嶆柊鎻愪氦銆? end),
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
    '鑷姩鍒嗛厤缁欏綋鍓嶅鏍稿憳'
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
  v_phash := public.hex_to_bit64(p_phash_hex);
  if v_phash is null then
    return;
  end if;

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
      bit_count(i.phash_bits # v_phash)::integer as dist
    from public.images i
    where i.phash_bits is not null
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
  v_phash := public.hex_to_bit64(p_phash_hex);
  if v_phash is null then
    return;
  end if;

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
      bit_count(s.phash_bits # v_phash)::integer as dist
    from public.submissions s
    where s.phash_bits is not null
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

create or replace function public.update_feedback_status(
  p_feedback_id uuid,
  p_new_status text,
  p_review_note text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
begin
  select status
  into v_current_status
  from public.image_feedbacks
  where id = p_feedback_id;

  if not found then
    return json_build_object('success', false, 'error', 'Feedback not found');
  end if;

  if p_new_status = 'DISMISS' and v_current_status not in ('PENDING', 'DISCUSS', 'MORE_INFO') then
    return json_build_object('success', false, 'error', 'Invalid status transition');
  end if;

  update public.image_feedbacks
  set status = p_new_status,
      review_note = p_review_note,
      reviewer_id = auth.uid(),
      reviewed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = p_feedback_id;

  return json_build_object('success', true, 'new_status', p_new_status);
end;
$$;

create or replace function public.notify_admins_feedback(
  p_image_title text default null,
  p_feedback_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, content, link)
  select
    id,
    'SYSTEM',
    '鏂扮殑鍥剧墖鍙嶉宸叉彁浜?,
    case
      when p_image_title is not null then '鏈夌敤鎴锋彁浜や簡瀵广€? || p_image_title || '銆嬬殑鍥剧墖鍙嶉锛岃鍙婃椂澶勭悊銆?
      else '鏈夌敤鎴锋彁浜や簡鏂扮殑鍥剧墖鍙嶉锛岃鍙婃椂澶勭悊銆?
    end,
    p_feedback_url
  from public.profiles
  where role in ('SUPER_ADMIN', 'REVIEWER')
    and is_active = true;
end;
$$;

create or replace function public.notify_user_feedback_updated(
  p_user_id uuid,
  p_new_status text,
  p_image_title text default null,
  p_review_note text default null,
  p_feedback_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, content, link)
  values (
    p_user_id,
    'SYSTEM',
    '鍙嶉鐘舵€佸凡鏇存柊',
    case
      when p_image_title is not null then
        '浣犳彁浜ょ殑鍏充簬銆? || p_image_title || '銆嬬殑鍙嶉鐘舵€佸凡鍙樻洿涓猴細' ||
        case p_new_status
          when 'PENDING' then '寰呭鏍?
          when 'DISMISS' then '涓嶈鍏?
          when 'RESOLVED' then '宸茶В鍐?
          when 'DISCUSS' then '闇€璁ㄨ'
          when 'MORE_INFO' then '闇€鏇村淇℃伅'
          else p_new_status
        end ||
        case
          when p_review_note is not null and btrim(p_review_note) <> '' then '銆傚娉細' || p_review_note
          else ''
        end
      else
        '浣犵殑鍙嶉鐘舵€佸凡鍙樻洿涓猴細' ||
        case p_new_status
          when 'PENDING' then '寰呭鏍?
          when 'DISMISS' then '涓嶈鍏?
          when 'RESOLVED' then '宸茶В鍐?
          when 'DISCUSS' then '闇€璁ㄨ'
          when 'MORE_INFO' then '闇€鏇村淇℃伅'
          else p_new_status
        end
    end,
    p_feedback_url
  );
end;
$$;

create or replace function public.notify_admins_site_feedback(
  p_feedback_type text default null,
  p_feedback_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, content, link)
  select
    id,
    'SYSTEM',
    '鏂扮殑缃戠珯鍙嶉宸叉彁浜?,
    '鏈夌敤鎴锋彁浜や簡缃戠珯鍙嶉锛? ||
    case p_feedback_type
      when 'bug' then '闂鍙嶉'
      when 'feature' then '鍔熻兘寤鸿'
      when 'improvement' then '浣撻獙浼樺寲'
      else '鍏朵粬'
    end || '锛夛紝璇峰強鏃跺鐞嗐€?,
    p_feedback_url
  from public.profiles
  where role = 'SUPER_ADMIN'
    and is_active = true;
end;
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
  left(coalesce(nullif(u.raw_user_meta_data ->> 'nickname', ''), split_part(u.email, '@', 1), '鐢ㄦ埛'), 40)
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

drop trigger if exists trg_system_settings_touch on public.system_settings;
create trigger trg_system_settings_touch
before update on public.system_settings
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_images_sync_phash_bits on public.images;
create trigger trg_images_sync_phash_bits
before insert or update of phash on public.images
for each row execute procedure public.sync_phash_bits_trigger();

drop trigger if exists trg_submissions_sync_phash_bits on public.submissions;
create trigger trg_submissions_sync_phash_bits
before insert or update of phash on public.submissions
for each row execute procedure public.sync_phash_bits_trigger();

drop trigger if exists trigger_image_feedbacks_updated on public.image_feedbacks;
create trigger trigger_image_feedbacks_updated
before update on public.image_feedbacks
for each row execute procedure public.touch_updated_at();

drop trigger if exists trigger_site_feedbacks_updated on public.site_feedbacks;
create trigger trigger_site_feedbacks_updated
before update on public.site_feedbacks
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
alter table public.system_settings enable row level security;
alter table public.image_feedbacks enable row level security;
alter table public.feedback_replies enable row level security;
alter table public.site_feedbacks enable row level security;

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

-- system settings
 drop policy if exists system_settings_admin_select on public.system_settings;
create policy system_settings_admin_select
on public.system_settings
for select
  to authenticated
using (public.is_super_admin());

drop policy if exists system_settings_admin_manage on public.system_settings;
create policy system_settings_admin_manage
on public.system_settings
for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- image feedbacks
drop policy if exists image_feedbacks_select_own on public.image_feedbacks;
create policy image_feedbacks_select_own
on public.image_feedbacks
for select
  to authenticated
using (auth.uid() = reporter_id);

drop policy if exists image_feedbacks_insert_own on public.image_feedbacks;
create policy image_feedbacks_insert_own
on public.image_feedbacks
for insert
  to authenticated
with check (auth.uid() = reporter_id);

drop policy if exists image_feedbacks_update_more_info on public.image_feedbacks;
create policy image_feedbacks_update_more_info
on public.image_feedbacks
for update
  to authenticated
using (auth.uid() = reporter_id and status = 'MORE_INFO')
with check (auth.uid() = reporter_id);

drop policy if exists image_feedbacks_moderator_select on public.image_feedbacks;
create policy image_feedbacks_moderator_select
on public.image_feedbacks
for select
  to authenticated
using (public.can_moderate());

drop policy if exists image_feedbacks_moderator_manage on public.image_feedbacks;
create policy image_feedbacks_moderator_manage
on public.image_feedbacks
for update
  to authenticated
using (public.can_moderate())
with check (public.can_moderate());

-- feedback replies
drop policy if exists feedback_replies_select_participants on public.feedback_replies;
create policy feedback_replies_select_participants
on public.feedback_replies
for select
  to authenticated
using (
  exists (
    select 1
    from public.image_feedbacks f
    where f.id = feedback_id
      and (
        f.reporter_id = auth.uid()
        or f.reviewer_id = auth.uid()
        or public.can_moderate()
      )
  )
);

drop policy if exists feedback_replies_insert_reporter on public.feedback_replies;
create policy feedback_replies_insert_reporter
on public.feedback_replies
for insert
  to authenticated
with check (
  exists (
    select 1
    from public.image_feedbacks f
    where f.id = feedback_id
      and f.reporter_id = auth.uid()
  )
);

drop policy if exists feedback_replies_insert_moderator on public.feedback_replies;
create policy feedback_replies_insert_moderator
on public.feedback_replies
for insert
  to authenticated
with check (public.can_moderate());

-- site feedbacks
drop policy if exists site_feedbacks_select_own on public.site_feedbacks;
create policy site_feedbacks_select_own
on public.site_feedbacks
for select
  to authenticated
using (auth.uid() = user_id);

drop policy if exists site_feedbacks_insert_own on public.site_feedbacks;
create policy site_feedbacks_insert_own
on public.site_feedbacks
for insert
  to authenticated
with check (auth.uid() = user_id);

drop policy if exists site_feedbacks_admin_manage on public.site_feedbacks;
create policy site_feedbacks_admin_manage
on public.site_feedbacks
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

-- =========================
-- Seed Feature Flag Config
-- =========================
insert into public.system_settings (key, value_json, description)
values (
  'feature_flags',
  '{
    "friend-links": {
      "enabled": true,
      "config": {
        "enablePublicFooterLinks": true,
        "footerTitle": "\u53cb\u60c5\u94fe\u63a5",
        "maxVisibleLinks": 20,
        "openInNewTab": true,
        "showDashboardWidget": true,
        "showAdminQuickActions": true
      },
      "updatedAt": null
    },
    "callsign-review": {
      "enabled": true,
      "config": {
        "maxUploadSizeMB": 10,
        "autoUppercaseCallsign": true,
        "customNotice": "\u8bf7\u4e0a\u4f20\u4e1a\u4f59\u65e0\u7ebf\u7535\u64cd\u4f5c\u8bc1\u4e66\u6216\u6267\u7167\u626b\u63cf\u4ef6\uff08PDF / \u56fe\u7247\uff09\uff0c\u5efa\u8bae\u5bf9\u8bc1\u4ef6\u53f7\u7b49\u654f\u611f\u4fe1\u606f\u6dfb\u52a0\u6c34\u5370\u6216\u6253\u7801\u5904\u7406\u540e\u518d\u4e0a\u4f20\u3002\u6587\u4ef6\u5927\u5c0f\u4e0d\u8d85\u8fc7 10MB\u3002",
        "showDashboardWidget": true,
        "showSelfProfilePanel": true,
        "showPublicProfilePanel": true,
        "showUserListItemExtra": true,
        "showAdminUserActions": true,
        "showAdminListFields": true,
        "showTopbarAction": true,
        "showNotificationPanel": true,
        "showAdminQuickActions": true
      },
      "updatedAt": null
    },
    "hash-processor": {
      "enabled": true,
      "config": {
        "defaultTargetTable": "images",
        "defaultBatchSize": 10,
        "allowSubmissionsTable": true,
        "enableImageDetailActions": true,
        "showDashboardWidget": true,
        "showSelfProfilePanel": true,
        "showImageListCardExtra": true,
        "showSubmissionReviewPanel": true,
        "showTopbarAction": true,
        "showAuditLogPanel": true,
        "showReviewBulkActions": true,
        "showAdminQuickActions": true
      },
      "updatedAt": null
    }
  }'::jsonb,
  'Builtin feature flags for internal modules'
)
on conflict (key) do update
set value_json = excluded.value_json,
    description = excluded.description,
    updated_at = timezone('utc', now());
-- ======================
-- Function Execute Grants
-- ======================
grant execute on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- ==============
-- Bootstrap Note
-- ==============
-- 棣栦釜瓒呯骇绠＄悊鍛樿鎵嬪姩鎵ц锛屼緥濡傦細
-- update public.profiles
-- set role = 'SUPER_ADMIN'
-- where email = 'your-admin@example.com';

-- =========================
-- Realtime Publications
-- =========================
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;


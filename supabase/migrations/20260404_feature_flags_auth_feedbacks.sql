create extension if not exists pgcrypto;

create table if not exists public.system_settings (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles(id) on delete set null
);

grant select, insert, update, delete on public.system_settings to anon, authenticated, service_role;

do $$
declare
  v_feature_flags jsonb := '{}'::jsonb;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'plugins') then
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'plugin_settings') then
      select coalesce(
        jsonb_object_agg(
          p.id,
          jsonb_build_object(
            'enabled', coalesce(p.enabled, p.default_enabled, true),
            'config', coalesce(ps.value_json, '{}'::jsonb),
            'updatedAt', p.updated_at
          )
        ),
        '{}'::jsonb
      )
      into v_feature_flags
      from public.plugins p
      left join public.plugin_settings ps
        on ps.plugin_id = p.id
       and ps.key = 'config';
    else
      select coalesce(
        jsonb_object_agg(
          p.id,
          jsonb_build_object(
            'enabled', coalesce(p.enabled, p.default_enabled, true),
            'config', '{}'::jsonb,
            'updatedAt', p.updated_at
          )
        ),
        '{}'::jsonb
      )
      into v_feature_flags
      from public.plugins p;
    end if;
  end if;

  if v_feature_flags = '{}'::jsonb then
    v_feature_flags := jsonb_build_object(
      'friend-links', jsonb_build_object(
        'enabled', true,
        'config', jsonb_build_object(
          'enablePublicFooterLinks', true,
          'footerTitle', '友情链接',
          'maxVisibleLinks', 20,
          'openInNewTab', true,
          'showDashboardWidget', true,
          'showAdminQuickActions', true
        ),
        'updatedAt', null
      ),
      'callsign-review', jsonb_build_object(
        'enabled', true,
        'config', jsonb_build_object(
          'maxUploadSizeMB', 10,
          'autoUppercaseCallsign', true,
          'customNotice', '请上传业余无线电操作证书或执照扫描件（PDF / 图片），建议对证件号等敏感信息添加水印或打码处理后再上传。文件大小不超过 10MB。',
          'showDashboardWidget', true,
          'showSelfProfilePanel', true,
          'showPublicProfilePanel', true,
          'showUserListItemExtra', true,
          'showAdminUserActions', true,
          'showAdminListFields', true,
          'showTopbarAction', true,
          'showNotificationPanel', true,
          'showAdminQuickActions', true
        ),
        'updatedAt', null
      ),
      'hash-processor', jsonb_build_object(
        'enabled', true,
        'config', jsonb_build_object(
          'defaultTargetTable', 'images',
          'defaultBatchSize', 10,
          'allowSubmissionsTable', true,
          'enableImageDetailActions', true,
          'showDashboardWidget', true,
          'showSelfProfilePanel', true,
          'showImageListCardExtra', true,
          'showSubmissionReviewPanel', true,
          'showTopbarAction', true,
          'showAuditLogPanel', true,
          'showReviewBulkActions', true,
          'showAdminQuickActions', true
        ),
        'updatedAt', null
      )
    );
  end if;

  insert into public.system_settings (key, value_json, description)
  values ('feature_flags', v_feature_flags, 'Builtin feature flags for internal modules')
  on conflict (key) do nothing;
end;
$$;

drop table if exists public.plugin_settings cascade;
drop table if exists public.plugins cascade;
drop table if exists public.sessions cascade;

drop function if exists public.claim_active_session(text, text);
drop function if exists public.release_active_session(text);
drop function if exists public.is_active_session_valid(text);
drop function if exists public.claim_active_session(uuid);
drop function if exists public.release_active_session(uuid);
drop function if exists public.validate_active_session(uuid);

alter table public.profiles drop column if exists active_auth_session_id;
alter table public.profiles drop column if exists active_auth_session_seen_at;

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

alter table public.images add column if not exists phash_bits bit(64);
alter table public.submissions add column if not exists phash_bits bit(64);

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

drop trigger if exists trg_images_sync_phash_bits on public.images;
create trigger trg_images_sync_phash_bits
before insert or update of phash on public.images
for each row execute procedure public.sync_phash_bits_trigger();

drop trigger if exists trg_submissions_sync_phash_bits on public.submissions;
create trigger trg_submissions_sync_phash_bits
before insert or update of phash on public.submissions
for each row execute procedure public.sync_phash_bits_trigger();

update public.images
set phash_bits = public.hex_to_bit64(phash)
where phash_bits is distinct from public.hex_to_bit64(phash);

update public.submissions
set phash_bits = public.hex_to_bit64(phash)
where phash_bits is distinct from public.hex_to_bit64(phash);

create index if not exists idx_images_phash_bits on public.images(phash_bits);
create index if not exists idx_submissions_phash_bits on public.submissions(phash_bits);

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

grant select, insert, update, delete on public.image_feedbacks to anon, authenticated, service_role;
grant select, insert, update, delete on public.feedback_replies to anon, authenticated, service_role;
grant select, insert, update, delete on public.site_feedbacks to anon, authenticated, service_role;

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

drop trigger if exists trg_system_settings_touch on public.system_settings;
create trigger trg_system_settings_touch
before update on public.system_settings
for each row execute procedure public.touch_updated_at();

drop trigger if exists trigger_image_feedbacks_updated on public.image_feedbacks;
create trigger trigger_image_feedbacks_updated
before update on public.image_feedbacks
for each row execute procedure public.touch_updated_at();

drop trigger if exists trigger_site_feedbacks_updated on public.site_feedbacks;
create trigger trigger_site_feedbacks_updated
before update on public.site_feedbacks
for each row execute procedure public.touch_updated_at();

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
    '新的图片反馈已提交',
    case
      when p_image_title is not null then '有用户提交了对《' || p_image_title || '》的图片反馈，请及时处理。'
      else '有用户提交了新的图片反馈，请及时处理。'
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
    '反馈状态已更新',
    case
      when p_image_title is not null then
        '你提交的关于《' || p_image_title || '》的反馈状态已变更为：' ||
        case p_new_status
          when 'PENDING' then '待审核'
          when 'DISMISS' then '不计入'
          when 'RESOLVED' then '已解决'
          when 'DISCUSS' then '需讨论'
          when 'MORE_INFO' then '需更多信息'
          else p_new_status
        end ||
        case
          when p_review_note is not null and btrim(p_review_note) <> '' then '。备注：' || p_review_note
          else ''
        end
      else
        '你的反馈状态已变更为：' ||
        case p_new_status
          when 'PENDING' then '待审核'
          when 'DISMISS' then '不计入'
          when 'RESOLVED' then '已解决'
          when 'DISCUSS' then '需讨论'
          when 'MORE_INFO' then '需更多信息'
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
    '新的网站反馈已提交',
    '有用户提交了网站反馈（' ||
    case p_feedback_type
      when 'bug' then '问题反馈'
      when 'feature' then '功能建议'
      when 'improvement' then '体验优化'
      else '其他'
    end || '），请及时处理。',
    p_feedback_url
  from public.profiles
  where role = 'SUPER_ADMIN'
    and is_active = true;
end;
$$;

alter table public.system_settings enable row level security;
alter table public.image_feedbacks enable row level security;
alter table public.feedback_replies enable row level security;
alter table public.site_feedbacks enable row level security;

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

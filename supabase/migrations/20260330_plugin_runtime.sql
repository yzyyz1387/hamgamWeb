-- 插件运行时：插件注册表 + 插件配置表 + RLS

create table if not exists public.plugins (
  id text primary key,
  name text not null,
  version text not null default '0.0.0',
  description text not null default '',
  enabled boolean not null default true,
  default_enabled boolean not null default true,
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

create index if not exists idx_plugins_enabled on public.plugins(enabled);
create index if not exists idx_plugin_settings_plugin_id on public.plugin_settings(plugin_id);

grant select, insert, update, delete on public.plugins to anon, authenticated, service_role;
grant select, insert, update, delete on public.plugin_settings to anon, authenticated, service_role;

alter table public.plugins enable row level security;
alter table public.plugin_settings enable row level security;

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

insert into public.plugins (id, name, version, description, enabled, default_enabled)
values
  ('friend-links', '友情链接', '1.0.0', '为后台提供友情链接管理能力。', true, true),
  ('callsign-review', '呼号系统', '1.0.0', '提供呼号申请页面和后台审核能力。', true, true),
  ('hash-processor', '哈希处理器', '1.0.0', '为后台提供 pHash/MD5 工具页。', true, true)
on conflict (id) do update
set name = excluded.name,
    version = excluded.version,
    description = excluded.description,
    default_enabled = excluded.default_enabled,
    updated_at = timezone('utc', now());

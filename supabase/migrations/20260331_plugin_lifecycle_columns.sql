alter table if exists public.plugins
  add column if not exists installed_version text,
  add column if not exists api_version text not null default '1.1.0',
  add column if not exists host_version_range text not null default '^1.1.0',
  add column if not exists status text not null default 'enabled',
  add column if not exists installed_at timestamptz,
  add column if not exists enabled_at timestamptz,
  add column if not exists disabled_at timestamptz,
  add column if not exists last_error text;

alter table if exists public.plugins
  drop constraint if exists plugins_status_check;

alter table if exists public.plugins
  add constraint plugins_status_check
  check (status in ('installed', 'enabled', 'disabled', 'error'));

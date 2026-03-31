alter table if exists public.plugins
  add column if not exists installed boolean not null default true,
  add column if not exists registration_status text not null default 'installed',
  add column if not exists install_source text not null default 'builtin',
  add column if not exists registered_at timestamptz,
  add column if not exists uninstalled_at timestamptz;

alter table if exists public.plugins
  drop constraint if exists plugins_registration_status_check;

alter table if exists public.plugins
  add constraint plugins_registration_status_check
  check (registration_status in ('installed', 'uninstalled'));

-- Security hardening tables and indexes

create table if not exists public.security_alerts (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'info',
  title text not null,
  description text not null,
  triggered_by uuid null,
  triggered_at timestamptz not null default now(),
  resolved_at timestamptz null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.security_alert_rules (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null,
  threshold integer not null default 1,
  level text not null default 'attention',
  auto_action text null,
  is_active boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create table if not exists public.ip_geoip_cache (
  ip text primary key,
  country_code text null,
  country_name text null,
  city text null,
  lat double precision null,
  lng double precision null,
  isp text null,
  cached_at timestamptz not null default now()
);

create table if not exists public.emergency_actions_log (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  reason text null,
  performed_by uuid null,
  performed_at timestamptz not null default now(),
  ip_address text null,
  effects_summary text null
);

alter table public.audit_logs add column if not exists human_description text null;
alter table public.profiles add column if not exists last_ip_address text null;
alter table public.profiles add column if not exists last_country_code text null;
alter table public.user_sessions add column if not exists country_code text null;
alter table public.user_sessions add column if not exists browser text null;
alter table public.user_sessions add column if not exists os text null;

create index if not exists idx_audit_logs_actor_created_at on public.audit_logs (user_id, created_at desc);
create index if not exists idx_audit_logs_action_created_at on public.audit_logs (action_type, created_at desc);
create index if not exists idx_audit_logs_ip_created_at on public.audit_logs ((coalesce((metadata->>'ip'), metadata->>'ip_address')), created_at desc);
create index if not exists idx_security_alerts_active_level on public.security_alerts (is_active, level);
create unique index if not exists idx_ip_geoip_cache_ip on public.ip_geoip_cache (ip);

create or replace view public.security_overview_view as
select
  (select count(*)::int from public.user_sessions where ended_at is null) as sessions_count,
  (select count(*)::int from public.audit_logs where action_type = 'login' and status = 'failed' and created_at >= now() - interval '24 hours') as login_failures_24h,
  (select count(*)::int from public.ip_whitelist) as whitelist_count,
  (select count(*)::int from public.ip_blacklist) as blacklist_count,
  (select count(*)::int from public.security_alerts where is_active = true) as active_alerts_count;

create or replace function public.fn_security_alert_on_login_failures()
returns trigger
language plpgsql
as $$
declare
  ip_text text;
  cnt int;
begin
  if new.action_type <> 'login' or new.status <> 'failed' then
    return new;
  end if;
  ip_text := coalesce(new.metadata->>'ip', new.metadata->>'ip_address');
  if ip_text is null or btrim(ip_text) = '' then
    return new;
  end if;

  select count(*) into cnt
  from public.audit_logs
  where action_type = 'login'
    and status = 'failed'
    and coalesce(metadata->>'ip', metadata->>'ip_address') = ip_text
    and created_at >= now() - interval '1 hour';

  if cnt >= 3 then
    insert into public.security_alerts(level, title, description, is_active, metadata)
    values (
      'attention',
      'Multiples échecs de connexion',
      format('Au moins 3 échecs de connexion depuis l''IP %s sur 1h.', ip_text),
      true,
      jsonb_build_object('ip', ip_text, 'count_last_hour', cnt)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_security_alert_on_login_failures on public.audit_logs;
create trigger trg_security_alert_on_login_failures
after insert on public.audit_logs
for each row execute function public.fn_security_alert_on_login_failures();

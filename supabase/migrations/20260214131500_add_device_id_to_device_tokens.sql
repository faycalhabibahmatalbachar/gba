alter table if exists public.device_tokens
add column if not exists device_id text;

update public.device_tokens
set device_id = id::text
where device_id is null;

alter table public.device_tokens
alter column device_id set not null;

create unique index if not exists device_tokens_user_device_unique
on public.device_tokens(user_id, device_id);

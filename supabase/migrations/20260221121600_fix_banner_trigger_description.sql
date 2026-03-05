-- Fix: banners table has 'subtitle' not 'description'
create or replace function public.on_banner_created()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.is_active = true then
    perform public.invoke_push_notification(
      jsonb_build_object(
        'type', 'banner_created',
        'record', jsonb_build_object(
          'id', NEW.id,
          'title', NEW.title,
          'subtitle', NEW.subtitle
        )
      )
    );
  end if;
  return NEW;
end;
$$;

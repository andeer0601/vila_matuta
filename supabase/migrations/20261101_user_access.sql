begin;
alter table public.profiles add column disabled_at timestamptz;
create table public.user_access_events (
 id bigint generated always as identity primary key,
 actor_id uuid not null references public.profiles(id),
 target_id uuid not null references public.profiles(id),
 disabled boolean not null,
 created_at timestamptz not null default now()
);
alter table public.user_access_events enable row level security;
revoke all on public.user_access_events from public,anon,authenticated;
grant select,insert on public.user_access_events to service_role;
create function public.set_user_access(actor_id uuid,target_id uuid,disabled boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(72841921);
 if disabled is null or not exists(select 1 from profiles where id=actor_id and role='admin' and disabled_at is null) then raise exception 'Access denied'; end if;
 if actor_id=target_id or not exists(select 1 from profiles where id=target_id) then raise exception 'Protected account'; end if;
 update profiles set disabled_at=case when disabled then coalesce(disabled_at,now()) else null end where id=target_id;
 insert into user_access_events(actor_id,target_id,disabled) values(actor_id,target_id,disabled);
end; $$;
revoke all on function public.set_user_access(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_user_access(uuid,uuid,boolean) to service_role;
-- Defense in depth for new purchases, including service-side callers racing a disable.
create function public.check_purchase_customer() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(72841921);
 if not exists(select 1 from profiles where id=new.user_id and role='customer' and disabled_at is null) then raise exception 'Customer access required'; end if;
 return new;
end; $$;
create trigger check_purchase_customer before insert on public.meal_purchases for each row execute function public.check_purchase_customer();
-- Preserve existing implementations behind guarded, server-only wrappers.
alter function public.schedule_purchase(uuid,uuid,jsonb) rename to schedule_purchase_internal;
revoke all on function public.schedule_purchase_internal(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
create function public.schedule_purchase(purchase_id uuid,owner_id uuid,new_plans jsonb) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(72841921);
 if not exists(select 1 from profiles where id=owner_id and role='customer' and disabled_at is null) then raise exception 'Customer access required'; end if;
 return schedule_purchase_internal(purchase_id,owner_id,new_plans);
end; $$;
alter function public.reserve_checkout(uuid,uuid) rename to reserve_checkout_internal;
revoke all on function public.reserve_checkout_internal(uuid,uuid) from public,anon,authenticated,service_role;
create function public.reserve_checkout(purchase_id uuid,owner_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(72841921);
 if not exists(select 1 from profiles where id=owner_id and role='customer' and disabled_at is null) then raise exception 'Customer access required'; end if;
 return reserve_checkout_internal(purchase_id,owner_id);
end; $$;
revoke all on function public.schedule_purchase(uuid,uuid,jsonb),public.reserve_checkout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.schedule_purchase(uuid,uuid,jsonb),public.reserve_checkout(uuid,uuid) to service_role;
-- Recheck active administrator under the existing shared lock in every operational RPC.
do $access$
declare signature text; definition text;
begin
 foreach signature in array array['set_production_capacity(uuid,date,integer)','set_production_closure(uuid,date,boolean,text)','set_delivery_status(uuid,uuid,text,text)','move_production(uuid,uuid,text,date)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if position('role=''admin''' in definition)=0 then raise exception 'Missing administrator guard: %',signature; end if;
  execute replace(definition,'role=''admin''','role=''admin'' and disabled_at is null');
 end loop;
end; $access$;
create function public.set_shop_contact(actor_id uuid,phone text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(72841921);
 if not exists(select 1 from profiles where id=actor_id and role='admin' and disabled_at is null) then raise exception 'Access denied'; end if;
 if phone is null or (phone<>'' and phone!~'^[0-9]{10,15}$') then raise exception 'Invalid phone'; end if;
 update shop_settings set whatsapp=phone where id=true;
end; $$;
revoke all on function public.set_shop_contact(uuid,text) from public,anon,authenticated;
grant execute on function public.set_shop_contact(uuid,text) to service_role;
commit;

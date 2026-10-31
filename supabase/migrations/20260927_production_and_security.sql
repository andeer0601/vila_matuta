-- Apply AFTER 20260826_init.sql. Never run with customer credentials.
begin;
-- Fix privilege escalation: profile owners cannot edit role/identity.
revoke update on public.profiles from anon, authenticated;
grant update (full_name,phone,avatar_url,cep,street,number,neighborhood,complement,city,state,dietary_restrictions,dietary_notes,onboarding_completed,updated_at) on public.profiles to authenticated;
alter function public.is_admin() set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.check_user_whitelist() set search_path = public, pg_temp;
drop trigger if exists before_auth_user_whitelist on auth.users;
create trigger before_auth_user_whitelist before insert on auth.users for each row execute function public.check_user_whitelist();
-- Retire direct client writes to legacy financial tables.
revoke insert,update,delete on public.orders, public.order_items, public.customer_credits from anon,authenticated;

create table public.meal_purchases (
 id uuid primary key,
 user_id uuid not null references public.profiles(id),
 total_cents integer not null check(total_cents>0),
 status text not null default 'pending' check(status in ('pending','paid','preparing','in_delivery','delivered','cancelled')),
 payload jsonb not null,
 checkout_url text,
 transaction_id text unique,
 needs_rescheduling boolean not null default false,
 created_at timestamptz not null default now(),
 paid_at timestamptz
);
create table public.production_reservations (
 purchase_id uuid not null references public.meal_purchases(id),
 delivery_date date not null,
 quantity integer not null check(quantity between 2 and 120),
 primary key(purchase_id,delivery_date)
);
create index purchase_owner_idx on public.meal_purchases(user_id);
create index production_date_idx on public.production_reservations(delivery_date);
alter table public.meal_purchases enable row level security;
alter table public.production_reservations enable row level security;
revoke all on public.meal_purchases,public.production_reservations from anon,authenticated;
grant all on public.meal_purchases,public.production_reservations to service_role;

-- Must be called under the global production lock by the functions below.
create function public.validate_purchase_plans(p_items jsonb,p_plans jsonb,p_existing jsonb default '[]')
returns void language plpgsql set search_path=public,pg_temp as $$
declare p jsonb; pair record; item jsonb; units integer; used integer; assigned integer; remaining integer; d date;
begin
 if jsonb_typeof(p_plans) <> 'array' or jsonb_array_length(p_plans) not between 1 and 200 then raise exception 'Invalid plans'; end if;
 if (select count(*) from jsonb_array_elements(p_plans)) <> (select count(distinct value->>'date') from jsonb_array_elements(p_plans)) then raise exception 'Duplicate dates'; end if;
 for p in select value from jsonb_array_elements(p_plans) loop
   d := (p->>'date')::date;
   if d is null or d <= (now() at time zone 'America/Sao_Paulo')::date or extract(dow from d) not in (1,3,5) then raise exception 'Invalid production date'; end if;
   if exists(select 1 from jsonb_array_elements(p_existing) e where (e->>'date')::date=d) then raise exception 'Already scheduled'; end if;
   if jsonb_typeof(p->'quantities') is distinct from 'object' then raise exception 'Invalid quantities'; end if;
   units:=0;
   for pair in select * from jsonb_each_text(p->'quantities') loop
     if pair.value !~ '^[0-9]+$' or (pair.value::integer<>0 and pair.value::integer<2) then raise exception 'Minimum two per flavor'; end if;
     if not exists(select 1 from jsonb_array_elements(p_items) i where i->>'id'=pair.key) then raise exception 'Unknown item'; end if;
     units:=units+pair.value::integer;
   end loop;
   select coalesce(sum(quantity),0) into used from public.production_reservations where delivery_date=d;
   if units<2 or used+units>120 then raise exception 'Production full'; end if;
 end loop;
 for item in select value from jsonb_array_elements(p_items) loop
   select coalesce(sum(coalesce((entry.value->'quantities'->>(item->>'id'))::integer,0)),0) into assigned from jsonb_array_elements(p_plans||p_existing) as entry(value);
   remaining:=(item->>'quantity')::integer-assigned;
   if remaining<0 or remaining=1 then raise exception 'Invalid flavor balance'; end if;
 end loop;
end;
$$;

create function public.confirm_purchase_payment(purchase_id uuid,transaction_id text,amount_cents integer)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare purchase public.meal_purchases; p jsonb; units integer; accepted boolean:=true;
begin
 -- One lock serializes capacity checks across all customers and all dates.
 perform pg_advisory_xact_lock(72841921);
 select * into purchase from public.meal_purchases where id=purchase_id for update;
 if not found or purchase.total_cents<>amount_cents then raise exception 'Invalid purchase'; end if;
 if purchase.transaction_id is not null then
   if purchase.transaction_id<>confirm_purchase_payment.transaction_id then raise exception 'Different transaction'; end if;
   return true;
 end if;
 if purchase.status<>'pending' then raise exception 'Invalid state'; end if;
 begin
   perform public.validate_purchase_plans(purchase.payload->'items',purchase.payload->'deliveries');
 exception when raise_exception then accepted:=false;
 end;
 if accepted then
   for p in select value from jsonb_array_elements(purchase.payload->'deliveries') loop
     select sum(value::integer) into units from jsonb_each_text(p->'quantities');
     insert into public.production_reservations values(purchase.id,(p->>'date')::date,units);
   end loop;
 else
   -- Payment is real; keep the paid balance, without overselling the kitchen.
   purchase.payload:=jsonb_set(purchase.payload,'{deliveries}','[]');
   purchase.payload:=jsonb_set(purchase.payload,'{delivery_date}','null');
 end if;
 update public.meal_purchases set status='paid',paid_at=now(),transaction_id=confirm_purchase_payment.transaction_id,
 needs_rescheduling=not accepted,payload=purchase.payload where id=purchase.id;
 return true;
end;
$$;

create function public.schedule_purchase(purchase_id uuid,owner_id uuid,new_plans jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare purchase public.meal_purchases; existing jsonb; p jsonb; units integer;
begin
 perform pg_advisory_xact_lock(72841921);
 select * into purchase from public.meal_purchases where id=purchase_id and user_id=owner_id for update;
 if not found or purchase.status='cancelled' then raise exception 'Invalid purchase'; end if;
 existing:=case when purchase.status='pending' then '[]'::jsonb else purchase.payload->'deliveries' end;
 perform public.validate_purchase_plans(purchase.payload->'items',new_plans,existing);
 if purchase.status<>'pending' then
   for p in select value from jsonb_array_elements(new_plans) loop
     select sum(value::integer) into units from jsonb_each_text(p->'quantities');
     insert into public.production_reservations values(purchase.id,(p->>'date')::date,units);
   end loop;
 end if;
 update public.meal_purchases set payload=jsonb_set(jsonb_set(payload,'{deliveries}',existing||new_plans),'{delivery_date}',to_jsonb(coalesce(existing->0->>'date',new_plans->0->>'date'))),needs_rescheduling=false where id=purchase.id;
 return true;
end;
$$;
revoke all on function public.validate_purchase_plans(jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.confirm_purchase_payment(uuid,text,integer) from public,anon,authenticated;
revoke all on function public.schedule_purchase(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.validate_purchase_plans(jsonb,jsonb,jsonb) to service_role;
grant execute on function public.confirm_purchase_payment(uuid,text,integer) to service_role;
grant execute on function public.schedule_purchase(uuid,uuid,jsonb) to service_role;
create view public.production_capacity with (security_invoker=true) as
 select delivery_date,sum(quantity)::integer as quantity
 from public.production_reservations
 where delivery_date >= (now() at time zone 'America/Sao_Paulo')::date
 group by delivery_date;
revoke all on public.production_capacity from public,anon,authenticated;
grant select on public.production_capacity to service_role;
commit;

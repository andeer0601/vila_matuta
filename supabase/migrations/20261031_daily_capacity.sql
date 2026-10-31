begin;
create table production_limits (
 production_date date primary key,
 capacity integer not null check(capacity between 2 and 10000),
 updated_by uuid not null references profiles(id),
 updated_at timestamptz not null default now()
);
alter table production_limits enable row level security;
revoke all on production_limits from public,anon,authenticated;
grant all on production_limits to service_role;
alter table production_reservations drop constraint production_reservations_quantity_check;
alter table production_reservations add constraint production_reservations_quantity_check check(quantity between 2 and 10000);
create function set_production_capacity(actor_id uuid,day date,new_capacity integer) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare committed integer; chosen integer:=coalesce(new_capacity,120);
begin
 perform pg_advisory_xact_lock(72841921);
 if not exists(select 1 from profiles where id=actor_id and role='admin') then raise exception 'Acesso negado'; end if;
 if day is null or day<=(now() at time zone 'America/Sao_Paulo')::date or extract(dow from day) not in (1,3,5) then raise exception 'Data inválida'; end if;
 if chosen<2 or chosen>10000 then raise exception 'Informe uma capacidade inteira entre 2 e 10.000.'; end if;
 if exists(select 1 from production_closures where production_date=day) then raise exception 'Reabra a produção antes de alterar a capacidade.'; end if;
 select coalesce(sum(quantity),0) into committed from production_reservations where delivery_date=day and (expires_at is null or expires_at>now()) and purchase_id in (select id from meal_purchases where status<>'cancelled');
 if chosen<committed then raise exception 'A capacidade não pode ser menor que as vagas comprometidas.'; end if;
 if new_capacity is null then delete from production_limits where production_date=day;
 else insert into production_limits(production_date,capacity,updated_by) values(day,chosen,actor_id)
 on conflict(production_date) do update set capacity=excluded.capacity,updated_by=excluded.updated_by,updated_at=now(); end if;
end; $$;
revoke all on function set_production_capacity(uuid,date,integer) from public,anon,authenticated;
grant execute on function set_production_capacity(uuid,date,integer) to service_role;
create or replace function public.validate_purchase_plans(p_items jsonb,p_plans jsonb,p_existing jsonb default '[]')

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

   if exists(select 1 from production_closures where production_date=d) then raise exception 'Produção indisponível nesta data'; end if;

   units:=0;

   for pair in select * from jsonb_each_text(p->'quantities') loop

     if pair.value !~ '^[0-9]+$' or (pair.value::integer<>0 and pair.value::integer<2) then raise exception 'Minimum two per flavor'; end if;

     if not exists(select 1 from jsonb_array_elements(p_items) i where i->>'id'=pair.key) then raise exception 'Unknown item'; end if;

     units:=units+pair.value::integer;

   end loop;

   select coalesce(sum(quantity),0) into used from public.production_reservations where delivery_date=d and (expires_at is null or expires_at>now()) and purchase_id in (select id from meal_purchases where status<>'cancelled');

   if units<2 or used+units>coalesce((select capacity from production_limits where production_date=d),120) then raise exception 'Production full'; end if;

 end loop;

 for item in select value from jsonb_array_elements(p_items) loop

   select coalesce(sum(coalesce((entry.value->'quantities'->>(item->>'id'))::integer,0)),0) into assigned from jsonb_array_elements(p_plans||p_existing) as entry(value);

   remaining:=(item->>'quantity')::integer-assigned;

   if remaining<0 or remaining=1 then raise exception 'Invalid flavor balance'; end if;

 end loop;

end;

$$;




create or replace function set_production_closure(actor_id uuid,day date,closed boolean,reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$

begin

 perform pg_advisory_xact_lock(72841921);

 if not exists(select 1 from profiles where id=actor_id and role='admin') then raise exception 'Acesso negado'; end if;

 if day<=(now() at time zone 'America/Sao_Paulo')::date or extract(dow from day) not in (1,3,5) then raise exception 'Data inválida'; end if;

 if closed then

 if exists(select 1 from production_reservations where delivery_date=day and (expires_at is null or expires_at>now()) and purchase_id in (select id from meal_purchases where status<>'cancelled')) then raise exception 'Esta produção tem pedidos ou reservas. Resolva os pedidos antes de bloquear a data.'; end if;

 insert into production_closures values(day,left(reason,200),now()) on conflict(production_date) do update set reason=excluded.reason;

 else delete from production_closures where production_date=day; end if;

end; $$;


create or replace view production_capacity with (security_invoker=true) as select delivery_date,sum(quantity)::integer as quantity from production_reservations where delivery_date >= (now() at time zone 'America/Sao_Paulo')::date and (expires_at is null or expires_at>now()) and purchase_id in (select id from meal_purchases where status<>'cancelled') group by delivery_date;
commit;

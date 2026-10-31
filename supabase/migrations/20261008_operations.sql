begin;

alter table profiles add column preferred_delivery_period text check(preferred_delivery_period in ('Manhã','Tarde','Noite'));

alter table profiles add column primary_address_id uuid;

alter table meal_purchases add column checkout_claimed_at timestamptz;

alter table production_reservations add column expires_at timestamptz;

create table saved_addresses(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id),address jsonb not null,created_at timestamptz not null default now());

create index saved_addresses_owner on saved_addresses(user_id);

alter table profiles add foreign key(primary_address_id) references saved_addresses(id);

create table production_closures(production_date date primary key,reason text not null default '',created_at timestamptz not null default now());

create table shop_settings(id boolean primary key default true check(id),whatsapp text not null default '' check(whatsapp ~ '^[0-9]{0,15}$'));

insert into shop_settings(id) values(true);

create table delivery_events(id bigint generated always as identity primary key,purchase_id uuid not null references meal_purchases(id),plan_id text not null,actor_id uuid not null references profiles(id),event text not null,created_at timestamptz not null default now());

alter table saved_addresses enable row level security;

alter table production_closures enable row level security;

alter table shop_settings enable row level security;

alter table delivery_events enable row level security;

revoke all on saved_addresses,production_closures,shop_settings,delivery_events from public,anon,authenticated;

grant all on saved_addresses,production_closures,shop_settings,delivery_events to service_role;

-- Address changes must go through the transactional server function.

revoke update(cep,street,number,neighborhood,complement,city,state) on profiles from authenticated;



create function prepare_plans(owner_id uuid,plans jsonb) returns jsonb language plpgsql set search_path=public,pg_temp as $$

declare result jsonb:='[]'; p jsonb; profile profiles; snapshot jsonb;

begin

 select * into profile from profiles where id=owner_id;

 snapshot:=jsonb_build_object('recipient_name',profile.full_name,'recipient_phone',profile.phone,'cep',profile.cep,'street',profile.street,'number',profile.number,'neighborhood',profile.neighborhood,'complement',profile.complement,'city',profile.city,'state',profile.state);

 for p in select value from jsonb_array_elements(plans) loop

 if p->>'period' is not null and p->>'period' not in ('Manhã','Tarde','Noite') then raise exception 'Período inválido'; end if;

 result:=result||jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'date',p->>'date','quantities',p->'quantities','period',p->>'period','preferred_period',profile.preferred_delivery_period,'address_mode','primary','address',snapshot,'status','scheduled'));

 end loop;

 return result;

end; $$;

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

   select coalesce(sum(quantity),0) into used from public.production_reservations where delivery_date=d and (expires_at is null or expires_at>now());

   if units<2 or used+units>120 then raise exception 'Production full'; end if;

 end loop;

 for item in select value from jsonb_array_elements(p_items) loop

   select coalesce(sum(coalesce((entry.value->'quantities'->>(item->>'id'))::integer,0)),0) into assigned from jsonb_array_elements(p_plans||p_existing) as entry(value);

   remaining:=(item->>'quantity')::integer-assigned;

   if remaining<0 or remaining=1 then raise exception 'Invalid flavor balance'; end if;

 end loop;

end;

$$;



create or replace function public.confirm_purchase_payment(purchase_id uuid,transaction_id text,amount_cents integer)

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

 delete from production_reservations where production_reservations.purchase_id=purchase.id and expires_at is not null;

 begin

   perform public.validate_purchase_plans(purchase.payload->'items',purchase.payload->'deliveries');

 exception when raise_exception then accepted:=false;

 end;

 if accepted then

   for p in select value from jsonb_array_elements(purchase.payload->'deliveries') loop

     select sum(value::integer) into units from jsonb_each_text(p->'quantities');

     insert into public.production_reservations(purchase_id,delivery_date,quantity) values(purchase.id,(p->>'date')::date,units);

   end loop;

 else

   -- Payment is real; keep the paid balance, without overselling the kitchen.

   purchase.payload:=jsonb_set(purchase.payload,'{previous_plans}',purchase.payload->'deliveries');

   purchase.payload:=jsonb_set(purchase.payload,'{deliveries}','[]');

   purchase.payload:=jsonb_set(purchase.payload,'{delivery_date}','null');

 end if;

 update public.meal_purchases set status='paid',paid_at=now(),transaction_id=confirm_purchase_payment.transaction_id,

 needs_rescheduling=not accepted,payload=purchase.payload where id=purchase.id;

 return true;

end;

$$;



create or replace function public.schedule_purchase(purchase_id uuid,owner_id uuid,new_plans jsonb)

returns boolean language plpgsql security definer set search_path=public,pg_temp as $$

declare purchase public.meal_purchases; existing jsonb; p jsonb; units integer;

begin

 perform pg_advisory_xact_lock(72841921);

 select * into purchase from public.meal_purchases where id=purchase_id and user_id=owner_id for update;

 if not found or purchase.status='cancelled' then raise exception 'Invalid purchase'; end if;

 if purchase.status='pending' and (purchase.checkout_url is not null or purchase.checkout_claimed_at is not null) then raise exception 'Pagamento já iniciado. Entre em contato para alterar as datas.'; end if;

 delete from production_reservations where production_reservations.purchase_id=purchase.id and expires_at is not null;

 new_plans:=public.prepare_plans(owner_id,new_plans);

 existing:=case when purchase.status='pending' then '[]'::jsonb else purchase.payload->'deliveries' end;

 perform public.validate_purchase_plans(purchase.payload->'items',new_plans,existing);

 if purchase.status<>'pending' then

   for p in select value from jsonb_array_elements(new_plans) loop

     select sum(value::integer) into units from jsonb_each_text(p->'quantities');

     insert into public.production_reservations(purchase_id,delivery_date,quantity) values(purchase.id,(p->>'date')::date,units);

   end loop;

 end if;

 update public.meal_purchases set payload=jsonb_set(jsonb_set(payload,'{deliveries}',existing||new_plans),'{delivery_date}',to_jsonb(coalesce(existing->0->>'date',new_plans->0->>'date'))),needs_rescheduling=false where id=purchase.id;

 return true;

end;

$$;



create or replace view production_capacity with (security_invoker=true) as select delivery_date,sum(quantity)::integer as quantity from production_reservations where delivery_date >= (now() at time zone 'America/Sao_Paulo')::date and (expires_at is null or expires_at>now()) group by delivery_date;

create function reserve_checkout(purchase_id uuid,owner_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$

declare purchase meal_purchases; p jsonb; expiry timestamptz; units integer;

begin

 perform pg_advisory_xact_lock(72841921);

 select * into purchase from meal_purchases where id=purchase_id and user_id=owner_id for update;

 if not found or purchase.status<>'pending' then raise exception 'Pedido indisponível'; end if;

 select min(expires_at) into expiry from production_reservations r where r.purchase_id=purchase.id;

 if expiry is null or expiry<=now() then

 delete from production_reservations r where r.purchase_id=purchase.id;

 perform validate_purchase_plans(purchase.payload->'items',purchase.payload->'deliveries');

 expiry:=now()+interval '30 minutes';

 for p in select value from jsonb_array_elements(purchase.payload->'deliveries') loop

 select sum(value::integer) into units from jsonb_each_text(p->'quantities');

 insert into production_reservations(purchase_id,delivery_date,quantity,expires_at) values(purchase.id,(p->>'date')::date,units,expiry);

 end loop;

 end if;

 if purchase.checkout_url is not null then return jsonb_build_object('url',purchase.checkout_url,'expires_at',expiry); end if;

 if purchase.checkout_claimed_at is not null then raise exception 'A geração do pagamento está em processamento. Aguarde ou fale com a equipe; não será criada uma cobrança duplicada.'; end if;

 update meal_purchases set checkout_claimed_at=now() where id=purchase.id;

 return jsonb_build_object('create',true,'expires_at',expiry);

end; $$;

create function set_production_closure(actor_id uuid,day date,closed boolean,reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$

begin

 perform pg_advisory_xact_lock(72841921);

 if not exists(select 1 from profiles where id=actor_id and role='admin') then raise exception 'Acesso negado'; end if;

 if day<=(now() at time zone 'America/Sao_Paulo')::date or extract(dow from day) not in (1,3,5) then raise exception 'Data inválida'; end if;

 if closed then

 if exists(select 1 from production_reservations where delivery_date=day and (expires_at is null or expires_at>now())) then raise exception 'Esta produção tem pedidos ou reservas. Resolva os pedidos antes de bloquear a data.'; end if;

 insert into production_closures values(day,left(reason,200),now()) on conflict(production_date) do update set reason=excluded.reason;

 else delete from production_closures where production_date=day; end if;

end; $$;

create function save_customer_address(owner_id uuid,address_data jsonb,address_id uuid,make_primary boolean,purchase_id uuid default null,plan_id text default null,period text default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$

declare chosen uuid; snapshot jsonb; purchase meal_purchases; plans jsonb; p jsonb; found_plan boolean:=false;

begin

 perform pg_advisory_xact_lock(72841921);

 if address_id is not null then

 select id,address into chosen,snapshot from saved_addresses where id=address_id and user_id=owner_id;

 if not found then raise exception 'Endereço indisponível'; end if;

 else

 if coalesce(address_data->>'street','')='' or coalesce(address_data->>'number','')='' or coalesce(address_data->>'city','')='' then raise exception 'Preencha o endereço'; end if;

 snapshot:=address_data;

 select id into chosen from saved_addresses where user_id=owner_id and address=snapshot limit 1;

 if chosen is null then insert into saved_addresses(user_id,address) values(owner_id,snapshot) returning id into chosen; end if;

 end if;

 if period is not null and period not in ('Manhã','Tarde','Noite') then raise exception 'Período inválido'; end if;

 if purchase_id is not null then

 select * into purchase from meal_purchases where id=purchase_id and user_id=owner_id for update;

 if not found or purchase.status='cancelled' then raise exception 'Pedido indisponível'; end if;

 plans:='[]';

 for p in select value from jsonb_array_elements(purchase.payload->'deliveries') loop

 if p->>'id'=plan_id then

 found_plan:=true;

 if (p->>'date')::date<=(now() at time zone 'America/Sao_Paulo')::date or coalesce(p->>'status','scheduled') in ('in_delivery','delivered') then raise exception 'Prazo encerrado. Entre em contato pelo WhatsApp.'; end if;

 p:=p||jsonb_build_object('address',snapshot,'address_id',chosen,'address_mode','specific','period',period);

 end if;

 plans:=plans||jsonb_build_array(p);

 end loop;

 if not found_plan then raise exception 'Entrega indisponível'; end if;

 update meal_purchases set payload=jsonb_set(payload,'{deliveries}',plans) where id=purchase.id;

 insert into delivery_events(purchase_id,plan_id,actor_id,event) values(purchase.id,plan_id,owner_id,'Endereço e preferência atualizados pelo cliente');

 end if;

 if make_primary then

 update profiles set primary_address_id=chosen,cep=snapshot->>'cep',street=snapshot->>'street',number=snapshot->>'number',neighborhood=snapshot->>'neighborhood',complement=snapshot->>'complement',city=snapshot->>'city',state=snapshot->>'state' where id=owner_id;

 for purchase in select * from meal_purchases where user_id=owner_id and status<>'cancelled' for update loop

 plans:='[]';

 for p in select value from jsonb_array_elements(purchase.payload->'deliveries') loop

 if (p->>'date')::date>(now() at time zone 'America/Sao_Paulo')::date and coalesce(p->>'address_mode','primary')='primary' and coalesce(p->>'status','scheduled') not in ('in_delivery','delivered') then p:=p||jsonb_build_object('address',snapshot,'address_id',chosen); end if;

 plans:=plans||jsonb_build_array(p);

 end loop;

 update meal_purchases set payload=jsonb_set(payload,'{deliveries}',plans) where id=purchase.id;

 end loop;

 end if;

 return chosen;

end; $$;

-- Backfill immutable snapshots for existing deliveries and save existing primary addresses.

update meal_purchases set payload=jsonb_set(payload,'{deliveries}',coalesce((select jsonb_agg(p||jsonb_build_object('address_mode','primary','status','scheduled','address',coalesce(payload->'shipping_address_snapshot','{}'))) from jsonb_array_elements(payload->'deliveries') p),'[]'));

do $$ declare p profiles; a uuid; begin for p in select * from profiles where street is not null loop

 select save_customer_address(p.id,jsonb_build_object('recipient_name',p.full_name,'recipient_phone',p.phone,'cep',p.cep,'street',p.street,'number',p.number,'neighborhood',p.neighborhood,'complement',p.complement,'city',p.city,'state',p.state),null,true) into a;

end loop; end; $$;

create function set_delivery_status(actor_id uuid,purchase_id uuid,plan_id text,new_status text) returns void language plpgsql security definer set search_path=public,pg_temp as $$

declare purchase meal_purchases; plans jsonb:='[]'; p jsonb; matched boolean:=false; current_status text;

begin

 perform pg_advisory_xact_lock(72841921);

 if not exists(select 1 from profiles where id=actor_id and role='admin') then raise exception 'Acesso negado'; end if;

 select * into purchase from meal_purchases where id=purchase_id for update;

 if not found or purchase.status in ('pending','cancelled') then raise exception 'Pedido não pago'; end if;

 for p in select value from jsonb_array_elements(purchase.payload->'deliveries') loop

 if p->>'id'=plan_id then

 matched:=true; current_status:=coalesce(p->>'status','scheduled');

 if not ((current_status='scheduled' and new_status='preparing') or (current_status='preparing' and new_status='ready') or (current_status='ready' and new_status='in_delivery') or (current_status='in_delivery' and new_status='delivered')) then raise exception 'Transição inválida'; end if;

 p:=p||jsonb_build_object('status',new_status,'status_updated_at',now());

 end if;

 plans:=plans||jsonb_build_array(p);

 end loop;

 if not matched then raise exception 'Entrega indisponível'; end if;

 update meal_purchases set payload=jsonb_set(payload,'{deliveries}',plans) where id=purchase.id;

 insert into delivery_events(purchase_id,plan_id,actor_id,event) values(purchase.id,plan_id,actor_id,new_status);

end; $$;

revoke all on function prepare_plans(uuid,jsonb),reserve_checkout(uuid,uuid),set_production_closure(uuid,date,boolean,text),save_customer_address(uuid,jsonb,uuid,boolean,uuid,text,text),set_delivery_status(uuid,uuid,text,text) from public,anon,authenticated;

grant execute on function prepare_plans(uuid,jsonb),reserve_checkout(uuid,uuid),set_production_closure(uuid,date,boolean,text),save_customer_address(uuid,jsonb,uuid,boolean,uuid,text,text),set_delivery_status(uuid,uuid,text,text) to service_role;

create function create_purchase(owner_id uuid,purchase_id uuid,total_cents integer,order_payload jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$

begin

 perform pg_advisory_xact_lock(72841921);

 if exists(select 1 from meal_purchases where id=purchase_id) then
 if not exists(select 1 from meal_purchases where id=purchase_id and user_id=owner_id) then raise exception 'Pedido indisponível'; end if;
 return (select payload from meal_purchases where id=purchase_id and user_id=owner_id);
 end if;
 order_payload:=jsonb_set(order_payload,'{deliveries}',prepare_plans(owner_id,order_payload->'deliveries'));

 perform validate_purchase_plans(order_payload->'items',order_payload->'deliveries');

 insert into meal_purchases(id,user_id,total_cents,payload) values(purchase_id,owner_id,total_cents,order_payload);

 return order_payload;

end; $$;

revoke all on function create_purchase(uuid,uuid,integer,jsonb) from public,anon,authenticated;

grant execute on function create_purchase(uuid,uuid,integer,jsonb) to service_role;

create function sync_delivery_preference() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare purchase meal_purchases; plans jsonb; p jsonb;
begin
 perform pg_advisory_xact_lock(72841921);
 for purchase in select * from meal_purchases where user_id=new.id and status<>'cancelled' for update loop
 plans:='[]';
 for p in select value from jsonb_array_elements(purchase.payload->'deliveries') loop
 if (p->>'date')::date>(now() at time zone 'America/Sao_Paulo')::date and coalesce(p->>'status','scheduled') not in ('in_delivery','delivered') then p:=p||jsonb_build_object('preferred_period',new.preferred_delivery_period); end if;
 plans:=plans||jsonb_build_array(p);
 end loop;
 update meal_purchases set payload=jsonb_set(payload,'{deliveries}',plans) where id=purchase.id;
 end loop;
 return new;
end; $$;
create trigger profile_delivery_preference after update of preferred_delivery_period on profiles for each row when(old.preferred_delivery_period is distinct from new.preferred_delivery_period) execute function sync_delivery_preference();
revoke all on function sync_delivery_preference() from public,anon,authenticated;
create function move_production(actor_id uuid,purchase_id uuid,plan_id text,new_date date) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare purchase meal_purchases; p jsonb; plans jsonb:='[]'; others jsonb:='[]'; moved jsonb; units integer;
begin
 perform pg_advisory_xact_lock(72841921);
 if not exists(select 1 from profiles where id=actor_id and role='admin') then raise exception 'Acesso negado'; end if;
 select * into purchase from meal_purchases where id=purchase_id for update;
 if not found or purchase.status in ('pending','cancelled') then raise exception 'Pedido não pago'; end if;
 for p in select value from jsonb_array_elements(purchase.payload->'deliveries') loop
 if p->>'id'=plan_id then
 if coalesce(p->>'status','scheduled')<>'scheduled' then raise exception 'A produção já começou'; end if;
 delete from production_reservations r where r.purchase_id=purchase.id and delivery_date=(p->>'date')::date;
 moved:=p||jsonb_build_object('date',new_date::text);
 if coalesce(p->>'address_mode','primary')='primary' then moved:=moved||jsonb_build_object('address',prepare_plans(purchase.user_id,jsonb_build_array(moved))->0->'address'); end if;
 plans:=plans||jsonb_build_array(moved);
 else plans:=plans||jsonb_build_array(p);others:=others||jsonb_build_array(p);end if;
 end loop;
 if moved is null then raise exception 'Entrega indisponível'; end if;
 perform validate_purchase_plans(purchase.payload->'items',jsonb_build_array(moved),others);
 select sum(value::integer) into units from jsonb_each_text(moved->'quantities');
 insert into production_reservations(purchase_id,delivery_date,quantity) values(purchase.id,new_date,units);
 update meal_purchases set payload=jsonb_set(jsonb_set(payload,'{deliveries}',plans),'{delivery_date}',to_jsonb((select min(value->>'date') from jsonb_array_elements(plans)))) where id=purchase.id;
 insert into delivery_events(purchase_id,plan_id,actor_id,event) values(purchase.id,plan_id,actor_id,'Produção remarcada para '||new_date::text);
end; $$;
revoke all on function move_production(uuid,uuid,text,date) from public,anon,authenticated;
grant execute on function move_production(uuid,uuid,text,date) to service_role;
commit;

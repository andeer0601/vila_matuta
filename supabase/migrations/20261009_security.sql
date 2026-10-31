begin;
-- Operational tables are server-only. RLS and revoked grants are complementary.
revoke all on profiles,allowed_emails,orders,order_items,customer_credits from anon,authenticated;
-- Remove column grants left by previous migrations, not only table-level grants.
revoke update(full_name,phone,avatar_url,cep,street,number,neighborhood,complement,city,state,dietary_restrictions,dietary_notes,onboarding_completed,updated_at) on profiles from authenticated;
grant all on profiles,allowed_emails to service_role;
create table api_rate_limits(key text primary key,hits integer not null,expires_at timestamptz not null);
create index api_rate_limits_expiry on api_rate_limits(expires_at);
alter table api_rate_limits enable row level security;
revoke all on api_rate_limits from public,anon,authenticated;
grant all on api_rate_limits to service_role;
create function consume_api_limit(bucket text,max_hits integer,window_seconds integer) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare current_bucket api_rate_limits;
begin
 if length(bucket)>128 or max_hits not between 1 and 10000 or window_seconds not between 1 and 86400 then raise exception 'Invalid rate limit'; end if;
 delete from api_rate_limits where key in (select key from api_rate_limits where expires_at<now()-interval '1 hour' limit 100);
 insert into api_rate_limits(key,hits,expires_at) values(bucket,1,now()+make_interval(secs=>window_seconds))
 on conflict(key) do update set hits=case when api_rate_limits.expires_at<=now() then 1 else least(api_rate_limits.hits+1,max_hits+1) end,expires_at=case when api_rate_limits.expires_at<=now() then now()+make_interval(secs=>window_seconds) else api_rate_limits.expires_at end returning * into current_bucket;
 if current_bucket.hits>max_hits then return greatest(1,ceil(extract(epoch from current_bucket.expires_at-now()))::integer);end if;
 return 0;
end; $$;
revoke all on function consume_api_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function consume_api_limit(text,integer,integer) to service_role;
-- Auth stores login e-mails. Avoid a second unencrypted copy and untrusted metadata in public profiles.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare assigned_role text;
begin
 select role into assigned_role from allowed_emails where lower(email)=lower(new.email);
 insert into profiles(id,email,role,full_name,avatar_url) values(new.id,new.id::text||'@auth.invalid',coalesce(assigned_role,'customer'),null,null) on conflict(id) do nothing;
 insert into customer_credits(user_id,available_meals,total_purchased) values(new.id,0,0) on conflict(user_id) do nothing;
 return new;
end; $$;
commit;

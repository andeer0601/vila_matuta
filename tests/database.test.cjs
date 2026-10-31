const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
let db;
const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const admin='33333333-3333-4333-8333-333333333333';
let day=new Date(Date.now()+7*86400000);
while(day.getUTCDay()!==1)day.setUTCDate(day.getUTCDate()+1);
const date=day.toISOString().slice(0,10);
const date2=new Date(day.getTime()+7*86400000).toISOString().slice(0,10);
const plan=(qty,when=date)=>({id:crypto.randomUUID(),date:when,quantities:{flavor:qty}});
async function purchase(qty,plans,user=owner){
 const id=crypto.randomUUID();
 await db.query('insert into meal_purchases(id,user_id,total_cents,payload) values($1,$2,$3,$4)',[id,user,qty*1400,JSON.stringify({id,items:[{id:'flavor',quantity:qty}],deliveries:plans})]);
 return id;
}
async function confirm(id,qty,tx=crypto.randomUUID()){
 await db.query('select confirm_purchase_payment($1,$2,$3)',[id,tx,qty*1400]);return tx;
}
async function get(id){return (await db.query('select * from meal_purchases where id=$1',[id])).rows[0];}
test.before(async()=>{
 db=new PGlite();
 await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; create publication supabase_realtime;");
 let initial=fs.readFileSync('supabase/migrations/20260826_init.sql','utf8').replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";','').replaceAll('uuid_generate_v4()','gen_random_uuid()');
 await db.exec(initial);
 // Reproduce Supabase default table grants before the hardening migration.
 await db.exec('grant usage on schema public to anon,authenticated,service_role; grant all on all tables in schema public to anon,authenticated,service_role;');
 await db.exec(fs.readFileSync('supabase/migrations/20260927_production_and_security.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261008_operations.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261009_security.sql','utf8'));
 await db.exec("insert into allowed_emails(email,role) values ('customer@test.local','customer'),('other@test.local','customer'),('admin@test.local','admin');");
 for(const [id,email] of [[owner,'customer@test.local'],[other,'other@test.local'],[admin,'admin@test.local']])await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);
});
test.after(()=>db?.close());
test('both migrations execute and whitelist trigger blocks uninvited users',async()=>{
 await assert.rejects(db.query("insert into auth.users(id,email) values(gen_random_uuid(),'stranger@test.local')"));
 assert.equal((await db.query('select count(*)::int as n from profiles')).rows[0].n,3);
});
test('client cannot promote own role or write financial tables/RPCs',async()=>{
 await db.exec("begin; set local role authenticated; select set_config('request.jwt.claim.sub','"+owner+"',true);");
 await assert.rejects(db.exec("update profiles set role='admin' where id='"+owner+"'"));
 await db.exec('rollback;');
 for(const statement of ["insert into meal_purchases(id,user_id,total_cents,payload) values(gen_random_uuid(),'"+owner+"',1,'{}')","select confirm_purchase_payment(gen_random_uuid(),'fake',1)","insert into orders(user_id,total_amount,quantity_meals) values('"+owner+"',1,2)"]){
  await db.exec('begin; set local role authenticated;');await assert.rejects(db.exec(statement));await db.exec('rollback;');
 }
});
test('profile writes are server-only so plaintext cannot bypass application encryption',async()=>{
 await db.exec("begin; set local role authenticated; select set_config('request.jwt.claim.sub','"+owner+"',true);");await assert.rejects(db.query('update profiles set full_name=$1 where id=$2',['Bypass',owner]));await db.exec('rollback;');
});
test('pending orders do not reserve capacity; payment reserves and is idempotent',async()=>{
 const id=await purchase(100,[plan(100)]);
 assert.equal((await db.query('select count(*)::int as n from production_reservations')).rows[0].n,0);
 const tx=await confirm(id,100);await confirm(id,100,tx);
 assert.equal((await get(id)).status,'paid');
 assert.equal((await db.query('select sum(quantity)::int as n from production_reservations')).rows[0].n,100);
 await assert.rejects(confirm(id,100,'different-transaction'));
});
test('another payment can fill the remaining 20 but never oversell 120',async()=>{
 const id=await purchase(20,[plan(20)],other);await confirm(id,20);
 const excess=await purchase(2,[plan(2)],other);await confirm(excess,2);
 const row=await get(excess);
 assert.equal(row.status,'paid');assert.equal(row.needs_rescheduling,true);assert.deepEqual(row.payload.deliveries,[]);
 assert.equal((await db.query('select sum(quantity)::int as n from production_reservations where delivery_date=$1',[date])).rows[0].n,120);
 await db.query('select schedule_purchase($1,$2,$3)',[excess,other,JSON.stringify([plan(2,date2)])]);
 assert.equal((await get(excess)).needs_rescheduling,false);
});
test('wrong amount, duplicate transaction and wrong owner cannot mutate purchase',async()=>{
 const id=await purchase(4,[plan(4,date2)]);
 await assert.rejects(db.query('select confirm_purchase_payment($1,$2,$3)',[id,'invalid',1]));
 await assert.rejects(db.query('select schedule_purchase($1,$2,$3)',[id,other,JSON.stringify([plan(4,date2)])]));
 assert.equal((await get(id)).status,'pending');
});
test('flavor balances cannot be overspent or leave exactly one unit',async()=>{
 const id=await purchase(10,[plan(4,date2)]);await confirm(id,10);
 const d3=new Date(day.getTime()+14*86400000).toISOString().slice(0,10);
 for(const qty of [1,5,7,1.5,-2]){
  await assert.rejects(db.query('select schedule_purchase($1,$2,$3)',[id,owner,JSON.stringify([plan(qty,d3)])]));
 }
 await db.query('select schedule_purchase($1,$2,$3)',[id,owner,JSON.stringify([plan(6,d3)])]);
 assert.equal((await get(id)).payload.deliveries.length,2);
 await assert.rejects(db.query('select schedule_purchase($1,$2,$3)',[id,owner,JSON.stringify([plan(2,new Date(day.getTime()+21*86400000).toISOString().slice(0,10))])]));
});
test('today, off-production days, empty quantities and duplicate dates are rejected',async()=>{
 const id=await purchase(4,[]);
 const tuesday=new Date(day.getTime()+86400000).toISOString().slice(0,10);
 for(const plans of [[plan(2,'2020-01-01')],[plan(2,tuesday)],[{id:'a',date:date2,quantities:{}}],[plan(2,date2),plan(2,date2)]]){
  await assert.rejects(db.query('select schedule_purchase($1,$2,$3)',[id,owner,JSON.stringify(plans)]));
 }
});

const future=(weeks)=>new Date(day.getTime()+weeks*7*86400000).toISOString().slice(0,10);
test('checkout holds serialize capacity, expire in 30 minutes and convert without double counting',async()=>{
 const when=future(5);const first=await purchase(100,[plan(100,when)]);const second=await purchase(22,[plan(22,when)],other);
 const hold=(await db.query('select reserve_checkout($1,$2) as r',[first,owner])).rows[0].r;
 assert.equal(hold.create,true);assert.ok(Date.parse(hold.expires_at)>Date.now()+29*60000);
 await assert.rejects(db.query('select reserve_checkout($1,$2)',[second,other]),/Production full/);
 await assert.rejects(db.query('select reserve_checkout($1,$2)',[first,owner]),/processamento/);
 await confirm(first,100);assert.equal((await db.query('select quantity from production_capacity where delivery_date=$1',[when])).rows[0].quantity,100);
 assert.equal((await db.query('select expires_at from production_reservations where purchase_id=$1',[first])).rows[0].expires_at,null);
});
test('expired hold releases capacity; late payment keeps all paid flavor balance if full',async()=>{
 const when=future(6);const first=await purchase(120,[plan(120,when)]);await db.query('select reserve_checkout($1,$2)',[first,owner]);await db.query("update production_reservations set expires_at=now()-interval '1 minute' where purchase_id=$1",[first]);
 assert.equal((await db.query('select count(*)::int n from production_capacity where delivery_date=$1',[when])).rows[0].n,0);
 const second=await purchase(120,[plan(120,when)],other);await db.query('select reserve_checkout($1,$2)',[second,other]);await confirm(first,120);
 const o=await get(first);assert.equal(o.status,'paid');assert.equal(o.needs_rescheduling,true);assert.deepEqual(o.payload.deliveries,[]);assert.equal(o.payload.items[0].quantity,120);assert.equal(o.payload.previous_plans.length,1);
});
test('closure requires admin, blocks reservations, reopens, and cannot discard active orders',async()=>{
 const when=future(7);await assert.rejects(db.query('select set_production_closure($1,$2,true,$3)',[owner,when,'Feriado']));await db.query('select set_production_closure($1,$2,true,$3)',[admin,when,'Feriado']);
 const id=await purchase(2,[plan(2,when)]);await assert.rejects(db.query('select reserve_checkout($1,$2)',[id,owner]),/indisponível/);await db.query('select set_production_closure($1,$2,false,$3)',[admin,when,'']);await db.query('select reserve_checkout($1,$2)',[id,owner]);await assert.rejects(db.query('select set_production_closure($1,$2,true,$3)',[admin,when,'Feriado']),/reservas/);
});
const address=(street)=>({street,number:'10',city:'São Paulo',state:'SP',cep:'01001000',neighborhood:'Centro',recipient_name:'Customer',recipient_phone:'11999999999'});
async function saveAddress(user,a,primary=false,id=null,planId=null,savedId=null){return (await db.query('select save_customer_address($1,$2,$3,$4,$5,$6,$7) as id',[user,a?JSON.stringify(a):null,savedId,primary,id,planId,'Tarde'])).rows[0].id;}
test('saved addresses are owned, defaults propagate only to future non-specific deliveries',async()=>{
 const old=address('Rua antiga');await saveAddress(owner,old,true);const p1=plan(2,future(8)),p2=plan(2,future(9));const id=await purchase(4,[{...p1,address:old,address_mode:'primary'},{...p2,address:old,address_mode:'primary'}]);
 const specific=await saveAddress(owner,address('Trabalho'),false,id,p1.id);await saveAddress(owner,address('Nova casa'),true);
 const plans=(await get(id)).payload.deliveries;assert.equal(plans[0].address.street,'Trabalho');assert.equal(plans[1].address.street,'Nova casa');assert.equal(plans[0].period,'Tarde');await assert.rejects(saveAddress(other,null,true,null,null,specific),/indisponível/);
 assert.equal((await db.query('select count(*)::int n from saved_addresses where user_id=$1',[owner])).rows[0].n,3);
});
test('cutoff enforced server-side and direct profile-address changes denied',async()=>{
 const today=(await db.query("select (now() at time zone 'America/Sao_Paulo')::date::text d")).rows[0].d;const p=plan(2,today);const id=await purchase(2,[{...p,address:address('Histórico')}]);await assert.rejects(saveAddress(owner,address('Tarde demais'),false,id,p.id),/Prazo encerrado/);await saveAddress(owner,address('Novo principal'),true);assert.equal((await get(id)).payload.deliveries[0].address.street,'Histórico');
 await db.exec("begin; set local role authenticated; select set_config('request.jwt.claim.sub','"+owner+"',true);");await assert.rejects(db.query('update profiles set street=$1 where id=$2',['Bypass',owner]));await db.exec('rollback;');
});
test('per-delivery status requires admin, a paid order and sequential steps',async()=>{
 const p=plan(2,future(10));const id=await purchase(2,[p]);await assert.rejects(db.query('select set_delivery_status($1,$2,$3,$4)',[admin,id,p.id,'preparing']),/pago/);await confirm(id,2);await assert.rejects(db.query('select set_delivery_status($1,$2,$3,$4)',[owner,id,p.id,'preparing']),/negado/);await assert.rejects(db.query('select set_delivery_status($1,$2,$3,$4)',[admin,id,p.id,'delivered']),/inválida/);
 for(const status of ['preparing','ready','in_delivery','delivered'])await db.query('select set_delivery_status($1,$2,$3,$4)',[admin,id,p.id,status]);assert.equal((await get(id)).payload.deliveries[0].status,'delivered');assert.equal((await db.query('select count(*)::int n from delivery_events where purchase_id=$1',[id])).rows[0].n,4);
});

test('moving a production transfers capacity atomically and rollback preserves a full destination',async()=>{
 const p=plan(10,future(12));const id=await purchase(10,[p]);await confirm(id,10);const full=await purchase(120,[plan(120,future(13))],other);await confirm(full,120);
 await assert.rejects(db.query('select move_production($1,$2,$3,$4)',[admin,id,p.id,future(13)]),/Production full/);
 assert.equal((await db.query('select quantity from production_capacity where delivery_date=$1',[future(12)])).rows[0].quantity,10);
 await db.query('select move_production($1,$2,$3,$4)',[admin,id,p.id,future(14)]);assert.equal((await get(id)).payload.deliveries[0].date,future(14));assert.equal((await db.query('select count(*)::int n from production_capacity where delivery_date=$1',[future(12)])).rows[0].n,0);
});
test('profile preference updates future inherited preferences while preserving explicit periods',async()=>{
 const p=plan(2,future(15));const id=await purchase(2,[{...p,period:'Noite',preferred_period:'Manhã'}]);await db.query("update profiles set preferred_delivery_period='Tarde' where id=$1",[owner]);const delivery=(await get(id)).payload.deliveries[0];assert.equal(delivery.period,'Noite');assert.equal(delivery.preferred_period,'Tarde');
});
test('new operational functions and address book are inaccessible to customer database roles',async()=>{
 for(const statement of ['select * from saved_addresses','select * from shop_settings','select reserve_checkout(gen_random_uuid(),gen_random_uuid())',"select save_customer_address(gen_random_uuid(),'{}',null,true)","select set_delivery_status(gen_random_uuid(),gen_random_uuid(),'x','delivered')"]){await db.exec('begin; set local role authenticated;');await assert.rejects(db.exec(statement));await db.exec('rollback;');}
});

test('persistent rate limiter allows the quota, rejects excess and renews expired windows',async()=>{
 const bucket='test-bucket';for(let i=0;i<3;i++)assert.equal((await db.query('select consume_api_limit($1,3,60) r',[bucket])).rows[0].r,0);assert.ok((await db.query('select consume_api_limit($1,3,60) r',[bucket])).rows[0].r>0);await db.query("update api_rate_limits set expires_at=now()-interval '1 second' where key=$1",[bucket]);assert.equal((await db.query('select consume_api_limit($1,3,60) r',[bucket])).rows[0].r,0);
 await db.exec('begin;set local role authenticated;');await assert.rejects(db.query('select consume_api_limit($1,3,60)',[bucket]));await db.exec('rollback;');
});

test('encrypted addresses survive production snapshots and transactional primary-address propagation',async()=>{
 const load=require('./helpers/load-ts.cjs');process.env.DATA_ENCRYPTION_KEYS=JSON.stringify({v1:Buffer.alloc(32,7).toString('base64')});process.env.DATA_ENCRYPTION_ACTIVE_KEY='v1';const {protect,reveal}=load('src/lib/server/privacy.ts');
 const a=address('Endereço sigiloso');await saveAddress(owner,protect(a,owner),true);const original=plan(2,future(20));const prepared=(await db.query('select prepare_plans($1,$2) plans',[owner,JSON.stringify([original])])).rows[0].plans;assert.ok(prepared[0].address.street.startsWith('vmenc:1:'));assert.equal(reveal(prepared,owner)[0].address.street,a.street);
 const id=await purchase(2,prepared);await confirm(id,2);await saveAddress(owner,protect(address('Outro endereço sigiloso'),owner),true);const payload=(await get(id)).payload;assert.ok(!JSON.stringify(payload).includes('Outro endereço sigiloso'));assert.equal(reveal(payload,owner).deliveries[0].address.street,'Outro endereço sigiloso');
});

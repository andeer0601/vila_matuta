const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const load=require('./helpers/load-ts.cjs');
const privacy=load('src/lib/server/privacy.ts');
const owner='11111111-1111-4111-8111-111111111111';
const first=crypto.randomBytes(32).toString('base64'),second=crypto.randomBytes(32).toString('base64');
test.beforeEach(()=>{process.env.DATA_ENCRYPTION_KEYS=JSON.stringify({v1:first});process.env.DATA_ENCRYPTION_ACTIVE_KEY='v1';});
test('personal data encrypts with random IVs, preserving quantities and identifiers',()=>{
 const data={id:'purchase',quantity:20,status:'paid',profile:{full_name:'Nome privado',email:'email@example.test',dietary_restrictions:['Sem leite'],dietary_notes:'Observação privada'},deliveries:[{date:'2026-11-02',address:{street:'Rua privada',recipient_phone:'11999999999'},quantities:{flavor:20}}],items:[{name:'Frango',special_instructions:'Sem leite'}]};
 const encrypted=privacy.protect(data,owner);assert.equal(encrypted.quantity,20);assert.equal(encrypted.items[0].name,'Frango');assert.ok(!JSON.stringify(encrypted).includes('Rua privada'));assert.notEqual(encrypted.profile.full_name,privacy.protect(data,owner).profile.full_name);assert.deepEqual(privacy.reveal(encrypted,owner),data);
});
test('tampering and another account cannot decrypt personal fields',()=>{
 const encrypted=privacy.protect({phone:'11999999999'},owner);assert.throws(()=>privacy.reveal(encrypted,'other'));const parts=encrypted.phone.split(':');parts[parts.length-1]=Buffer.from('forged').toString('base64');assert.throws(()=>privacy.reveal({phone:parts.join(':')},owner));
});
test('key rotation can read old data and writes with active key; missing keys fail closed',()=>{
 const old=privacy.protect({street:'Casa'},owner);process.env.DATA_ENCRYPTION_KEYS=JSON.stringify({v1:first,v2:second});process.env.DATA_ENCRYPTION_ACTIVE_KEY='v2';assert.equal(privacy.reveal(old,owner).street,'Casa');assert.ok(privacy.protect({street:'Casa'},owner).street.startsWith('vmenc:1:v2:'));process.env.DATA_ENCRYPTION_KEYS=JSON.stringify({v2:second});assert.throws(()=>privacy.reveal(old,owner));delete process.env.DATA_ENCRYPTION_KEYS;assert.throws(()=>privacy.protect({street:'Casa'},owner));
});
test('input validation rejects profile role escalation, malformed arrays and address payloads',()=>{
 const v=load('src/lib/server/input.ts');assert.throws(()=>v.profileEdits({role:'admin'}));assert.throws(()=>v.profileEdits({dietary_restrictions:'none'}));assert.throws(()=>v.address({street:'a',number:'1',city:'x',state:'SP',cep:'bad',recipient_name:'Nome',recipient_phone:'a'}));assert.throws(()=>v.object(null));assert.throws(()=>v.uuid('../other'));assert.equal(v.text('<script>alert(1)</script>',100),'<script>alert(1)</script>'); // React renders this as text; no unsafe HTML is used.
});
test('untrusted forwarding headers cannot choose a rate-limit bucket',()=>{
 const {NextRequest}=require('next/server');const {clientAddress}=load('src/lib/server/rate-limit.ts');process.env.TRUSTED_PROXY='none';const req=new NextRequest('https://example.test',{headers:{'x-forwarded-for':'1.2.3.4','x-nf-client-connection-ip':'2.3.4.5'}});assert.equal(clientAddress(req),'unverified-origin');process.env.TRUSTED_PROXY='netlify';delete process.env.NETLIFY;assert.equal(clientAddress(req),'unverified-origin');process.env.NETLIFY='true';assert.equal(clientAddress(req),'2.3.4.5');delete process.env.NETLIFY;delete process.env.TRUSTED_PROXY;
});
test('request body rejects oversized JSON, wrong origins and arrays',async()=>{
 const {NextRequest}=require('next/server');const {body}=load('src/lib/server/database.ts');process.env.APP_URL='https://example.test';const request=(data,headers={})=>new NextRequest('https://example.test/api/orders',{method:'POST',headers:{'content-type':'application/json',...headers},body:data});await assert.rejects(body(request('{}',{origin:'https://evil.test'})));await assert.rejects(body(request('[]')));await assert.rejects(body(request(JSON.stringify({notes:'x'.repeat(100001)}))));assert.deepEqual(await body(request('{"ok":true}',{origin:'https://example.test'})),{ok:true});delete process.env.APP_URL;
});

test('protected APIs reject absent sessions before attempting database access',async()=>{
 const {NextRequest}=require('next/server');const {customer}=load('src/lib/server/database.ts');await assert.rejects(customer(new NextRequest('https://example.test/api/orders')),e=>e.status===401);
});
test('a customer cannot invoke admin operations even with another order identifier',async()=>{
 const {NextRequest}=require('next/server');let writes=0;const route=load('src/app/api/operations/route.ts',{'@/lib/server/database':{customer:async()=>({db:{rpc:()=>writes++},user:{id:owner},profile:{role:'customer'}})}});const res=await route.POST(new NextRequest('https://example.test/api/operations',{method:'POST'}));assert.equal(res.status,403);assert.equal(writes,0);
});
test('checkout of another account cannot generate a payment link or reserve production',async()=>{
 const {NextRequest}=require('next/server');let payments=0,reservations=0;const filters=[];const query={select(){return this;},eq(k,v){filters.push([k,v]);return this;},async single(){return {data:null};}};const route=load('src/app/api/orders/[id]/checkout/route.ts',{'@/lib/server/database':{purchasingCustomer:async()=>({db:{from:()=>query,rpc:()=>reservations++},user:{id:owner},profile:{}}),failure:e=>require('next/server').NextResponse.json({error:e.message},{status:e.status||500})},'@/lib/infinitepay':{createInfinitePayCharge:()=>payments++}});const res=await route.POST(new NextRequest('https://example.test/api/orders/x/checkout',{method:'POST'}),{params:Promise.resolve({id:'22222222-2222-4222-8222-222222222222'})});assert.equal(res.status,400);assert.ok(filters.some(([k,v])=>k==='user_id'&&v===owner));assert.equal(payments,0);assert.equal(reservations,0);
});

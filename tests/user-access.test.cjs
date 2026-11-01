const test=require('node:test'),assert=require('node:assert/strict');
const load=require('./helpers/load-ts.cjs');
const {NextRequest}=require('next/server');
test('purchase and management permissions protect admin and disabled profiles',()=>{
 const {assertCustomer,assertUserManagement}=load('src/lib/access.ts');
 assert.throws(()=>assertCustomer(null));assert.throws(()=>assertCustomer({role:'admin'}));assert.throws(()=>assertCustomer({role:'customer',disabled_at:'now'}));assert.doesNotThrow(()=>assertCustomer({role:'customer'}));
 assert.throws(()=>assertUserManagement({id:'a',role:'admin'},{id:'a',role:'admin'}));
 assert.doesNotThrow(()=>assertUserManagement({id:'a',role:'admin'},{id:'b',role:'admin'}));
 assert.throws(()=>assertUserManagement({id:'a',role:'admin',disabled_at:'now'},{id:'b',role:'admin'}));
 assert.throws(()=>assertUserManagement({id:'a',role:'customer'},{id:'b',role:'customer'}));
});
test('server rejects existing tokens of disabled users and admin purchases',async()=>{
 let profile={id:'u',role:'customer',disabled_at:'now'};
 const db={auth:{getUser:async()=>({data:{user:{id:'u',email:'test@example.test'}}})},from:()=>({select(){return this},eq(){return this},single:async()=>({data:profile})})};
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
 const server=load('src/lib/server/database.ts',{'../mode':{DEMO_MODE:false},'./rate-limit':{rateLimit:async()=>{},clientAddress:()=>''},'@supabase/supabase-js':{createClient:()=>db}});
 const req=new NextRequest('https://example.test/api/orders',{headers:{authorization:'Bearer fake'}});
 await assert.rejects(server.customer(req),e=>e.status===403);
 profile={id:'u',role:'admin',disabled_at:'now'};await assert.rejects(server.customer(req),e=>e.status===403);
 profile={id:'u',role:'admin'};await assert.rejects(server.purchasingCustomer(req),e=>e.status===403);
 profile={id:'u',role:'customer'};assert.equal((await server.purchasingCustomer(req)).user.id,'u');
 delete process.env.NEXT_PUBLIC_SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});
test('demo disable/reactivate persists without deleting orders or other accounts',async()=>{
 const state={vm_profiles:{},orders:['existing']};
 const profiles={a:{id:'a',role:'admin'},b:{id:'b',role:'admin'},c:{id:'c',role:'customer'}};
 const users=load('src/lib/users.ts',{'./mode':{DEMO_MODE:true},'./api':{},'./supabase/mock-data':{DEMO_PROFILES:profiles},'./operations':{demoLock:async fn=>fn(),readLocal:(k,f)=>state[k]||f,writeLocal:(k,v)=>state[k]=v}});
 await users.setUserAccess(profiles.a,'b',true);assert.ok(state.vm_profiles.b.disabled_at);
 assert.equal((await users.listUsers()).length,3);assert.deepEqual(state.orders,['existing']);
 await assert.rejects(users.setUserAccess(profiles.b,'a',true));
 await users.setUserAccess(profiles.a,'b',false);assert.equal(state.vm_profiles.b.disabled_at,null);
 await assert.rejects(users.setUserAccess(profiles.a,'a',true));
 await assert.rejects(users.setUserAccess(profiles.c,'b',true));
});
test('login never returns tokens for a disabled profile and signs out the new session',async()=>{
 let revoked=false;
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-only';
 const route=load('src/app/api/auth/login/route.ts',{
  '@/lib/server/database':{body:async()=>({email:'customer@example.test',password:'test-only'}),database:()=>({from:()=>({select(){return this},eq(){return this},single:async()=>({data:{disabled_at:'now'}})})}),failure:e=>require('next/server').NextResponse.json({error:e.message},{status:e.status||500})},
  '@/lib/server/rate-limit':{rateLimit:async()=>{},clientAddress:()=>''},
  '@supabase/supabase-js':{createClient:()=>({auth:{signInWithPassword:async()=>({data:{user:{id:'u'},session:{access_token:'secret-test',refresh_token:'refresh-test'}}}),signOut:async()=>{revoked=true;}}})}
 });
 const response=await route.POST(new NextRequest('https://example.test/api/auth/login',{method:'POST'}));
 assert.equal(response.status,403);assert.equal(revoked,true);assert.ok(!(await response.text()).includes('secret-test'));
 delete process.env.NEXT_PUBLIC_SUPABASE_URL;delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

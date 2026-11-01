const test=require('node:test'),assert=require('node:assert/strict');
const load=require('./helpers/load-ts.cjs');const {NextRequest,NextResponse}=require('next/server');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const failure=e=>NextResponse.json({error:e.message},{status:e.status||500});
test('payment URLs and legacy/expired links fail closed',()=>{
 const {validPaymentUrl,paymentLinkState}=load('src/lib/payment-links.ts');
 for(const url of ['javascript:alert(1)','https://infinitepay.io.evil.test/x','https://user:pass@infinitepay.io/x','http://infinitepay.io/x','https://infinitepay.io:8443/x'])assert.equal(validPaymentUrl(url),false);
 const safe={status:'pending',checkout_url:'https://checkout.infinitepay.io/test',checkout_single_payment:true,checkout_expires_at:new Date(Date.now()+60000).toISOString()};
 assert.equal(paymentLinkState(safe),'ready');assert.equal(paymentLinkState({...safe,checkout_single_payment:false}),'review');assert.equal(paymentLinkState({...safe,checkout_expires_at:'2000-01-01'}),'expired');assert.equal(paymentLinkState({...safe,status:'paid'}),'none');
});
test('order responses strip payment URLs, transaction references and Pix codes',()=>{
 const {orderView}=load('src/lib/server/order-view.ts');const result=orderView({id:other,user_id:owner,total_cents:3600,status:'pending',payload:{infinitepay_checkout_url:'secret-url',infinitepay_tx_id:'secret-tx',infinitepay_pix_code:'secret-pix',items:[]},checkout_url:'secret-url'});
 assert.ok(!JSON.stringify(result).includes('secret-'));assert.equal(result.total_amount,36);assert.equal(result.payment_link_state,'review');
});
test('user detail rejects another customer before reading personal information',async()=>{
 let reads=0;const route=load('src/app/api/users/[id]/route.ts',{'@/lib/server/database':{customer:async()=>({db:{from:()=>reads++},user:{id:owner},profile:{role:'customer'}}),failure}});
 const response=await route.GET(new NextRequest('https://example.test/api/users/'+other),{params:Promise.resolve({id:other})});assert.equal(response.status,404);assert.equal(reads,0);
});
test('single order lookup scopes customer ownership and refuses unknown orders',async()=>{
 const filters=[];const query={select(){return this},eq(k,v){filters.push([k,v]);return this},single:async()=>({data:null})};
 const route=load('src/app/api/orders/[id]/route.ts',{'@/lib/server/database':{customer:async()=>({db:{from:()=>query},user:{id:owner},profile:{role:'customer'}}),failure}});
 const response=await route.GET(new NextRequest('https://example.test/api/orders/'+other),{params:Promise.resolve({id:other})});assert.equal(response.status,404);assert.ok(filters.some(([k,v])=>k==='user_id'&&v===owner));
});
test('retrieve reuses safe links; expired, legacy and absent links never invoke gateway',async()=>{
 const old={...process.env};Object.assign(process.env,{PAYMENTS_ENABLED:'true',INFINITEPAY_HANDLE:'test',INFINITEPAY_API_KEY:'test-only',APP_URL:'https://example.test'});
 try{
 for(const state of ['ready','expired','legacy','missing','paid']){
  let calls=0,reserves=0;const row={id:other,status:state==='paid'?'paid':'pending',checkout_url:state==='missing'?null:'https://checkout.infinitepay.io/test',checkout_single_payment:state!=='legacy',checkout_expires_at:new Date(Date.now()+(state==='expired'?-60000:60000)).toISOString()};
  const query={select(){return this},eq(){return this},single:async()=>({data:row})};
  const route=load('src/app/api/orders/[id]/checkout/route.ts',{'@/lib/server/database':{purchasingCustomer:async()=>({db:{from:()=>query,rpc:async()=>{reserves++;return {data:{url:row.checkout_url}}}},user:{id:owner},profile:{}}),body:async()=>({action:'retrieve'}),failure},'@/lib/infinitepay':{createInfinitePayCharge:()=>calls++}});
  const response=await route.POST(new NextRequest('https://example.test/api/orders/'+other+'/checkout',{method:'POST'}),{params:Promise.resolve({id:other})});
  assert.equal(response.status,state==='ready'?200:state==='paid'?400:409,state);assert.equal(calls,0);assert.equal(reserves,state==='ready'?1:0);
 }
 }finally{for(const key of ['PAYMENTS_ENABLED','INFINITEPAY_HANDLE','INFINITEPAY_API_KEY','APP_URL'])if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}
});
test('demo detail history paginates all statuses and cannot read another customer',async()=>{
 const orders=Array.from({length:27},(_,i)=>({id:String(i),user_id:owner,status:i%2?'pending':'paid',created_at:new Date(2026,0,i+1).toISOString()}));
 const details=load('src/lib/details.ts',{'./mode':{DEMO_MODE:true},'./api':{},'./supabase/mock-data':{DEMO_PROFILES:{[owner]:{id:owner,role:'customer'}}},'./operations':{ORDER_STORAGE:'orders',readLocal:(key,f)=>key==='orders'?orders:f}});
 const viewer={id:owner,role:'customer'};const first=await details.getUserDetails(viewer,'me');const last=await details.getUserDetails(viewer,'me',1);assert.equal(first.total,27);assert.equal(first.orders.length,25);assert.equal(first.hasMore,true);assert.equal(last.orders.length,2);assert.equal(last.hasMore,false);
 await assert.rejects(details.getUserDetails({id:other,role:'customer'},owner));await assert.rejects(details.getOrderDetails({id:other,role:'customer'},'1'));
});
test('new gateway links require a server key and request single payment with explicit expiry',async()=>{
 const saved={...process.env};const previousFetch=global.fetch;let calls=0,payload,headers;
 Object.assign(process.env,{PAYMENTS_ENABLED:'true',INFINITEPAY_HANDLE:'test',APP_URL:'https://example.test'});delete process.env.INFINITEPAY_API_KEY;
 global.fetch=async(url,options)=>{calls++;payload=JSON.parse(options.body);headers=options.headers;return {ok:true,json:async()=>({url:'https://checkout.infinitepay.io/test'})};};
 try{const gateway=load('src/lib/infinitepay.ts',{'./mode':{DEMO_MODE:false}});const expiry=new Date(Date.now()+60000).toISOString();
  await assert.rejects(gateway.createInfinitePayCharge({id:other,total_amount:36,quantity_meals:2},{name:'Test',email:'test@example.invalid'},expiry));assert.equal(calls,0);
  process.env.INFINITEPAY_API_KEY='test-only';await gateway.createInfinitePayCharge({id:other,total_amount:36,quantity_meals:2},{name:'Test',email:'test@example.invalid'},expiry);
  assert.deepEqual(payload.options,{single_payment:true,valid_until:expiry});assert.equal(headers['X-Api-Key'],'test-only');assert.equal(calls,1);
 }finally{global.fetch=previousFetch;for(const key of ['PAYMENTS_ENABLED','INFINITEPAY_HANDLE','INFINITEPAY_API_KEY','APP_URL'])if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}
});
test('finished history requires every purchased unit delivered, independently of payment status',()=>{
 const {orderProgress}=load('src/lib/details.ts');
 const paid={status:'paid',quantity_meals:4,deliveries:[{status:'delivered',quantities:{a:2}}]};
 assert.equal(orderProgress(paid),'Em aberto');
 assert.equal(orderProgress({...paid,deliveries:[{status:'delivered',quantities:{a:4}}]}),'Finalizado');
 assert.equal(orderProgress({...paid,status:'cancelled'}),'Cancelado');
});

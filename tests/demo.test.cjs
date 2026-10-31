const test=require('node:test'),assert=require('node:assert/strict');
const load=require('./helpers/load-ts.cjs');
const {NextRequest}=require('next/server');
function withMode(env,flag,fn){const oldEnv=process.env.NODE_ENV,oldFlag=process.env.NEXT_PUBLIC_DEMO_MODE;process.env.NODE_ENV=env;if(flag===undefined)delete process.env.NEXT_PUBLIC_DEMO_MODE;else process.env.NEXT_PUBLIC_DEMO_MODE=flag;try{return fn();}finally{if(oldEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldEnv;if(oldFlag===undefined)delete process.env.NEXT_PUBLIC_DEMO_MODE;else process.env.NEXT_PUBLIC_DEMO_MODE=oldFlag;}}
test('production demo is explicit; production without a flag remains real mode',()=>{
 for(const [env,flag,expected] of [['production',undefined,false],['production','true',true],['production','false',false],['development',undefined,true],['development','false',false]])withMode(env,flag,()=>assert.equal(load('src/lib/mode.ts').DEMO_MODE,expected));
});
test('public demo blocks every API family and both GET and POST before route handlers',()=>withMode('production','true',()=>{
 const {middleware}=load('src/middleware.ts');for(const path of ['/api/account','/api/orders','/api/orders/anything/checkout','/api/orders/anything/reconcile','/api/auth/login','/api/availability','/api/operations','/api/webhooks/infinitepay'])for(const method of ['GET','POST']){const response=middleware(new NextRequest('https://demo.test'+path,{method}));assert.equal(response.status,403,path);assert.equal(response.headers.get('cache-control'),'no-store');}
 assert.equal(middleware(new NextRequest('https://demo.test/entrar')).status,200);
}));
test('demo database and gateway reject direct calls without relying on middleware',async()=>{
 const db=withMode('production','true',()=>load('src/lib/server/database.ts'));assert.throws(()=>db.database(),e=>e.status===403);
 const gateway=withMode('production','true',()=>load('src/lib/infinitepay.ts'));await assert.rejects(gateway.createInfinitePayCharge({id:'test',quantity_meals:2,total_amount:36},{name:'Demo',email:'demo@example.invalid'}),/desativados/);
 const previous=process.env.INFINITEPAY_HANDLE;process.env.INFINITEPAY_HANDLE='fictional';try{await assert.rejects(gateway.verifyInfinitePayPayment('test','test','test'),/desativados/);}finally{if(previous===undefined)delete process.env.INFINITEPAY_HANDLE;else process.env.INFINITEPAY_HANDLE=previous;}
});
test('demo CEP is a local fixture and never fetches',async()=>{
 const original=global.fetch;global.fetch=()=>{throw new Error('Unexpected network');};try{const cep=withMode('production','true',()=>load('src/lib/viacep.ts'));assert.equal((await cep.fetchAddressByCEP('00000-000')).street,'Rua de Demonstração');}finally{global.fetch=original;}
});
test('webhook keeps retryable failures instead of acknowledging them as bad requests',async()=>{
 const {ApiError}=load('src/lib/server/errors.ts');const {failure}=load('src/lib/server/database.ts',{'./errors':{ApiError}});for(const [error,status] of [[new ApiError('Rate limit',429,60),429],[new Error('Unavailable'),500]]){const route=load('src/app/api/webhooks/infinitepay/route.ts',{'@/lib/server/database':{body:async()=>{throw error;},failure}});const response=await route.POST(new NextRequest('https://demo.test/api/webhooks/infinitepay',{method:'POST'}));assert.equal(response.status,status);if(status===429)assert.equal(response.headers.get('retry-after'),'60');}
});

test('demo reset only removes the public demo namespace and preserves earlier data',()=>{
 const original=global.localStorage;const values={'vm_public_demo_v1_vm_demo_orders_v2':'[]','vm_public_demo_v1_vm_cart_guest':'[]','vm_demo_orders_v2':'old','unrelated':'keep'};Object.defineProperty(values,'removeItem',{enumerable:false,value:key=>delete values[key]});global.localStorage=values;try{const operations=withMode('production','true',()=>load('src/lib/operations.ts'));operations.resetDemoStorage();assert.deepEqual(Object.keys(values).sort(),['unrelated','vm_demo_orders_v2']);assert.equal(values.vm_demo_orders_v2,'old');assert.equal(operations.storageKey('vm_cart_guest'),'vm_public_demo_v1_vm_cart_guest');const real=withMode('production','false',()=>load('src/lib/operations.ts'));assert.throws(()=>real.resetDemoStorage(),/apenas/);}finally{global.localStorage=original;}
});

test('demo early denials carry full headers and a same-origin-only production CSP',()=>withMode('production','true',()=>{
 const {middleware}=load('src/middleware.ts');for(const path of ['/entrar','/api','/api/orders/a.png','/api/availability.svg']){const r=middleware(new NextRequest('https://demo.test'+path));assert.equal(r.status,path==='/entrar'?200:403);assert.equal(r.headers.get('x-frame-options'),'DENY');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('strict-transport-security'),'max-age=31536000');assert.ok(r.headers.get('permissions-policy'));assert.ok(r.headers.get('referrer-policy'));const csp=r.headers.get('content-security-policy');assert.match(csp,/connect-src 'self'\s*;/);assert.match(csp,/frame-src 'none'/);assert.ok(!/viacep|supabase|cloudflare|unsafe-eval/.test(csp));}
}));
test('actual Next config and preflight agree on safe and unsafe demo environments',()=>{
 const {spawnSync}=require('node:child_process');const base={...process.env,NODE_ENV:'production',NEXT_PUBLIC_DEMO_MODE:'true',PAYMENTS_ENABLED:'false'};
 for(const key of Object.keys(base))if(key.startsWith('NEXT_PUBLIC_')&&key!=='NEXT_PUBLIC_DEMO_MODE')delete base[key];
 for(const key of ['SUPABASE_SERVICE_ROLE_KEY','INFINITEPAY_HANDLE','DATA_ENCRYPTION_KEYS','RATE_LIMIT_SECRET'])delete base[key];
 const cases=[{}, {PAYMENTS_ENABLED:undefined},{PAYMENTS_ENABLED:'true'},{PAYMENTS_ENABLED:'0'},{NEXT_PUBLIC_UNEXPECTED_SECRET:'fake'},{NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid'},{SUPABASE_SERVICE_ROLE_KEY:'fake'},{DATA_ENCRYPTION_KEYS:'fake'},{RATE_LIMIT_SECRET:'fake'}];
 for(const extra of cases){const env={...base,...extra};for(const key of Object.keys(env))if(env[key]===undefined)delete env[key];const next=spawnSync(process.execPath,['--input-type=module','-e',"await import('./next.config.mjs')"],{env,encoding:'utf8'});const preflight=spawnSync(process.execPath,['scripts/check-env.cjs'],{env,encoding:'utf8'});const expected=Object.keys(extra).length?1:0;assert.equal(next.status,expected,'Next config: '+Object.keys(extra));assert.equal(preflight.status,expected,'Preflight: '+Object.keys(extra));}
});

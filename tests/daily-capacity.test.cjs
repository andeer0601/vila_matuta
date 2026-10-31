const test=require('node:test'),assert=require('node:assert/strict'),load=require('./helpers/load-ts.cjs');
const s=load('src/lib/scheduling.ts'),draft=load('src/lib/purchase-draft.ts');
const day=s.nextAvailableDate(),next=s.nextAvailableDate(s.addDateDays(day,1));
const items=[{tempId:'a',quantity:150}],plans=[{id:'d',date:day,quantities:{a:150}}];
test('per-date limits support expansion, reduction, closed dates and unchanged defaults',()=>{
 assert.equal(s.productionLimit(next,{[day]:180}),120);
 assert.equal(s.validatePlan(items,plans,{},true,undefined,{[day]:180}),null);
 assert.ok(s.validatePlan(items,plans,{},true,undefined,{[day]:140}));
 assert.equal(s.nextAvailableDate(day,{},150,{[day]:180}),day);
 assert.notEqual(s.nextAvailableDate(day,{},2,{[day]:0}),day);
 const proposed=draft.suggestDeliveries(items,{},7,day,undefined,{[day]:180});assert.equal(proposed.length,1);assert.equal(s.planCount(proposed[0]),150);
});
test('capacity changes reject invalid limits, past dates and reductions below commitments',()=>{
 for(const n of [0,1,2.5,10001,NaN,Infinity,'20',undefined])assert.ok(s.validateCapacityChange(day,n,0));
 assert.ok(s.validateCapacityChange('2020-01-01',120,0));
 assert.ok(s.validateCapacityChange(day,19,20));assert.equal(s.validateCapacityChange(day,20,20),null);
});
test('paid deliveries and active holds count; cancelled and expired holds release capacity',()=>{
 const p={id:'d',date:day,quantities:{a:10}};const base={deliveries:[p]};
 const cap=s.capacityFromOrders([{...base,status:'paid'},{...base,status:'pending',reservation_expires_at:new Date(Date.now()+60000).toISOString()},{...base,status:'pending',reservation_expires_at:new Date(Date.now()-60000).toISOString()},{...base,status:'cancelled'}]);assert.equal(cap[day],20);
});
test('demo capacity updates serialize, persist by date, preserve settings and protect commitments',async()=>{
 const store=new Map();global.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};global.window={dispatchEvent(){}};
 let queue=Promise.resolve();Object.defineProperty(global,'navigator',{configurable:true,value:{locks:{request:(name,fn)=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;}}}});
 const ops=load('src/lib/operations.ts',{'./mode':{DEMO_MODE:true}});const admin={id:'admin',role:'admin'};
 ops.writeLocal(ops.ORDER_STORAGE,[{status:'paid',deliveries:[{id:'p',date:day,quantities:{a:20}}]}]);
 await assert.rejects(ops.operate(admin,{action:'capacity',date:day,limit:19}));
 await Promise.all([ops.operate(admin,{action:'capacity',date:day,limit:180}),ops.operate(admin,{action:'capacity',date:next,limit:60})]);
 assert.deepEqual((await ops.getSettings()).capacity_limits,{[day]:180,[next]:60});
 await assert.rejects(ops.operate({role:'customer'},{action:'capacity',date:day,limit:200}));
 await ops.operate(admin,{action:'capacity',date:day,limit:null});assert.equal((await ops.getSettings()).capacity_limits[day],undefined);assert.equal((await ops.getSettings()).capacity_limits[next],60);
 await ops.operate(admin,{action:'closure',date:next,closed:true});await assert.rejects(ops.operate(admin,{action:'capacity',date:next,limit:80}));
});
